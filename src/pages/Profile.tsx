import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type ProfileLink, type TextEntry } from '../db/db'
import { Shell } from '../components/layout/Shell'
import { CareerFrame } from '../components/CareerTabs'
import { AddButton } from '../components/PageFrame'
import { useActiveDept } from '../lib/useDept'
import { fileToDataUrl } from '../lib/images'
import { linkLabels, placeWord, subjectWord, textKinds, wordCount } from '../lib/profile'

const KIND_COLOR: Record<string, string> = {
  Bio: '#D4E8F0',
  'Artist statement': '#E8D4F0',
  Statement: '#E8D4F0',
  "Director's statement": '#E8D4F0',
  'Press release': '#F0D4D4',
  'Release note': '#F0EAD4',
  'Book blurb': '#D4F0E4',
  'Band description': '#D4F0E4',
  'Show description': '#D4F0E4',
  'Project description': '#D4F0E4',
  'Exhibition text': '#D4F0E4',
  'Series text': '#D4F0E4',
  'Work description': '#F0EAD4',
  'Programme note': '#F0EAD4',
  'Case note': '#F0EAD4',
  Caption: '#F0EAD4',
  Logline: '#F3E7B8',
  Synopsis: '#F3E7B8',
  Pitch: '#DCEBDD',
  Other: '#F0F0F0',
}

const inp: React.CSSProperties = {
  borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill-2)',
  padding: '8px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%', fontFamily: 'inherit',
}

const quietButton: React.CSSProperties = {
  background: 'var(--wa-fill)', border: 'none', borderRadius: 8, padding: '6px 12px',
  fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit',
}

// The clipboard API needs a secure page and the browser's permission. Where it is refused,
// a hidden field and the old copy command still work.
function copyFallback(value: string): boolean {
  const field = document.createElement('textarea')
  field.value = value
  field.setAttribute('readonly', '')
  field.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
  document.body.appendChild(field)
  try {
    field.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    document.body.removeChild(field)
  }
}

// Copying is how a text leaves the app: one tap, then paste it into the mail.
function useCopy() {
  const [copied, setCopied] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  useEffect(() => {
    if (copied === null && failed === null) return
    const t = window.setTimeout(() => { setCopied(null); setFailed(null) }, 1600)
    return () => window.clearTimeout(t)
  }, [copied, failed])
  async function copy(key: string, value: string) {
    try {
      // On a page that has lost focus the clipboard promise never settles, so it is given a moment
      // and then the old way is tried instead.
      await Promise.race([
        navigator.clipboard.writeText(value),
        new Promise((_, reject) => window.setTimeout(reject, 500)),
      ])
      setCopied(key)
      return
    } catch {
      /* refused, or too slow: try the old way */
    }
    if (copyFallback(value)) setCopied(key)
    else setFailed(key)
  }
  return { copied, failed, copy }
}

// ─── Identity ────────────────────────────────────────────────────────────────

function Identity() {
  const dept = useActiveDept()
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [basedIn, setBasedIn] = useState('')
  const [since, setSince] = useState('')
  const { copied, failed, copy } = useCopy()

  if (!dept?.id) return null
  const id = dept.id
  const links = dept.profileLinks ?? []

  function startEdit() {
    setName(dept!.name)
    setBasedIn(dept!.basedIn ?? '')
    setSince(dept!.establishedYear ? String(dept!.establishedYear) : '')
    setEditing(true)
  }

  async function save() {
    const year = Number(since)
    await db.departments.update(id, {
      name: name.trim() || dept!.name,
      basedIn: basedIn.trim() || undefined,
      establishedYear: Number.isFinite(year) && year > 0 ? year : undefined,
    })
    setEditing(false)
  }

  async function takePhoto(file?: File) {
    if (!file?.type.startsWith('image/')) return
    await db.departments.update(id, { profilePhoto: await fileToDataUrl(file, 600) })
  }

  async function setLinks(next: ProfileLink[]) {
    await db.departments.update(id, { profileLinks: next })
  }

  const line = [dept.basedIn && `${placeWord(dept)} ${dept.basedIn}`, dept.establishedYear && `Since ${dept.establishedYear}`]
    .filter(Boolean).join(' · ')

  return (
    <div style={{ padding: '20px', borderBottom: '1px solid var(--wa-line)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { void takePhoto(e.target.files?.[0]); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} aria-label={dept.profilePhoto ? 'Change the photo' : 'Add a photo'}
          style={{ width: 84, height: 84, flexShrink: 0, borderRadius: 16, overflow: 'hidden', border: dept.profilePhoto ? 'none' : '1px dashed var(--wa-line-strong)', background: 'var(--wa-fill-2)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {dept.profilePhoto
            ? <img src={dept.profilePhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ fontSize: 10, color: 'var(--wa-muted)' }}>Photo</span>}
        </button>

        <div style={{ flex: 1, minWidth: 220 }}>
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360 }}>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Name" aria-label="Name" style={{ ...inp, fontSize: 14 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={basedIn} onChange={e => setBasedIn(e.target.value)} placeholder="City" aria-label="City" style={{ ...inp, flex: 2 }} />
                <input value={since} onChange={e => setSince(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="Since" aria-label="Since" inputMode="numeric" style={{ ...inp, flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 24, color: 'var(--wa-ink)', textWrap: 'balance' }}>{dept.name}</h1>
                <button onClick={startEdit} style={quietButton}>Edit</button>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--wa-text-2)' }}>
                {line || `No city yet for ${subjectWord(dept)}`}
              </p>
            </>
          )}
        </div>
      </div>

      <LinkRow dept={dept} links={links} onChange={next => void setLinks(next)} copied={copied} failed={failed} copy={copy} />
    </div>
  )
}

function LinkRow({ dept, links, onChange, copied, failed, copy }: {
  dept: NonNullable<ReturnType<typeof useActiveDept>>
  links: ProfileLink[]
  onChange: (next: ProfileLink[]) => void
  copied: string | null
  failed: string | null
  copy: (key: string, value: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('Website')
  const [value, setValue] = useState('')
  const labels = linkLabels(dept)

  function add() {
    if (!value.trim()) return
    onChange([...links, { id: crypto.randomUUID(), label: label.trim() || 'Link', value: value.trim() }])
    setValue('')
    setLabel('Website')
    setAdding(false)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
      {links.map(l => (
        <span key={l.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--wa-fill)', borderRadius: 999, padding: '5px 6px 5px 12px' }}>
          <button onClick={() => copy(l.id, l.value)} title={`Copy ${l.label}`}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: 'var(--wa-text)', fontFamily: 'inherit' }}>
            <span style={{ fontWeight: 600 }}>{l.label}</span>
            <span style={{ color: 'var(--wa-text-2)', marginLeft: 6 }}>{copied === l.id ? 'Copied' : failed === l.id ? 'Copy failed' : l.value}</span>
          </button>
          <button onClick={() => onChange(links.filter(x => x.id !== l.id))} aria-label={`Remove ${l.label}`}
            style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', fontSize: 12, color: 'var(--wa-muted)', lineHeight: 1, fontFamily: 'inherit' }}>×</button>
        </span>
      ))}

      {adding ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input list="wa-profile-link-labels" value={label} onChange={e => setLabel(e.target.value)} placeholder="Label" aria-label="Label" style={{ ...inp, width: 120 }} />
          <datalist id="wa-profile-link-labels">{labels.map(l => <option key={l} value={l} />)}</datalist>
          <input autoFocus value={value} onChange={e => setValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') setAdding(false) }}
            placeholder="Address" aria-label="Address" style={{ ...inp, width: 220 }} />
          <button onClick={add} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', fontSize: 10, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
          <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </span>
      ) : (
        <button onClick={() => setAdding(true)} style={{ ...quietButton, borderRadius: 999, padding: '5px 12px', fontSize: 11 }}>+ Link</button>
      )}
    </div>
  )
}

// ─── Text form ───────────────────────────────────────────────────────────────

function TextForm({ entry, onDone }: { entry: TextEntry | null; onDone: () => void }) {
  const dept = useActiveDept()
  const kinds = textKinds(dept)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [kind, setKind] = useState(entry?.kind ?? '')
  const [body, setBody] = useState(entry?.body ?? '')

  async function save() {
    if (!title.trim() && !body.trim()) return
    const now = Date.now()
    const data = {
      departmentId: dept?.id,
      title: title.trim() || (kind || 'Untitled'),
      kind: kind || undefined,
      body,
      updatedAt: now,
    }
    if (entry?.id != null) await db.texts.update(entry.id, data)
    else await db.texts.add({ ...data, createdAt: now })
    onDone()
  }

  async function del() {
    if (entry?.id != null) await db.texts.delete(entry.id)
    onDone()
  }

  const words = wordCount(body)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28, width: 620, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 16px' }}>
          {entry ? 'Edit text' : 'Add text'}
        </p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title" style={{ ...inp, flex: 2, fontSize: 14 }} />
          <select value={kind} onChange={e => setKind(e.target.value)} aria-label="Kind" style={{ ...inp, flex: 1, color: kind ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>
            <option value="">Kind…</option>
            {kinds.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <textarea value={body} onChange={e => setBody(e.target.value)} rows={14} placeholder="The text itself" aria-label="The text itself"
          style={{ ...inp, resize: 'vertical', lineHeight: 1.6, fontSize: 13, marginBottom: 8 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--wa-muted)' }}>{words} {words === 1 ? 'word' : 'words'}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>{entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Profile() {
  const dept = useActiveDept()
  const deptId = dept?.id
  const texts = useLiveQuery(() => deptId == null ? [] : db.texts.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const [editing, setEditing] = useState<TextEntry | null | 'new'>(null)
  const { copied, failed, copy } = useCopy()

  const sorted = [...texts].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
  const firstKind = textKinds(dept)[0] ?? 'Bio'

  return (
    <Shell>
      {editing != null && <TextForm entry={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}

      <CareerFrame active="profile" right={<AddButton onClick={() => setEditing('new')} label="+ Add text" />}>
        <Identity />

        {sorted.length === 0 ? (
          <div style={{ padding: '56px 20px', textAlign: 'center', color: 'var(--wa-muted)', fontSize: 13, fontStyle: 'italic', textWrap: 'pretty' }}>
            No {firstKind.toLowerCase()} yet
          </div>
        ) : (
          <div>
            {sorted.map((t, i) => {
              const words = wordCount(t.body)
              const preview = t.body.trim().replace(/\s+/g, ' ')
              return (
                <div key={t.id} onClick={() => setEditing(t)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < sorted.length - 1 ? '1px solid var(--wa-line)' : 'none', cursor: 'pointer' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--wa-text-2)', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {preview || 'Empty'}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ fontSize: 10, color: 'var(--wa-muted)' }}>{words}w</span>
                    {t.kind && (
                      <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: KIND_COLOR[t.kind] ?? 'var(--wa-fill)', color: KIND_COLOR[t.kind] ? '#333333' : 'var(--wa-text)', padding: '3px 7px', borderRadius: 5 }}>
                        {t.kind}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); copy(String(t.id), t.body) }} disabled={!t.body.trim()}
                      style={{ ...quietButton, minWidth: 64, opacity: t.body.trim() ? 1 : 0.5 }}>
                      {copied === String(t.id) ? 'Copied' : failed === String(t.id) ? 'Failed' : 'Copy'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CareerFrame>
    </Shell>
  )
}
