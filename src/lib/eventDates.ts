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
