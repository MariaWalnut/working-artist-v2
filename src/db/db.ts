import Dexie, { type Table } from 'dexie'

export interface Department {
  id?: number
  name: string
  discipline: 'painter' | 'picture_books' | 'music'
  office?: string
  establishedYear?: number
  createdAt: number
}

export interface Project {
  id?: number
  departmentId?: number
  title: string
  projectType?: string
  location?: string
  dateStart?: string
  dateEnd?: string
  status?: string
  notes?: string
}

export interface Opportunity {
  id?: number
  departmentId?: number
  title: string
  opportunityType?: string
  organisation?: string
  deadline?: string
  status: string
  notes?: string
}

export interface Work {
  id?: number
  departmentId?: number
  title: string
  medium?: string
  dimensions?: string
  year?: number
  studioStatus?: string
  collection?: string
  notes?: string
}

export interface DayLog {
  id?: number
  departmentId?: number
  date: string
  mood?: string
  note?: string
  dayType?: string
}

class AppDB extends Dexie {
  departments!: Table<Department>
  projects!: Table<Project>
  opportunities!: Table<Opportunity>
  works!: Table<Work>
  dayLogs!: Table<DayLog>

  constructor() {
    super('WorkingArtistV2')
    this.version(1).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
    })
  }
}

export const db = new AppDB()
