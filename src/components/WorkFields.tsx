import { useState } from 'react'
import type { Work } from '../db/db'
import { KIND_FIELDS, NUMERIC_FIELDS, WORK_KINDS, usesPublishedDate, type WorkField, type WorkKind } from '../lib/works'
import { normalizeDate } from '../lib/eventDates'
import { DateFields } from './DateFields'

export type FieldValues = Record<WorkField, string>

const ALL_FIELDS: WorkField[] = [
  'year', 'month', 'medium', 'dimensions', 'location', 'collection', 'subtitle', 'publisher', 'publishedDate',
  'isbn', 'language', 'credits', 'pages', 'technique', 'format', 'label',
]

export function fieldsFromWork(w: Partial<Work> | null): FieldValues {
  return Object.fromEntries(ALL_FIELDS.map(k => [k, w?.[k] != null ? String(w[k]) : ''])) as FieldValues
}

// Every field is written back, so details from a previous kind survive a kind change.
export function fieldsToPatch(v: FieldValues, kind: WorkKind): Partial<Work> {
  const patch: Record<string, string | number | undefined> = {}
  for (const k of ALL_FIELDS) {
    const raw = v[k].trim()
    if (NUMERIC_FIELDS.includes(k)) {
      const n = Number(raw)
      patch[k] = raw && Number.isFinite(n) ? n : undefined
    } else {
      patch[k] = raw || undefined
    }
  }
  // A published work is dated by its publication, so a stale year can never contradict it.
  const pub = normalizeDate(v.publishedDate)
  if (pub) patch.publishedDate = pub
  if (usesPublishedDate(kind) && pub) {
    patch.year = Number(pub.slice(0, 4))
    patch.month = pub.length >= 7 ? Number(pub.slice(5, 7)) : undefined
  }
  return patch as Partial<Work>
}

const ISO_LANG: Record<string, string> = {
  eng: 'English', ger: 'German', fre: 'French', spa: 'Spanish', ita: 'Italian', por: 'Portuguese', dut: 'Dutch',
  jpn: 'Japanese', chi: 'Chinese', kor: 'Korean', rus: 'Russian', pol: 'Polish', swe: 'Swedish', dan: 'Danish',
  fin: 'Finnish', nor: 'Norwegian', tur: 'Turkish', ara: 'Arabic', heb: 'Hebrew', cze: 'Czech', cat: 'Catalan',
}

export interface IsbnResult { title?: string; image?: string; fields: Partial<FieldValues> }

async function lookupIsbn(isbn: string): Promise<IsbnResult | null> {
  const q = isbn.replace(/[^0-9Xx]/g, '')
  const res = await fetch(`https://openlibrary.org/search.json?isbn=${q}&fields=title,publisher,publish_date,language,author_name,cover_i`)
  const data = await res.json() as { docs?: Array<Record<string, unknown>> }
  const doc = data.docs?.[0]
  if (!doc) return null
  const first = (v: unknown) => (Array.isArray(v) && typeof v[0] === 'string' ? v[0] as string : undefined)
  const fields: Partial<FieldValues> = {}
  const publisher = first(doc.publisher)
  if (publisher) fields.publisher = publisher
  const date = first(doc.publish_date)
  const pubDate = date ? normalizeDate(date) : undefined
  if (pubDate) fields.publishedDate = pubDate
  const lang = first(doc.language)
  if (lang) fields.language = ISO_LANG[lang] ?? lang
  if (Array.isArray(doc.author_name) && doc.author_name.length) fields.credits = (doc.author_name as string[]).join(', ')
  return {
    title: typeof doc.title === 'string' ? doc.title : undefined,
    image: typeof doc.cover_i === 'number' ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : undefined,
    fields,
  }
}

const label: React.CSSProperties = { fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }

export function KindSelect({ value, onChange, style }: { value: WorkKind; onChange: (k: WorkKind) => void; style: React.CSSProperties }) {
  return (
    <label>
      <span style={label}>Kind</span>
      <select value={value} onChange={e => onChange(e.target.value as WorkKind)} style={style}>
        {WORK_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
      </select>
    </label>
  )
}

export function WorkFields({ kind, values, onChange, onIsbnFound, inp, columns = 1 }: {
  kind: WorkKind
  values: FieldValues
  onChange: (v: FieldValues) => void
  onIsbnFound?: (r: IsbnResult) => void
  inp: React.CSSProperties
  columns?: number
}) {
  const [lookup, setLookup] = useState<'idle' | 'loading' | 'notfound' | 'error'>('idle')
  const isbnReady = values.isbn.replace(/[^0-9Xx]/g, '').length >= 10

  async function runLookup() {
    setLookup('loading')
    try {
      const r = await lookupIsbn(values.isbn)
      if (!r) { setLookup('notfound'); return }
      // Only fill what is still empty, so nothing typed by hand is overwritten.
      const next = { ...values }
      for (const [k, v] of Object.entries(r.fields) as Array<[WorkField, string]>) if (!next[k]) next[k] = v
      onChange(next)
      onIsbnFound?.(r)
      setLookup('idle')
    } catch {
      setLookup('error')
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: 10 }}>
      {KIND_FIELDS[kind].map(f => f.key === 'year' ? (
        <div key={f.key} style={{ gridColumn: '1 / -1' }}>
          <DateFields label={f.label} showDay={false} inp={inp}
            value={values.year ? (values.month ? `${values.year}-${values.month.padStart(2, '0')}` : values.year) : ''}
            onChange={v => {
              const [y, m] = v ? v.split('-') : []
              onChange({ ...values, year: y ?? '', month: m ? String(Number(m)) : '' })
            }} />
        </div>
      ) : f.key === 'publishedDate' ? (
        <div key={f.key} style={{ gridColumn: '1 / -1' }}>
          <DateFields label={f.label} inp={inp}
            value={normalizeDate(values.publishedDate) ?? ''}
            onChange={v => onChange({ ...values, publishedDate: v })} />
          {values.publishedDate && !normalizeDate(values.publishedDate) && (
            <p style={{ fontSize: 10, color: '#A86400', margin: '-4px 0 0' }}>Previously typed as “{values.publishedDate}”. Pick the date above to replace it.</p>
          )}
        </div>
      ) : (
        <label key={f.key}>
          <span style={label}>{f.label}</span>
          {f.key === 'isbn' ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input value={values.isbn} onChange={e => { onChange({ ...values, isbn: e.target.value }); setLookup('idle') }}
                placeholder={f.placeholder} style={{ ...inp, flex: 1, minWidth: 0 }} />
              <button type="button" onClick={() => void runLookup()} disabled={!isbnReady || lookup === 'loading'}
                style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '0 10px', fontSize: 10, fontWeight: 600, color: '#555555', cursor: isbnReady ? 'pointer' : 'default', opacity: isbnReady ? 1 : 0.45, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                {lookup === 'loading' ? '…' : lookup === 'notfound' ? 'Not found' : lookup === 'error' ? 'Error' : 'Look up'}
              </button>
            </div>
          ) : (
            <input value={values[f.key]} onChange={e => onChange({ ...values, [f.key]: e.target.value })}
              placeholder={f.placeholder} inputMode={NUMERIC_FIELDS.includes(f.key) ? 'numeric' : undefined} style={inp} />
          )}
        </label>
      ))}
    </div>
  )
}
