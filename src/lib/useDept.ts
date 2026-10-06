import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'

export function useActiveDept() {
  const depts = useLiveQuery(() => db.departments.toArray()) ?? []
  return depts[0] ?? null
}
