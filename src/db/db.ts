import Dexie, { type Table } from 'dexie'

export type Activity = 'visual_artist' | 'musician' | 'writer' | 'picture_book' | 'photographer' | 'designer' | 'performer' | 'other'

export interface Department {
  id?: number
  name: string
  discipline: 'painter' | 'picture_books' | 'music'
  activities?: Activity[]
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
  location?: string
  collection?: string
  notes?: string
  press?: PressItem[]
  rights?: RightItem[]
}

export interface Book {
  id?: number
  departmentId?: number
  title: string
  subtitle?: string
  publisher?: string
  publishedDate?: string
  isbn?: string
  language?: string
  credits?: string
  dimensions?: string
  pages?: number
  technique?: string
  notes?: string
  press?: PressItem[]
  rights?: RightItem[]
}

export interface Release {
  id?: number
  departmentId?: number
  title: string
  format?: string
  year?: number
  label?: string
  notes?: string
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
  itemType: 'text' | 'note' | 'color' | 'quote' | 'tag' | 'image' | 'arrow' | 'title'
  content: string
  x: number
  y: number
  w: number
  h: number
  color?: string
  imageData?: string
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
  books!: Table<Book>
  releases!: Table<Release>

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
    this.version(3).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
      boards: '++id, departmentId',
      boardItems: '++id, boardId',
      books: '++id, departmentId',
      releases: '++id, departmentId',
    })
  }
}

export const db = new AppDB()
