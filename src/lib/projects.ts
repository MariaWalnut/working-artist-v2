import type { Project } from '../db/db'

export function isActive(p: Project) {
  const end = p.dateEnd ?? p.publishedDate ?? p.releaseDate
  if (!end) return true
  return end >= new Date().toISOString().slice(0, 7)
}

export function projectSubtitle(p: Project) {
  const t = p.projectType
  if (t === 'Books' || t === 'Publications') return [p.author, p.publisher].filter(Boolean).join(' · ')
  if (t === 'Release') return [p.label, p.releaseFormat].filter(Boolean).join(' · ')
  if (t === 'Award') return p.organisation
  if (t === 'Commission') return p.client
  return [p.location, p.institution].filter(Boolean).join(' · ')
}

export function projectDate(p: Project) {
  const start = p.dateStart
  const end = p.dateEnd ?? p.publishedDate ?? p.releaseDate
  const fmt = (s: string) => {
    const [y, m] = s.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  }
  if (p.awardYear) return p.awardYear
  if (!start && end) return fmt(end)
  if (!start) return null
  if (!end) return fmt(start)
  if (start.slice(0, 7) === end.slice(0, 7)) return fmt(start)
  return `${fmt(start)} – ${fmt(end)}`
}
