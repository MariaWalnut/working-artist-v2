import type { Department, Activity } from '../db/db'

export const PRACTICE_OPTIONS: Array<{ key: Activity; label: string }> = [
  { key: 'visual_artist', label: 'Visual artist' },
  { key: 'musician',      label: 'Musician' },
  { key: 'writer',        label: 'Writer' },
  { key: 'photographer',  label: 'Photographer' },
  { key: 'performer',     label: 'Performer' },
  { key: 'other',         label: 'Other' },
]

export function getActivities(dept: Department | undefined | null): Activity[] {
  if (!dept) return []
  if (dept.activities && dept.activities.length > 0) return dept.activities
  if (dept.discipline === 'picture_books') return ['writer']
  if (dept.discipline === 'music') return ['musician']
  return ['visual_artist']
}
