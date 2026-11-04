import type { Project, Work } from '../db/db'

export const PROJECT_STATUSES = ['Active', 'On hold', 'Planned', 'Completed', 'Cancelled']

// Planned: no pressure. Off the desk, out of the tasks and tips, until it is brought back.
// It was called One day at first, and projects saved then still say so.
export const isPlanned = (p: Pick<Project, 'status'>) => p.status === 'Planned' || p.status === 'One day'
export const statusOf = (p: Pick<Project, 'status'>) => isPlanned(p) ? 'Planned' : p.status ?? 'Active'

export function isActive(p: Project) {
  if (isPlanned(p) || p.status === 'Completed' || p.status === 'Cancelled') return false
  // A film stays active until its premiere, even after the shoot ends.
  const end = p.projectType === 'Film' ? (p.releaseDate ?? p.dateEnd) : (p.dateEnd ?? p.publishedDate ?? p.releaseDate)
  if (!end) return true
  return end >= new Date().toISOString().slice(0, 7)
}

export function projectSubtitle(p: Project) {
  const t = p.projectType
  if (t === 'Books' || t === 'Publications') return [p.author, p.publisher].filter(Boolean).join(' · ')
  if (t === 'Release') return [p.label, p.releaseFormat].filter(Boolean).join(' · ')
  if (t === 'Award') return p.organisation
  if (t === 'Commission') return p.client
  if (t === 'Film') return [p.client, p.location].filter(Boolean).join(' · ')
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

export const PROJECT_TYPES = ['Exhibition', 'Residency', 'Release', 'Film', 'Award', 'Commission', 'Books', 'Publications', 'Other']

const WORK_KIND: Record<string, string> = { Books: 'Book', Publications: 'Book', Release: 'Release', Film: 'Film', Commission: 'Artwork' }

// The work a completed project becomes, with everything the project already knows filled in.
export function workFromProject(p: Project): Omit<Work, 'id'> {
  const date = p.publishedDate ?? p.releaseDate ?? p.dateEnd ?? p.dateStart
  const [year, month] = (date ?? '').split('-').map(Number)
  return {
    departmentId: p.departmentId, practice: p.practice, projectId: p.id, title: p.title,
    kind: WORK_KIND[p.projectType ?? ''] ?? 'Other',
    category: PROJECT_TYPES.includes(p.projectType ?? 'Other') ? undefined : p.projectType,
    year: year || new Date().getFullYear(), month: month || undefined, location: p.location,
    publisher: p.publisher, publishedDate: p.publishedDate, isbn: p.isbn,
    credits: [...new Set([p.author, p.illustrator, p.designer].filter(Boolean))].join(', ') || undefined,
    label: p.label, format: p.releaseFormat, production: p.projectType === 'Film' ? p.client : undefined,
  }
}
