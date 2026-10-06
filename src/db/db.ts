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
  press?: PressItem[]
  rights?: RightItem[]
}

export interface PressItem {
  id: string
  outlet: string
  title: string
  date?: string
  url?: string
}

export interface RightItem {
  id: string
  language: string
  publisher?: string
  year?: number
  status: 'live' | 'sold' | 'pending'
}

export interface DayLog {
  id?: number
  departmentId?: number
  date: string
  mood?: string
  note?: string
  dayType?: string
}

export interface Board {
  id?: number
  departmentId?: number
  name: string
  boardType?: string
  createdAt: number
}

export interface BoardItem {
  id?: number
  boardId: number
  itemType: 'text' | 'note' | 'color' | 'quote' | 'tag'
  content: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  createdAt: number
}

class AppDB extends Dexie {
  departments!: Table<Department>
  projects!: Table<Project>
  opportunities!: Table<Opportunity>
  works!: Table<Work>
  dayLogs!: Table<DayLog>
  boards!: Table<Board>
  boardItems!: Table<BoardItem>

  constructor() {
    super('WorkingArtistV2')
    this.version(1).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
    })
    this.version(2).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
      boards: '++id, departmentId',
      boardItems: '++id, boardId',
    })
  }
}

export const db = new AppDB()
