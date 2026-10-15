import type { Table } from 'dexie'
import type { Book, PressEntry, Release, Work } from '../db/db'
import { formatAnyDate, normalizeDate } from './eventDates'

export const WORK_KINDS = ['Artwork', 'Illustration', 'Book', 'Release', 'Other'] as const
export type WorkKind = typeof WORK_KINDS[number]

export const kindOf = (w: Pick<Work, 'kind'>): WorkKind =>
  (WORK_KINDS as readonly string[]).includes(w.kind ?? '') ? (w.kind as WorkKind) : 'Artwork'

export type WorkField =
  | 'year' | 'month' | 'medium' | 'dimensions' | 'location' | 'collection'
  | 'subtitle' | 'publisher' | 'publishedDate' | 'isbn' | 'language' | 'credits' | 'pages' | 'technique'
  | 'format' | 'label'

export const NUMERIC_FIELDS: WorkField[] = ['year', 'month', 'pages']

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function fieldDisplay(key: WorkField, value: unknown, w?: Work) {
  if (key === 'year' && w?.month) return `${MONTH_NAMES[w.month - 1] ?? ''} ${String(value)}`.trim()
  if (key === 'month' && typeof value === 'number') return MONTH_NAMES[value - 1] ?? String(value)
  if (key === 'publishedDate') return formatAnyDate(value)
  return String(value)
}

// Kinds dated by their publication: their year and month always follow that date.
export const usesPublishedDate = (kind: WorkKind) => KIND_FIELDS[kind].some(f => f.key === 'publishedDate')

interface FieldSpec { key: WorkField; label: string; placeholder?: string }

const f = (key: WorkField, label: string, placeholder?: string): FieldSpec => ({ key, label, placeholder })

// Which details each kind of work asks for, in display order.
export const KIND_FIELDS: Record<WorkKind, FieldSpec[]> = {
  Artwork: [
    f('year', 'Date'), f('medium', 'Medium', 'Oil on linen'), f('dimensions', 'Dimensions', '120 × 90 cm'),
    f('location', 'Location', 'City or venue'), f('collection', 'Collection', 'Private collection'),
  ],
  Illustration: [
    f('publishedDate', 'Date'), f('publisher', 'Client or publication', 'The New Yorker'),
    f('medium', 'Medium', 'Gouache, digital'), f('dimensions', 'Dimensions'), f('location', 'Location', 'City'),
  ],
  Book: [
    f('subtitle', 'Subtitle'), f('publisher', 'Publisher'), f('publishedDate', 'Published'),
    f('isbn', 'ISBN', '978…'), f('language', 'Language', 'German'), f('credits', 'Credits', 'Text by…, illustrated by…'),
    f('pages', 'Pages', '32'), f('dimensions', 'Size', '24 × 30 cm'), f('technique', 'Technique', 'Gouache, pencil'),
    f('location', 'Location', 'City'),
  ],
  Release: [
    f('year', 'Date'), f('format', 'Format', 'Album, EP, single'), f('label', 'Label'), f('location', 'Location', 'City'),
  ],
  Other: [
    f('year', 'Date'), f('medium', 'Medium'), f('dimensions', 'Dimensions'), f('location', 'Location', 'City or venue'),
  ],
}

// One line under the title in lists: the most telling detail for that kind.
export function workSubtitle(w: Work) {
  switch (kindOf(w)) {
    case 'Book': return [w.subtitle, w.publisher].filter(Boolean).join(' · ')
    case 'Illustration': return [w.publisher, w.medium].filter(Boolean).join(' · ')
    case 'Release': return [w.format, w.label].filter(Boolean).join(' · ')
    default: return [w.medium, w.dimensions].filter(Boolean).join(' · ')
  }
}

export function workYear(w: Work) {
  const pub = normalizeDate(w.publishedDate)
  return (pub ? Number(pub.slice(0, 4)) : undefined) ?? w.year
}

// Books and releases used to live in their own tables. Copies them into works once (safe to run
// again, e.g. after restoring an older backup) and points book press at the new work. The old
// rows are left untouched as a fallback.
export async function migrateLegacyWorks(t: {
  works: Table<Work>
  books: Table<Book>
  releases: Table<Release>
  pressEntries: Table<PressEntry>
}) {
  const [works, books, releases] = await Promise.all([t.works.toArray(), t.books.toArray(), t.releases.toArray()])
  const doneBooks = new Map(works.filter(w => w.legacyBookId != null).map(w => [w.legacyBookId!, w.id!]))
  const doneReleases = new Set(works.filter(w => w.legacyReleaseId != null).map(w => w.legacyReleaseId!))

  for (const b of books) {
    if (b.id == null || doneBooks.has(b.id)) continue
    const id = await t.works.add({
      departmentId: b.departmentId, kind: 'Book', title: b.title, subtitle: b.subtitle, publisher: b.publisher,
      publishedDate: b.publishedDate, isbn: b.isbn, language: b.language, credits: b.credits, dimensions: b.dimensions,
      pages: b.pages, technique: b.technique, notes: b.notes, image: b.coverImage, press: b.press, rights: b.rights,
      year: b.publishedDate ? parseInt(b.publishedDate.slice(0, 4), 10) || undefined : undefined,
      legacyBookId: b.id,
    }) as number
    doneBooks.set(b.id, id)
  }
  for (const r of releases) {
    if (r.id == null || doneReleases.has(r.id)) continue
    await t.works.add({
      departmentId: r.departmentId, kind: 'Release', title: r.title, format: r.format, label: r.label,
      year: r.year, notes: r.notes, legacyReleaseId: r.id,
    })
  }
  await t.pressEntries.toCollection().modify(p => {
    if (p.bookId != null && doneBooks.has(p.bookId)) {
      p.workId = doneBooks.get(p.bookId)
      delete p.bookId
    }
  })
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

// Press dates are typed freely ("Oct 2024", "2024-10", "12.10.2024", "October 2024"). Returns [year, month or 0].
export function parseLooseDate(raw?: unknown): [number, number] | null {
  if (typeof raw === 'number') return Number.isInteger(raw) ? [raw, 0] : null
  if (typeof raw !== 'string' || !raw.trim()) return null
  const s = raw.trim().toLowerCase()
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (dmy) return [Number(dmy[3]), Number(dmy[2]) || 0]
  const ym = s.match(/^(\d{4})(?:[-/.](\d{1,2}))?/)
  if (ym) return [Number(ym[1]), Number(ym[2] ?? 0) || 0]
  const year = s.match(/\b(1[89]\d{2}|2\d{3})\b/)
  if (!year) return null
  const month = MONTH_KEYS.findIndex(m => s.includes(m)) + 1
  return [Number(year[1]), month]
}

// Press dates used to be typed freely. Converts every readable one to the menu format;
// anything unreadable is left exactly as typed. A row it can't handle is skipped, never fatal:
// this runs while the database opens, and a throw here would keep the whole app from loading.
export async function normalizePressDates(t: { works: Table<Work>; pressEntries: Table<PressEntry> }) {
  await t.pressEntries.toCollection().modify(p => {
    try {
      const n = normalizeDate(p.date)
      if (n && n !== p.date) p.date = n
    } catch { /* leave this row as it is */ }
  })
  await t.works.toCollection().modify(w => {
    try {
      if (!Array.isArray(w.press) || w.press.length === 0) return
      w.press = w.press.map(item => {
        if (!item || typeof item !== 'object') return item
        const n = normalizeDate(item.date)
        return n && n !== item.date ? { ...item, date: n } : item
      })
    } catch { /* leave this work as it is */ }
  })
}
