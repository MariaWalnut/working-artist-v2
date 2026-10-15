import { useSyncExternalStore } from 'react'
import { db } from '../db/db'
import { exportData, importData } from './backup'
import { supabase } from './supabase'
import { userId } from './mode'

// The signed-in person's studio is kept in the browser (fast, works offline) and saved
// as one private file in Supabase storage: v2-studios/<user id>/studio.json.
// Every local change is uploaded a few seconds later. On load, and when the tab comes
// back into view, a newer cloud copy (saved from another device) replaces the local one.

const BUCKET = 'v2-studios'
const PUSH_DELAY = 3000

export type CloudStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'offline' | 'error'

let status: CloudStatus = 'idle'
const listeners = new Set<() => void>()
function setStatus(s: CloudStatus) { status = s; listeners.forEach(l => l()) }
export function useCloudStatus() {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => status)
}

const path = () => `${userId}/studio.json`
// When this browser last matched the cloud copy (the cloud file's updated_at).
const syncedKey = () => `wa-synced-${userId}`
// When this browser last changed something not yet uploaded (ms).
const dirtyKey = () => `wa-dirty-${userId}`

const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string | null) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* private mode */ } }

async function cloudUpdatedAt(): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).list(userId!, { search: 'studio.json' })
  if (error) throw error
  return data.find(f => f.name === 'studio.json')?.updated_at ?? null
}

// Applying a cloud copy rewrites every table; those writes must not trigger an upload.
let applying = false

async function pull(updatedAt: string) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path())
  if (error) throw error
  applying = true
  try { await importData(await data.text()) } finally { applying = false }
  write(syncedKey(), updatedAt)
  write(dirtyKey(), null)
}

let timer: ReturnType<typeof setTimeout> | undefined
let pushing = false
let again = false

async function push() {
  if (pushing) { again = true; return }
  pushing = true
  setStatus('saving')
  try {
    const startedDirty = read(dirtyKey())
    const json = await exportData()
    const { error } = await supabase.storage.from(BUCKET).upload(path(), new Blob([json], { type: 'application/json' }), { upsert: true, contentType: 'application/json', cacheControl: '0' })
    if (error) throw error
    write(syncedKey(), await cloudUpdatedAt())
    // Only clear the flag if nothing changed while uploading.
    if (read(dirtyKey()) === startedDirty) write(dirtyKey(), null)
    setStatus('saved')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  } finally {
    pushing = false
    if (again) { again = false; schedulePush() }
  }
}

function schedulePush() {
  clearTimeout(timer)
  timer = setTimeout(() => void push(), PUSH_DELAY)
}

function onLocalChange() {
  if (applying) return
  write(dirtyKey(), String(Date.now()))
  schedulePush()
}

// Bring this browser and the cloud copy in line. Local edits not yet uploaded win
// when they are newer than the cloud copy; otherwise the cloud copy wins.
async function reconcile() {
  const cloud = await cloudUpdatedAt()
  const synced = read(syncedKey())
  const dirty = Number(read(dirtyKey()) ?? 0)
  if (!cloud) {
    if ((await db.departments.count()) > 0) await push()
    return
  }
  if (cloud === synced) {
    if (dirty) await push()
    return
  }
  // The cloud copy changed elsewhere.
  if (dirty && dirty > Date.parse(cloud)) await push()
  else await pull(cloud)
}

let started = false

// Called once before the app shows the studio.
export async function startCloud() {
  if (!userId || started) return
  started = true
  setStatus('loading')
  try {
    await db.open()
    await reconcile()
    setStatus('saved')
  } catch {
    setStatus(navigator.onLine ? 'error' : 'offline')
  }
  for (const t of db.tables) {
    t.hook('creating', onLocalChange)
    t.hook('updating', onLocalChange)
    t.hook('deleting', onLocalChange)
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !pushing) void reconcile().catch(() => {})
  })
  window.addEventListener('online', () => { if (read(dirtyKey())) schedulePush() })
}

export function retryCloud() { void push() }

// Upload now, before signing out, so nothing is left behind.
export async function flushCloud() {
  clearTimeout(timer)
  if (read(dirtyKey())) await push()
}
