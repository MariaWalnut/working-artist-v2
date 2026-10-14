import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PressEntry } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { fileToDataUrl, readRaw } from '../lib/images'
import { ClippingViewer, isPdf } from '../components/ClippingViewer'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

async function importPressFromV1(deptId?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('working-artist')
    req.onerror = () => reject(new Error('Could not open v1 database'))
    req.onsuccess = () => {
      const v1db = req.result
      if (!Array.from(v1db.objectStoreNames).includes('press')) { v1db.close(); resolve(0); return }
      const tx = v1db.transaction('press', 'readonly')
      const getAll = tx.objectStore('press').getAll() as IDBRequest<Array<{ id?: number; departmentId?: number; title: string; type?: string; outlet?: string; link?: string; year?: number; month?: number; notes?: string }>>
      getAll.onsuccess = async () => {
        v1db.close()
        const entries: PressEntry[] = getAll.result.map(r => ({
          departmentId: deptId ?? r.departmentId,
          title: r.title,
          type: r.type,
          outlet: r.outlet,
          date: r.year ? (r.month ? `${MONTH_SHORT[(r.month - 1) % 12]} ${r.year}` : String(r.year)) : undefined,
          url: r.link,
          notes: r.notes,
        }))
        await db.pressEntries.bulkAdd(entries)
        resolve(entries.length)
      }
      getAll.onerror = () => { v1db.close(); reject(getAll.error) }
    }
  })
}

const PRESS_TYPES = ['Interview', 'Feature', 'Selection', 'Review', 'Mention', 'Profile']

const TYPE_COLOR: Record<string, string> = {
  Interview: '#E8D4F0',
  Feature: '#D4E8F0',
  Selection: '#D4F0E4',
  Review: '#F0EAD4',
  Mention: '#F0F0F0',
  Profile: '#F0D4D4',
}

// ─── Clippings ───────────────────────────────────────────────────────────────

type Clipping = { data: string; name: string }
const CLIPPING_ACCEPT = 'image/*,application/pdf'
const MAX_CLIPPING_BYTES = 20 * 1024 * 1024
const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes('Files')

// Images are scaled down but kept large enough to read the text of a clipping.
async function readClipping(file: File): Promise<Clipping | null> {
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    window.alert('A clipping can be an image or a PDF.')
    return null
  }
  if (file.size > MAX_CLIPPING_BYTES) {
    window.alert('That file is over 20 MB. Try a smaller scan or export.')
    return null
  }
  const data = file.type === 'application/pdf' ? await readRaw(file) : await fileToDataUrl(file, 2400)
  return { data, name: file.name }
}

function ClippingThumb({ data, label, onOpen, size = 36 }: { data: string; label: string; onOpen: () => void; size?: number }) {
  return (
    <button onClick={e => { e.stopPropagation(); onOpen() }} aria-label={`View clipping: ${label}`}
      style={{ width: size, height: Math.round(size * 1.28), flexShrink: 0, padding: 0, border: '1px solid #EEEEEE', borderRadius: 5, overflow: 'hidden', background: '#F7F7F7', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {isPdf(data)
        ? <span style={{ fontSize: 8, fontWeight: 700, color: '#999999', letterSpacing: '0.08em' }}>PDF</span>
        : <img src={data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </button>
  )
}

// ─── Form ────────────────────────────────────────────────────────────────────

function PressForm({ entry, initialClipping, works, onDone }: { entry: PressEntry | null; initialClipping?: Clipping | null; works: Array<{ id?: number; title: string }>; onDone: () => void }) {
  const dept = useActiveDept()
  const [title, setTitle] = useState(entry?.title ?? '')
  const [type, setType] = useState(entry?.type ?? '')
  const [outlet, setOutlet] = useState(entry?.outlet ?? '')
  const [date, setDate] = useState(entry?.date ?? '')
  const [url, setUrl] = useState(entry?.url ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [workId, setWorkId] = useState<number | undefined>(entry?.workId)
  const [clipping, setClipping] = useState<Clipping | null>(
    entry?.clipping ? { data: entry.clipping, name: entry.clippingName ?? 'Clipping' } : initialClipping ?? null,
  )
  const [over, setOver] = useState(false)
  const [viewing, setViewing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function take(file?: File) {
    if (!file) return
    const c = await readClipping(file)
    if (c) setClipping(c)
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F9F9F9', padding: '8px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%' }

  async function save() {
    if (!title.trim()) return
    const data: PressEntry = { departmentId: dept?.id, title: title.trim(), type: type || undefined, outlet: outlet.trim() || undefined, date: date.trim() || undefined, url: url.trim() || undefined, notes: notes.trim() || undefined, workId, clipping: clipping?.data, clippingName: clipping?.name }
    if (entry?.id != null) await db.pressEntries.update(entry.id, data)
    else await db.pressEntries.add(data)
    onDone()
  }

  async function del() {
    if (entry?.id != null) await db.pressEntries.delete(entry.id)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      {viewing && clipping && <ClippingViewer entry={{ title: title || clipping.name, outlet, date, url, clipping: clipping.data, clippingName: clipping.name }} onClose={() => setViewing(false)} />}
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 28, width: 480, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 16px' }}>{entry ? 'Edit press item' : 'Add press'}</p>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Headline" style={{ ...inp, marginBottom: 10, fontSize: 14 }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <input value={outlet} onChange={e => setOutlet(e.target.value)} placeholder="Outlet" style={{ ...inp, flex: 2 }} />
          <input value={date} onChange={e => setDate(e.target.value)} placeholder="Date (e.g. Oct 2024)" style={{ ...inp, flex: 1 }} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1, color: type ? '#111111' : '#999999' }}>
            <option value="">Type…</option>
            {PRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={workId ?? ''} onChange={e => setWorkId(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, flex: 1, color: workId ? '#111111' : '#999999' }}>
            <option value="">Work…</option>
            {works.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </div>

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={{ ...inp, marginBottom: 10 }} />

        <div
          onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); setOver(true) } }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 10, borderRadius: 10, border: `1.5px dashed ${over ? '#D9C400' : '#E3E3E3'}`, background: over ? '#FFFBE0' : '#FAFAFA' }}>
          <input ref={fileRef} type="file" accept={CLIPPING_ACCEPT} hidden onChange={e => { void take(e.target.files?.[0]); e.target.value = '' }} />
          {clipping ? (
            <>
              <ClippingThumb data={clipping.data} label={clipping.name} onOpen={() => setViewing(true)} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: '#555555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clipping.name}</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', fontSize: 11, color: '#888888', cursor: 'pointer' }}>Replace</button>
              <button type="button" onClick={() => setClipping(null)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#BBBBBB', cursor: 'pointer' }}>Remove</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 11, color: '#999999' }}>Drop a clipping here, image or PDF</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ background: '#FFFFFF', border: '1px solid #E5E5E5', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#555555', cursor: 'pointer' }}>Choose file</button>
            </>
          )}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: '#CCCCCC', cursor: 'pointer' }}>Delete</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: '#888888', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Press() {
  const dept = useActiveDept()
  const deptId = dept?.id

  const entries = useLiveQuery(() => deptId == null ? [] : db.pressEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const works = useLiveQuery(() => deptId == null ? [] : db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []

  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<PressEntry | null | 'new'>(null)
  const [newClipping, setNewClipping] = useState<Clipping | null>(null)
  const [viewing, setViewing] = useState<PressEntry | null>(null)
  const [dragging, setDragging] = useState(false)
  const [dropRow, setDropRow] = useState<number | null>(null)
  const dragDepth = useRef(0)
  const importRef = useRef<HTMLInputElement>(null)

  // A file dropped beside the drop area would otherwise open in the browser and leave the app.
  useEffect(() => {
    const block = (e: DragEvent) => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault() }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => { window.removeEventListener('dragover', block); window.removeEventListener('drop', block) }
  }, [])

  const rowIdAt = (t: EventTarget) => {
    const el = (t as HTMLElement).closest?.('[data-press-id]')
    return el ? Number(el.getAttribute('data-press-id')) : null
  }

  function endDrag() {
    dragDepth.current = 0
    setDragging(false)
    setDropRow(null)
  }

  async function startNewWith(file?: File) {
    if (!file) return
    const c = await readClipping(file)
    if (!c) return
    setNewClipping(c)
    setEditing('new')
  }

  async function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    const rowId = rowIdAt(e.target)
    endDrag()
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (rowId != null) {
      const c = await readClipping(file)
      if (c) await db.pressEntries.update(rowId, { clipping: c.data, clippingName: c.name })
    } else {
      await startNewWith(file)
    }
  }
  const [importing, setImporting] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [importCount, setImportCount] = useState(0)

  async function handleImportV1() {
    setImporting('loading')
    try {
      const n = await importPressFromV1(dept?.id)
      setImportCount(n)
      setImporting(n > 0 ? 'done' : 'error')
    } catch {
      setImporting('error')
    }
  }

  const sorted = [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  const filtered = typeFilter ? sorted.filter(e => e.type === typeFilter) : sorted

  const usedTypes = [...new Set(entries.map(e => e.type).filter(Boolean))] as string[]
  const anyClipping = filtered.some(e => e.clipping)

  return (
    <Shell>
      {editing != null && (
        <PressForm
          entry={editing === 'new' ? null : editing}
          initialClipping={editing === 'new' ? newClipping : null}
          works={works}
          onDone={() => { setEditing(null); setNewClipping(null) }}
        />
      )}
      {viewing && <ClippingViewer entry={viewing} onClose={() => setViewing(null)} />}

      <div
        onDragEnter={e => { if (!hasFiles(e) || editing) return; e.preventDefault(); dragDepth.current++; setDragging(true) }}
        onDragOver={e => { if (!hasFiles(e) || editing) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDropRow(rowIdAt(e.target)) }}
        onDragLeave={e => { if (!hasFiles(e) || editing) return; dragDepth.current--; if (dragDepth.current <= 0) endDrag() }}
        onDrop={e => void onDrop(e)}
        style={{ minHeight: '70vh' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 24, fontWeight: 400, margin: 0, color: '#111111' }}>Press</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {entries.length === 0 && (
            <button onClick={() => void handleImportV1()}
              disabled={importing === 'loading'}
              style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, color: importing === 'done' ? '#888888' : '#666666', cursor: 'pointer' }}>
              {importing === 'loading' ? 'Importing…' : importing === 'done' ? `✓ ${importCount} imported` : importing === 'error' ? 'Nothing found in v1' : 'Import from v1'}
            </button>
          )}
          <input ref={importRef} type="file" accept={CLIPPING_ACCEPT} hidden onChange={e => { void startNewWith(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => importRef.current?.click()} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, color: '#555555', cursor: 'pointer' }}>Import file</button>
          <button onClick={() => setEditing('new')} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>+ Add</button>
        </div>
      </div>

      {/* Type filter */}
      {usedTypes.length > 0 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => setTypeFilter(null)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === null ? '#111111' : '#F5F5F5', color: typeFilter === null ? '#FFFFFF' : '#888888' }}>All</button>
          {usedTypes.map(t => (
            <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === t ? '#111111' : '#F5F5F5', color: typeFilter === t ? '#FFFFFF' : '#888888' }}>
              {t}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '64px 0', textAlign: 'center', color: '#CCCCCC', fontSize: 13, fontStyle: 'italic' }}>
          {entries.length === 0 ? 'No press items yet. Drop a clipping here to start.' : 'Nothing matches this filter.'}
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          {filtered.map((p, i) => {
            const work = p.workId ? works.find(w => w.id === p.workId) : null
            return (
              <div key={p.id} data-press-id={p.id} onClick={() => setEditing(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid #F5F5F5' : 'none', cursor: 'pointer', background: dropRow === p.id ? '#FFFBE0' : undefined, boxShadow: dropRow === p.id ? 'inset 0 0 0 1.5px #E8D600' : undefined }}>

                {anyClipping && (
                  p.clipping
                    ? <ClippingThumb data={p.clipping} label={p.title} onOpen={() => setViewing(p)} />
                    : <div aria-hidden="true" style={{ width: 36, height: 46, flexShrink: 0, borderRadius: 5, border: '1px dashed #EEEEEE' }} />
                )}

                {/* Date */}
                <div style={{ width: 70, flexShrink: 0, fontSize: 10, color: '#CCCCCC', fontWeight: 500 }}>
                  {p.date ?? ''}
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 10, color: '#AAAAAA', marginTop: 2 }}>
                    {[p.outlet, work?.title].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {/* Right: type badge + link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {p.type && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: TYPE_COLOR[p.type] ?? '#F5F5F5', color: '#555555', padding: '3px 7px', borderRadius: 5 }}>
                      {p.type}
                    </span>
                  )}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 12, color: '#AAAAAA', textDecoration: 'none' }} title="Open link">↗</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </div>

      {dragging && (
        <div aria-live="polite" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: '#111111', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px', fontSize: 12, boxShadow: '0 6px 24px rgba(0,0,0,.2)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {dropRow != null ? 'Drop to attach to this item' : 'Drop to add a new press item'}
        </div>
      )}
    </Shell>
  )
}
