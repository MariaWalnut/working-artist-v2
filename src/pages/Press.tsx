import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity, type PressEntry, type Work } from '../db/db'
import { PracticeSelect } from '../components/Practice'
import { practiceOf, usePractice } from '../lib/practice'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { fileToDataUrl, readRaw } from '../lib/images'
import { ClippingViewer, isPdf } from '../components/ClippingViewer'
import { pdfThumbnail } from '../lib/pdfThumb'
import { CareerFrame } from '../components/CareerTabs'
import { AddButton } from '../components/PageFrame'
import { FrameTabs } from '../components/FrameHeader'
import { DateFields } from '../components/DateFields'
import { formatAnyDate, normalizeDate } from '../lib/eventDates'

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

type Section = 'press' | 'award'
const sectionOf = (e: PressEntry): Section => e.category === 'award' ? 'award' : 'press'

const PRESS_TYPES = ['Interview', 'Feature', 'Selection', 'Review', 'Mention', 'Profile']
const AWARD_TYPES = ['Award', 'Prize', 'Shortlist', 'Nomination', 'Grant', 'Fellowship', 'Honour']
const TYPES: Record<Section, string[]> = { press: PRESS_TYPES, award: AWARD_TYPES }
const SECTION_LABEL: Record<Section, string> = { press: 'Press', award: 'Awards' }

const TYPE_COLOR: Record<string, string> = {
  Interview: '#E8D4F0',
  Feature: '#D4E8F0',
  Selection: '#D4F0E4',
  Review: '#F0EAD4',
  Mention: '#F0F0F0',
  Profile: '#F0D4D4',
  Award: '#F3E7B8',
  Prize: '#F3E7B8',
  Shortlist: '#EDEDED',
  Nomination: '#EDEDED',
  Grant: '#DCEBDD',
  Fellowship: '#DCEBDD',
  Honour: '#F3E7B8',
}

// ─── Clippings ───────────────────────────────────────────────────────────────

type Clipping = { data: string; name: string; thumb?: string }
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
  if (file.type === 'application/pdf') {
    const data = await readRaw(file)
    return { data, name: file.name, thumb: (await pdfThumbnail(data)) ?? undefined }
  }
  return { data: await fileToDataUrl(file, 2400), name: file.name }
}

function ClippingThumb({ data, thumb, label, onOpen, size = 36 }: { data: string; thumb?: string; label: string; onOpen: () => void; size?: number }) {
  const pdf = isPdf(data)
  const preview = pdf ? thumb : data
  return (
    <button onClick={e => { e.stopPropagation(); onOpen() }} aria-label={`View clipping: ${label}`}
      style={{ position: 'relative', width: size, height: Math.round(size * 1.28), flexShrink: 0, padding: 0, border: '1px solid var(--wa-line)', borderRadius: 5, overflow: 'hidden', background: 'var(--wa-fill-2)', cursor: 'zoom-in', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {preview
        ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
        : <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--wa-muted)', letterSpacing: '0.08em' }}>PDF</span>}
      {pdf && preview && (
        <span style={{ position: 'absolute', right: 2, bottom: 2, fontSize: 6, fontWeight: 700, letterSpacing: '0.06em', color: '#FFFFFF', background: 'rgba(17,17,17,.7)', borderRadius: 2, padding: '1px 2px' }}>PDF</span>
      )}
    </button>
  )
}

// ─── Form ────────────────────────────────────────────────────────────────────

function PressForm({ entry, section, initialClipping, works, allWorks, onDone }: { entry: PressEntry | null; section: Section; initialClipping?: Clipping | null; works: Array<{ id?: number; title: string }>; allWorks: Work[]; onDone: () => void }) {
  const dept = useActiveDept()
  const { acts, start } = usePractice()
  const [practice, setPractice] = useState<Activity | undefined>(entry ? entry.practice : start)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [type, setType] = useState(entry?.type ?? '')
  const [outlet, setOutlet] = useState(entry?.outlet ?? '')
  const [date, setDate] = useState(normalizeDate(entry?.date) ?? '')
  const unreadableDate = entry?.date && !normalizeDate(entry.date) ? entry.date : null
  const [url, setUrl] = useState(entry?.url ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [workId, setWorkId] = useState<number | undefined>(entry?.workId)
  const [category, setCategory] = useState<Section>(entry ? sectionOf(entry) : section)
  const [clipping, setClipping] = useState<Clipping | null>(
    entry?.clipping ? { data: entry.clipping, name: entry.clippingName ?? 'Clipping', thumb: entry.clippingThumb } : initialClipping ?? null,
  )
  const award = category === 'award'
  const [over, setOver] = useState(false)
  const [viewing, setViewing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function take(file?: File) {
    if (!file) return
    const c = await readClipping(file)
    if (c) setClipping(c)
  }

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill-2)', padding: '8px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%' }

  async function save() {
    if (!title.trim()) return
    const data: PressEntry = { departmentId: dept?.id, title: title.trim(), type: type || undefined, outlet: outlet.trim() || undefined, date: date || (unreadableDate ?? undefined), url: url.trim() || undefined, notes: notes.trim() || undefined, workId, practice, category, clipping: clipping?.data, clippingName: clipping?.name, clippingThumb: clipping?.thumb }
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
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28, width: 480, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 16px' }}>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: 0 }}>
            {entry ? (award ? 'Edit award' : 'Edit press item') : (award ? 'Add award' : 'Add press')}
          </p>
          <div role="group" aria-label="Kind" style={{ display: 'flex', background: 'var(--wa-fill)', borderRadius: 999, padding: 2 }}>
            {(['press', 'award'] as Section[]).map(c => (
              <button key={c} type="button" onClick={() => { setCategory(c); if (type && !TYPES[c].includes(type)) setType('') }} aria-pressed={category === c}
                style={{ border: 'none', borderRadius: 999, padding: '4px 10px', fontSize: 10, cursor: 'pointer', background: category === c ? 'var(--wa-surface)' : 'transparent', color: category === c ? 'var(--wa-ink)' : 'var(--wa-text-2)', fontWeight: category === c ? 600 : 400, boxShadow: category === c ? '0 1px 3px rgba(0,0,0,.08)' : 'none' }}>
                {c === 'press' ? 'Press' : 'Award'}
              </button>
            ))}
          </div>
        </div>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder={award ? 'Award or recognition' : 'Headline'} aria-label={award ? 'Award or recognition' : 'Headline'} style={{ ...inp, marginBottom: 10, fontSize: 14 }} />

        <input value={outlet} onChange={e => setOutlet(e.target.value)} placeholder={award ? 'Awarded by' : 'Outlet'} aria-label={award ? 'Awarded by' : 'Outlet'} style={{ ...inp, marginBottom: 12 }} />

        <DateFields label="Date" value={date} onChange={setDate} inp={inp} />
        {unreadableDate && !date && (
          <p style={{ fontSize: 10, color: 'var(--wa-amber)', margin: '-4px 0 10px' }}>Previously typed as “{unreadableDate}”. Pick the date above to replace it.</p>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <select value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1, color: type ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>
            <option value="">Type…</option>
            {TYPES[category].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={workId ?? ''} onChange={e => setWorkId(e.target.value ? Number(e.target.value) : undefined)} style={{ ...inp, flex: 1, color: workId ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>
            <option value="">Work…</option>
            {works.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </div>

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" style={{ ...inp, marginBottom: 10 }} />
        <PracticeSelect value={practice ?? practiceOf(acts, allWorks).press({ workId })} onChange={setPractice} style={{ ...inp, marginBottom: 10 }} />

        <div
          onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); setOver(true) } }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files[0]) }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, marginBottom: 10, borderRadius: 10, border: `1.5px dashed ${over ? '#D9C400' : '#E3E3E3'}`, background: over ? '#FFFBE0' : 'var(--wa-fill-2)' }}>
          <input ref={fileRef} type="file" accept={CLIPPING_ACCEPT} hidden onChange={e => { void take(e.target.files?.[0]); e.target.value = '' }} />
          {clipping ? (
            <>
              <ClippingThumb data={clipping.data} thumb={clipping.thumb} label={clipping.name} onOpen={() => setViewing(true)} />
              <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: 'var(--wa-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clipping.name}</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Replace</button>
              <button type="button" onClick={() => setClipping(null)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Remove</button>
            </>
          ) : (
            <>
              <span style={{ flex: 1, fontSize: 11, color: 'var(--wa-muted)' }}>{award ? 'Drop a certificate or photo here, image or PDF' : 'Drop a clipping here, image or PDF'}</span>
              <button type="button" onClick={() => fileRef.current?.click()} style={{ background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', borderRadius: 8, padding: '6px 12px', fontSize: 11, color: 'var(--wa-text)', cursor: 'pointer' }}>Choose file</button>
            </>
          )}
        </div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2} style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Delete</button>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Press() {
  const dept = useActiveDept()
  const deptId = dept?.id

  const { acts, keep } = usePractice()
  const allEntries = useLiveQuery(() => deptId == null ? [] : db.pressEntries.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const allWorks = useLiveQuery(() => deptId == null ? [] : db.works.where('departmentId').equals(deptId).toArray(), [deptId]) ?? []
  const of = practiceOf(acts, allWorks)
  const entries = allEntries.filter(e => keep(of.press(e)))
  const works = allWorks.filter(w => keep(of.work(w)))

  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [section, setSection] = useState<Section>('press')
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

  // PDFs added before previews existed get their first-page preview now, one at a time.
  const missingThumb = entries.find(e => isPdf(e.clipping) && !e.clippingThumb)
  useEffect(() => {
    if (!missingThumb?.id || !missingThumb.clipping) return
    const id = missingThumb.id
    void pdfThumbnail(missingThumb.clipping).then(thumb => db.pressEntries.update(id, { clippingThumb: thumb ?? '' }))
  }, [missingThumb?.id, missingThumb?.clipping])

  const inSection = entries.filter(e => sectionOf(e) === section)
  const sorted = [...inSection].sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')))
  const filtered = typeFilter ? sorted.filter(e => e.type === typeFilter) : sorted

  const usedTypes = [...new Set(inSection.map(e => e.type).filter(Boolean))] as string[]
  const counts: Record<Section, number> = { press: entries.filter(e => sectionOf(e) === 'press').length, award: entries.filter(e => sectionOf(e) === 'award').length }
  const anyClipping = filtered.some(e => e.clipping)

  return (
    <Shell>
      {editing != null && (
        <PressForm
          entry={editing === 'new' ? null : editing}
          section={section}
          initialClipping={editing === 'new' ? newClipping : null}
          works={works}
          allWorks={allWorks}
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

      <CareerFrame active="recognition" right={
        <div style={{ display: 'flex', gap: 8 }}>
          {entries.length === 0 && (
            <button onClick={() => void handleImportV1()}
              disabled={importing === 'loading'}
              style={{ background: 'var(--wa-fill)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, color: importing === 'done' ? 'var(--wa-text-2)' : 'var(--wa-text-2)', cursor: 'pointer' }}>
              {importing === 'loading' ? 'Importing…' : importing === 'done' ? `✓ ${importCount} imported` : importing === 'error' ? 'Nothing found in v1' : 'Import from v1'}
            </button>
          )}
          <input ref={importRef} type="file" accept={CLIPPING_ACCEPT} hidden onChange={e => { void startNewWith(e.target.files?.[0]); e.target.value = '' }} />
          <button onClick={() => importRef.current?.click()} style={{ background: 'var(--wa-fill)', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, color: 'var(--wa-text)', cursor: 'pointer' }}>Import file</button>
          <AddButton onClick={() => setEditing('new')} />
        </div>
      }>

      {/* Press / Awards switch and type filter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderBottom: '1px solid var(--wa-line)', flexWrap: 'wrap' }}>
        <FrameTabs label="Press and awards" active={section}
          tabs={(['press', 'award'] as Section[]).map(sct => ({ key: sct, label: SECTION_LABEL[sct], count: counts[sct] }))}
          onSelect={sct => { setSection(sct); setTypeFilter(null) }} />
        {usedTypes.length > 0 && (
          <>
            <div style={{ width: 1, height: 18, background: 'var(--wa-line)' }} />
            <button onClick={() => setTypeFilter(null)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === null ? 'var(--wa-ink)' : 'var(--wa-fill)', color: typeFilter === null ? 'var(--wa-surface)' : 'var(--wa-text-2)' }}>All</button>
            {usedTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(typeFilter === t ? null : t)} style={{ padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, cursor: 'pointer', background: typeFilter === t ? 'var(--wa-ink)' : 'var(--wa-fill)', color: typeFilter === t ? 'var(--wa-surface)' : 'var(--wa-text-2)' }}>
                {t}
              </button>
            ))}
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--wa-muted)', fontSize: 13, fontStyle: 'italic' }}>
          {inSection.length > 0 ? 'Nothing matches this filter.'
            : section === 'award' ? 'No awards yet. Drop a certificate or photo here to start.'
            : 'No press items yet. Drop a clipping here to start.'}
        </div>
      ) : (
        <div>
          {filtered.map((p, i) => {
            const work = p.workId ? allWorks.find(w => w.id === p.workId) : null
            return (
              <div key={p.id} data-press-id={p.id} data-tour-title={p.title} onClick={() => setEditing(p)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--wa-line)' : 'none', cursor: 'pointer', background: dropRow === p.id ? '#FFFBE0' : undefined, boxShadow: dropRow === p.id ? 'inset 0 0 0 1.5px #E8D600' : undefined }}>

                {anyClipping && (
                  p.clipping
                    ? <ClippingThumb data={p.clipping} thumb={p.clippingThumb} label={p.title} onOpen={() => setViewing(p)} />
                    : <div aria-hidden="true" style={{ width: 36, height: 46, flexShrink: 0, borderRadius: 5, border: '1px dashed var(--wa-line)' }} />
                )}

                {/* Date */}
                <div style={{ width: 84, flexShrink: 0, fontSize: 10, color: 'var(--wa-muted)', fontWeight: 500 }}>
                  {formatAnyDate(p.date)}
                </div>

                {/* Main */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>
                    {[p.outlet, work?.title].filter(Boolean).join(' · ')}
                  </div>
                </div>

                {/* Right: type badge + link */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  {p.type && (
                    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', background: TYPE_COLOR[p.type] ?? 'var(--wa-fill)', color: TYPE_COLOR[p.type] ? '#333333' : 'var(--wa-text)', padding: '3px 7px', borderRadius: 5 }}>
                      {p.type}
                    </span>
                  )}
                  {p.url && (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      style={{ fontSize: 12, color: 'var(--wa-muted)', textDecoration: 'none' }} title="Open link">↗</a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      </CareerFrame>
      </div>

      {dragging && (
        <div aria-live="polite" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: 'var(--wa-black)', color: '#FFFFFF', borderRadius: 999, padding: '10px 18px', fontSize: 12, boxShadow: '0 6px 24px rgba(0,0,0,.2)', pointerEvents: 'none', whiteSpace: 'nowrap' }}>
          {dropRow != null ? 'Drop to attach to this item' : section === 'award' ? 'Drop to add a new award' : 'Drop to add a new press item'}
        </div>
      )}
    </Shell>
  )
}
