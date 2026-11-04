import type { Contact, EventEntry, Opportunity, Project, Todo, Work } from '../db/db'

// Simple career tips, worked out on this computer from what is already in the studio.
// Nothing here leaves the browser.

export const TIP_GROUPS = ['Submissions', 'Contracts', 'Rights', 'Events', 'Contacts', 'Records'] as const
export type TipGroup = typeof TIP_GROUPS[number]

export interface Tip {
  key: string // stable, so a hidden tip stays hidden
  group: TipGroup
  text: string
  to: string
}

export interface TipData {
  works: Work[]
  projects: Project[]
  opportunities: Opportunity[]
  events: EventEntry[]
  contacts: Contact[]
  todos: Todo[]
}

const RECENT_YEARS = 5 // older books stop asking for attention
const NO_REPLY_DAYS = 21
const DEADLINE_SOON_DAYS = 14
const DATE_NEEDED_DAYS = 60
const FAIR_PLANNING_DAYS = 180

// Whole days from today to a yyyy-MM-dd or yyyy-MM date; a month counts from its first day.
function daysUntil(date: string, today: Date) {
  const [y, m, d] = date.split('-').map(Number)
  const then = new Date(y, (m || 1) - 1, d || 1)
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((then.getTime() - now.getTime()) / 86400000)
}

const publishedYear = (w: Work) => Number(String(w.publishedDate ?? '').slice(0, 4)) || w.year
const hasContract = (w: Work) => !!w.contractFile || w.contract?.advance != null || w.contract?.royaltyRate != null || !!w.contract?.signed
const clean = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

export function careerTips({ works, projects, opportunities, events, contacts, todos }: TipData, today = new Date()): Tip[] {
  const tips: Tip[] = []
  const books = works.filter(w => w.kind === 'Book')
  const recent = books.filter(w => (publishedYear(w) ?? 0) > today.getFullYear() - RECENT_YEARS)

  for (const o of opportunities) {
    const date = o.deadline ?? o.sentDate
    if (!date) continue
    const days = daysUntil(date, today)
    const add = (text: string) => tips.push({ key: `opp-${o.id}-${o.status}`, group: 'Submissions', text, to: '/opportunities' })
    if ((o.status === 'Applied' || o.status === 'Shortlisted') && days <= -NO_REPLY_DAYS) add(`${o.title}: no result recorded after ${-days} days.`)
    else if ((o.status === 'Active' || o.status === 'Draft') && days < 0) add(`${o.title}: the deadline has passed.`)
    else if ((o.status === 'Active' || o.status === 'Draft') && days <= DEADLINE_SOON_DAYS) add(`${o.title}: due in ${days} ${days === 1 ? 'day' : 'days'}.`)
  }

  for (const p of projects) {
    if (p.status === 'One day' || p.status === 'Cancelled') continue
    const open = todos.filter(t => t.projectId === p.id && !t.done)
    const contract = open.find(t => /contract/i.test(t.title))
    if (contract) {
      const others = open.length - 1
      tips.push({ key: `project-contract-${p.id}`, group: 'Contracts', to: `/projects/${p.id}`, text: `${p.title}: contract not signed${others ? `, with ${others} other ${others === 1 ? 'task' : 'tasks'} open` : ''}.` })
    }
    const sent = opportunities.filter(o => o.projectIds?.includes(p.id!))
    const rejected = sent.filter(o => o.status === 'Rejected')
    if (rejected.length > 0 && p.status === 'Active' && rejected.length === sent.length) {
      tips.push({ key: `project-resubmit-${p.id}`, group: 'Submissions', to: `/projects/${p.id}`, text: `${p.title}: rejected, and not sent anywhere else yet.` })
    }
    if (p.status === 'Active' && open.length === 0) tips.push({ key: `project-idle-${p.id}`, group: 'Records', to: `/projects/${p.id}`, text: `${p.title}: active, with no open tasks.` })
  }

  for (const w of recent) {
    if (!hasContract(w)) tips.push({ key: `work-contract-${w.id}`, group: 'Contracts', to: `/studio/${w.id}`, text: `${w.title}: no contract details saved.` })
    if (!w.rights?.length) tips.push({ key: `work-rights-${w.id}`, group: 'Rights', to: `/studio/${w.id}`, text: `${w.title}: no rights recorded.` })
  }

  for (const e of events) {
    if (e.maybe) continue
    if (!e.date) { tips.push({ key: `event-undated-${e.id}`, group: 'Events', to: '/projects/events', text: `${e.title}: no date.` }); continue }
    const days = daysUntil(e.date, today)
    if (days < -31) continue
    if (e.date.length <= 7 && days <= DATE_NEEDED_DAYS && days >= -31) tips.push({ key: `event-day-${e.id}`, group: 'Events', to: '/projects/events', text: `${e.title}: no exact day yet.` })
    const people = contacts.filter(c => c.eventIds?.includes(e.id!)).length
    if (/fair/i.test(e.type ?? '') && days > 0 && days <= FAIR_PLANNING_DAYS && people === 0) {
      tips.push({ key: `event-people-${e.id}`, group: 'Events', to: '/projects/events', text: `${e.title}: ${Math.round(days / 30)} months away, with no one linked to meet.` })
    }
  }

  // Publishers the studio already works with, who have no one in Contacts.
  const known = contacts.map(c => clean(c.organisation ?? '')).filter(Boolean)
  const publishers = new Map<string, string>()
  const note = (name?: string) => { if (name?.trim()) publishers.set(clean(name), name.trim()) }
  for (const w of recent) { note(w.publisher); w.rights?.forEach(r => note(r.publisher)) }
  for (const p of projects) note(p.publisher)
  for (const [key, name] of publishers) {
    if (!known.some(k => k.includes(key) || key.includes(k))) tips.push({ key: `publisher-${key}`, group: 'Contacts', to: '/contacts', text: `${name}: no one in Contacts.` })
  }

  for (const w of books) {
    const published = Number(String(w.publishedDate ?? '').slice(0, 4))
    if (published && w.year && published !== w.year) tips.push({ key: `work-year-${w.id}`, group: 'Records', to: `/studio/${w.id}`, text: `${w.title}: the year says ${w.year}, the publication date ${published}.` })
  }

  return tips
}
