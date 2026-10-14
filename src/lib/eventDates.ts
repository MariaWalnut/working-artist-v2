import type { EventEntry } from '../db/db'

// Event dates are 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'; endDate is optional and uses the same shapes.

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function isUpcoming(e: EventEntry, month = currentMonth()) {
  const last = e.endDate ?? e.date
  return !!last && last.slice(0, 7) >= month
}

const today = () => {
  const d = new Date()
  return `${currentMonth()}-${String(d.getDate()).padStart(2, '0')}`
}

// Started already (a month-only start counts from the 1st) and not yet over.
export function isOngoing(e: EventEntry) {
  if (!e.date || !e.endDate) return false
  return e.date <= today() && isUpcoming(e)
}

function fmt(s: string, year: boolean) {
  const [y, m, d] = s.split('-')
  const mon = m ? SHORT[Number(m) - 1] : ''
  return [d ? String(Number(d)) : '', mon, year ? y : ''].filter(Boolean).join(' ')
}

export function formatEventDate(start?: string, end?: string, opts: { year?: boolean } = {}) {
  const withYear = opts.year ?? true
  if (!start) return ''
  if (!end || end === start) return fmt(start, withYear)
  const [sy, sm, sd] = start.split('-')
  const [ey, em, ed] = end.split('-')
  if (sy === ey && sm && sm === em && sd && ed) return `${Number(sd)}–${Number(ed)} ${SHORT[Number(sm) - 1]}${withYear ? ` ${sy}` : ''}`
  if (sy === ey) return `${fmt(start, false)} – ${fmt(end, withYear)}`
  return `${fmt(start, true)} – ${fmt(end, true)}`
}

// First three letters of month names in English, German and Portuguese.
const MONTH_PREFIX: Record<string, number> = {
  jan: 1, feb: 2, fev: 2, mar: 3, 'mär': 3, apr: 4, abr: 4, may: 5, mai: 5, jun: 6, jul: 7,
  aug: 8, ago: 8, sep: 9, set: 9, oct: 10, okt: 10, out: 10, nov: 11, dec: 12, dez: 12,
}
const pad2 = (n: number) => String(n).padStart(2, '0')
const okMonth = (m: number) => m >= 1 && m <= 12
const okDay = (d: number) => d >= 1 && d <= 31

// Turns a typed date ("Oct 2024", "12.10.2024", "2024-10", "12 October 2024") into
// 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. Returns undefined when it can't be read safely.
export function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined
  const s = raw.trim().toLowerCase()
  if (/^\d{4}(-\d{2}(-\d{2})?)?$/.test(s)) return s
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
  if (m) return okMonth(+m[2]) && okDay(+m[1]) ? `${m[3]}-${pad2(+m[2])}-${pad2(+m[1])}` : undefined
  m = s.match(/^(\d{4})[./-](\d{1,2})(?:[./-](\d{1,2}))?$/)
  if (m) {
    if (!okMonth(+m[2])) return undefined
    return m[3] ? (okDay(+m[3]) ? `${m[1]}-${pad2(+m[2])}-${pad2(+m[3])}` : undefined) : `${m[1]}-${pad2(+m[2])}`
  }
  const year = s.match(/\b(1[89]\d{2}|2\d{3})\b/)
  if (!year) return undefined
  // Every word must be a month name, otherwise the text means something we can't keep ("Spring 2024").
  const words = s.match(/[a-zäöüéç]+/g) ?? []
  const months = words.map(w => MONTH_PREFIX[w.slice(0, 3)])
  if (months.length !== 1 || months[0] == null) return undefined
  const month = months[0]
  const rest = s.replace(year[1], '').replace(/[a-zäöüéç]+/g, '').replace(/[\s.,/-]+/g, ' ').trim()
  if (rest === '') return `${year[1]}-${pad2(month)}`
  return /^\d{1,2}$/.test(rest) && okDay(+rest) ? `${year[1]}-${pad2(month)}-${pad2(+rest)}` : undefined
}

// For dates that may still be free text from before the date menus existed.
export function formatAnyDate(raw?: string) {
  const n = normalizeDate(raw)
  return n ? formatEventDate(n) : raw ?? ''
}
