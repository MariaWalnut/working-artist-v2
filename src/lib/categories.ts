import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Project, type Work } from '../db/db'
import { PRACTICE_CATEGORIES } from './practice'
import { PROJECT_TYPES } from './projects'
import { useActiveDept } from './useDept'

const key = (c: string) => c.trim().toLowerCase()
const TYPES = new Set(PROJECT_TYPES.map(key))
const SUGGESTED = new Set(Object.values(PRACTICE_CATEGORIES).flat().map(key))

// One list for a studio: a category typed on a project or a work is offered again on both.
// The project menu leaves out categories that are only the usual suggestions for works.
export function customCategories(projects: Pick<Project, 'projectType'>[], works: Pick<Work, 'category'>[], withSuggested = false) {
  const found = new Map<string, string>()
  const add = (c: string) => { if (!found.has(key(c))) found.set(key(c), c.trim()) }
  for (const { projectType: t } of projects) if (t?.trim() && !TYPES.has(key(t))) add(t)
  for (const { category: c } of works) if (c?.trim() && (withSuggested || !(TYPES.has(key(c)) || SUGGESTED.has(key(c))))) add(c)
  return [...found.values()].sort((a, b) => a.localeCompare(b))
}

export function useCustomCategories({ withSuggested = false } = {}) {
  const dept = useActiveDept()
  return useLiveQuery(async () => {
    if (dept?.id == null) return []
    const [projects, works] = await Promise.all([
      db.projects.where('departmentId').equals(dept.id).toArray(),
      db.works.where('departmentId').equals(dept.id).toArray(),
    ])
    return customCategories(projects, works, withSuggested)
  }, [dept?.id, withSuggested]) ?? []
}

// The type menu on a project: the usual types, the studio's own, and Other to name a new one.
export const projectTypeOptions = (custom: string[]) => [...PROJECT_TYPES.filter(t => t !== 'Other'), ...custom, 'Other']
