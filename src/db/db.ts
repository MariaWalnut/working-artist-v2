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
  coverImage?: string
}

export interface Project {
  id?: number
  departmentId?: number
  title: string
  projectType?: string
  status?: string
  notes?: string
  // Exhibition / Residency / Commission
  location?: string
  dateStart?: string
  dateEnd?: string
  institution?: string
  curator?: string
  // Books / Publications
  publisher?: string
  author?: string
  illustrator?: string
  designer?: string
  publishedDate?: string
  isbn?: string
  // Music release
  label?: string
  releaseFormat?: string
  releaseDate?: string
  // Award
  organisation?: string
  awardYear?: string
  // Commission
  client?: string
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
  coverImage?: string
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

export interface EventEntry {
  id?: number
  departmentId?: number
  title: string
  type?: string // Reading, Exhibition, Book Fair, Talk, Performance, Screening, Award, Other
  location?: string
  date?: string // YYYY-MM
  notes?: string
  url?: string
  workIds?: number[]
}

export interface PressEntry {
  id?: number
  departmentId?: number
  title: string
  type?: string // Interview / Feature / Selection / Review / Mention / Profile
  outlet?: string
  date?: string // free-form, e.g. "Oct 2024"
  url?: string
  notes?: string
  bookId?: number // optional link to a book
  workId?: number // optional link to a work
}

export interface PressItem {
  id: string
  outlet: string
  title: string
  date?: string
  url?: string
  type?: string // Interview / Feature / Review / etc.
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

export interface Todo {
  id?: number
  departmentId?: number
  projectId?: number
  title: string
  done: boolean
  kanbanStatus?: 'todo' | 'in-progress' | 'done'
  dueDate?: string // yyyy-MM-dd
  notes?: string
}

export interface Board {
  id?: number
  departmentId?: number
  name: string
  boardType?: string
  createdAt: number
  hiddenProjectIds?: number[] // desk only: projects the user took off the desk
}

export interface BoardItem {
  id?: number
  boardId: number
  itemType: 'text' | 'note' | 'color' | 'quote' | 'tag' | 'image' | 'arrow' | 'title'
    | 'project' | 'tasks' | 'list' | 'submission' | 'comingup'
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
  todos!: Table<Todo>
  pressEntries!: Table<PressEntry>
  eventEntries!: Table<EventEntry>

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
    this.version(4).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
      boards: '++id, departmentId',
      boardItems: '++id, boardId',
      books: '++id, departmentId',
      releases: '++id, departmentId',
      todos: '++id, departmentId, projectId',
    })
    this.version(5).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
      boards: '++id, departmentId',
      boardItems: '++id, boardId',
      books: '++id, departmentId',
      releases: '++id, departmentId',
      todos: '++id, departmentId, projectId',
      pressEntries: '++id, departmentId',
    })
    this.version(6).stores({
      departments: '++id',
      projects: '++id, departmentId',
      opportunities: '++id, departmentId',
      works: '++id, departmentId',
      dayLogs: '++id, departmentId, date',
      boards: '++id, departmentId',
      boardItems: '++id, boardId',
      books: '++id, departmentId',
      releases: '++id, departmentId',
      todos: '++id, departmentId, projectId',
      pressEntries: '++id, departmentId',
      eventEntries: '++id, departmentId',
    })
  }
}

export const db = new AppDB()

// Ask the browser to keep our data rather than evicting it under storage pressure.
// Without this, IndexedDB is "best-effort" and Safari can clear it silently.
if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {})
}
