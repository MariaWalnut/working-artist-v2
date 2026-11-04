import { useSyncExternalStore } from 'react'
import type { Activity, EventEntry, Opportunity, PressEntry, Project, Work } from '../db/db'
import { getActivities } from './activities'
import { useActiveDept } from './useDept'
import { kindOf, type WorkKind } from './works'

// One studio, several practices. Every work, project, event, submission and piece of press belongs
// to one practice: the one chosen for it, or else a guess from its kind. Contacts and Manifest are shared.
// Together: everything mixed, with a filter on Works, Events and Career.
// Separate: one practice at a time, picked from the name in the top left.

export type PracticeMode = 'together' | 'separate'

// How the name in the top left says each practice: "Working Artist Filmmaker".
export const PRACTICE_NAME: Record<Activity, string> = {
  visual_artist: 'Visual artist',
  musician: 'Musician',
  writer: 'Writer',
  picture_book: 'Illustrator',
  photographer: 'Photographer',
  filmmaker: 'Filmmaker',
  designer: 'Designer',
  performer: 'Performer',
  other: 'Other',
}

// The kind of work a new work starts as, in each practice.
export const PRACTICE_KIND: Partial<Record<Activity, WorkKind>> = {
  musician: 'Release',
  filmmaker: 'Film',
  writer: 'Book',
}

// Categories offered for a work in each practice. People can type their own.
export const PRACTICE_CATEGORIES: Record<Activity, string[]> = {
  visual_artist: ['Paintings', 'Works on paper', 'Studies', 'Prints', 'Sculpture', 'Installations', 'Video'],
  musician: ['Albums', 'EPs', 'Singles', 'Live', 'Soundtracks'],
  writer: ['Novels', 'Short stories', 'Essays', 'Poetry', 'Translations'],
  picture_book: ['Picture books', 'Covers', 'Editorial', 'Posters', 'Character sheets'],
  photographer: ['Series', 'Portraits', 'Commissions', 'Photobooks'],
  filmmaker: ['Features', 'Shorts', 'Documentaries', 'Series', 'Music videos'],
  designer: ['Identity', 'Editorial', 'Posters', 'Web'],
  performer: ['Solo', 'Ensemble', 'Commissions'],
  other: [],
}

// Likely practices for each kind or type, best first. The first one the artist has wins.
const BY_KIND: Record<string, Activity[]> = {
  Release: ['musician', 'performer'],
  Film: ['filmmaker'],
  Book: ['writer', 'picture_book'],
  Illustration: ['picture_book', 'designer', 'visual_artist'],
  Artwork: ['visual_artist', 'photographer', 'designer', 'picture_book'],
}
const BY_PROJECT_TYPE: Record<string, Activity[]> = {
  Release: ['musician', 'performer'],
  Film: ['filmmaker'],
  Books: ['writer', 'picture_book'],
  Publications: ['writer', 'picture_book'],
  Exhibition: ['visual_artist', 'photographer', 'picture_book'],
}
const BY_EVENT_TYPE: Record<string, Activity[]> = {
  Reading: ['writer', 'picture_book'],
  'Book Fair': ['picture_book', 'writer'],
  Exhibition: ['visual_artist', 'photographer', 'picture_book'],
  Performance: ['musician', 'performer'],
  Screening: ['filmmaker'],
  Festival: ['filmmaker', 'musician'],
}
const BY_OPP_TYPE: Record<string, Activity[]> = {
  'Publisher proposal': ['writer', 'picture_book'],
}

const pick = (likely: Activity[] | undefined, acts: Activity[]): Activity =>
  likely?.find(a => acts.includes(a)) ?? acts[0] ?? 'other'
const own = (p: Activity | undefined, acts: Activity[]) => (p && acts.includes(p) ? p : undefined)

// Works the practice of each thing out. Events and press follow the first work they're linked to.
export function practiceOf(acts: Activity[], works: Work[] = []) {
  const event = (e: Pick<EventEntry, 'type' | 'workIds' | 'practice'>) =>
    own(e.practice, acts) ?? workById(e.workIds?.[0]) ?? pick(BY_EVENT_TYPE[e.type ?? ''], acts)
  const work = (w: Pick<Work, 'kind' | 'practice'>) => own(w.practice, acts) ?? pick(BY_KIND[kindOf(w)], acts)
  const workById = (id?: number) => {
    const w = id == null ? undefined : works.find(x => x.id === id)
    return w ? work(w) : undefined
  }
  return {
    work,
    project: (p: Pick<Project, 'projectType' | 'practice'>) => own(p.practice, acts) ?? pick(BY_PROJECT_TYPE[p.projectType ?? ''], acts),
    event,
    // All the practices an event belongs to.
    eventAll: (e: Pick<EventEntry, 'type' | 'workIds' | 'practice' | 'practices'>) => {
      const chosen = (e.practices ?? []).filter(a => acts.includes(a))
      return chosen.length ? chosen : [event(e)]
    },
    opportunity: (o: Pick<Opportunity, 'opportunityType' | 'practice'>) => own(o.practice, acts) ?? pick(BY_OPP_TYPE[o.opportunityType ?? ''], acts),
    press: (p: Pick<PressEntry, 'workId' | 'practice'>) => own(p.practice, acts) ?? workById(p.workId) ?? pick(undefined, acts),
  }
}

// The practice picked from the name (Separate), kept on this device. The filter (Together) lasts a visit.
function store(storage: () => Storage, key: string) {
  const listeners = new Set<() => void>()
  const read = () => { try { return storage().getItem(key) } catch { return null } }
  let value = read()
  return {
    get: () => value,
    set(next: string | null) {
      value = next
      try { if (next) storage().setItem(key, next); else storage().removeItem(key) } catch { /* private mode */ }
      listeners.forEach(l => l())
    },
    subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb) } },
  }
}
const picked = store(() => localStorage, 'wa-practice')
const lens = store(() => sessionStorage, 'wa-practice-filter')

export const setPicked = (a: Activity) => picked.set(a)
export const setLens = (a: Activity | null) => lens.set(a)

// The practice the page shows, or null for all of them. `filter` pages also follow the Together filter.
export function usePractice({ filter = false }: { filter?: boolean } = {}) {
  const dept = useActiveDept()
  const acts = getActivities(dept)
  const multi = acts.length > 1
  const mode: PracticeMode = multi && dept?.practiceMode === 'separate' ? 'separate' : 'together'
  const pickedValue = useSyncExternalStore(picked.subscribe, picked.get) as Activity | null
  const lensValue = useSyncExternalStore(lens.subscribe, lens.get) as Activity | null
  const current: Activity | null = !multi ? null
    : mode === 'separate' ? own(pickedValue ?? undefined, acts) ?? acts[0]
    : filter ? own(lensValue ?? undefined, acts) ?? null
    : null
  return {
    dept,
    acts,
    multi,
    mode,
    current,
    // How a practice reads in this studio: its own name if it has one, e.g. Painter.
    name: (a: Activity) => dept?.practiceNames?.[a] ?? PRACTICE_NAME[a],
    // The practice new things start in: the one shown, or the only one there is.
    start: current ?? (acts.length === 1 ? acts[0] : undefined),
    keep: (p: Activity) => current == null || p === current,
  }
}
