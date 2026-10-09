import type { Department, Activity } from '../db/db'

export const PRACTICE_OPTIONS: Array<{ key: Activity; label: string }> = [
  { key: 'visual_artist',  label: 'Visual artist' },
  { key: 'musician',       label: 'Musician' },
  { key: 'writer',         label: 'Writer' },
  { key: 'picture_book',   label: "Children's books" },
  { key: 'photographer',   label: 'Photographer' },
  { key: 'designer',       label: 'Designer' },
  { key: 'performer',      label: 'Performer' },
  { key: 'other',          label: 'Other' },
]

export function getActivities(dept: Department | undefined | null): Activity[] {
  if (!dept) return []
  if (dept.activities && dept.activities.length > 0) return dept.activities
  if (dept.discipline === 'picture_books') return ['picture_book']
  if (dept.discipline === 'music') return ['musician']
  return ['visual_artist']
}
