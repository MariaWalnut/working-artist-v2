import type { Activity, Department } from '../db/db'
import { getActivities } from './activities'

// The profile is the outward-facing page: who the artist is, how to reach them, and the texts
// they send out. Every practice has one, and what it offers is named in that practice's own words.

// Kinds of text offered in each practice, likeliest first. People can leave it blank.
export const PRACTICE_TEXT_KINDS: Record<Activity, string[]> = {
  visual_artist: ['Bio', 'Artist statement', 'Exhibition text', 'Work description', 'Pitch'],
  musician: ['Bio', 'Press release', 'Release note', 'Band description', 'Pitch'],
  writer: ['Bio', 'Statement', 'Book blurb', 'Synopsis', 'Pitch'],
  picture_book: ['Bio', 'Statement', 'Book blurb', 'Project description', 'Pitch'],
  photographer: ['Bio', 'Statement', 'Series text', 'Caption', 'Pitch'],
  filmmaker: ['Bio', "Director's statement", 'Logline', 'Synopsis', 'Pitch'],
  designer: ['Bio', 'Statement', 'Project description', 'Case note', 'Pitch'],
  performer: ['Bio', 'Statement', 'Show description', 'Programme note', 'Pitch'],
  other: ['Bio', 'Statement', 'Description', 'Pitch'],
}

// Links offered in each practice, beyond the ones everyone has. A label can also be typed.
export const PRACTICE_LINKS: Record<Activity, string[]> = {
  visual_artist: ['Gallery', 'Portfolio'],
  musician: ['Spotify', 'Bandcamp', 'SoundCloud', 'YouTube', 'Booking'],
  writer: ['Publisher', 'Agent'],
  picture_book: ['Publisher', 'Agent', 'Portfolio'],
  photographer: ['Portfolio', 'Agency'],
  filmmaker: ['Vimeo', 'YouTube', 'IMDb', 'Sales agent'],
  designer: ['Portfolio', 'Behance'],
  performer: ['YouTube', 'Booking', 'Agency'],
  other: [],
}

const COMMON_LINKS = ['Website', 'Instagram', 'Email']

// The word for the act itself, used where the page talks about who the profile is for.
export const PRACTICE_SUBJECT: Record<Activity, string> = {
  visual_artist: 'the artist',
  musician: 'the act',
  writer: 'the writer',
  picture_book: 'the illustrator',
  photographer: 'the photographer',
  filmmaker: 'the filmmaker',
  designer: 'the designer',
  performer: 'the performer',
  other: 'the practice',
}

// Where the artist works from, in each practice's own word.
export const PRACTICE_PLACE: Record<Activity, string> = {
  visual_artist: 'Studio in',
  musician: 'Based in',
  writer: 'Writing from',
  picture_book: 'Studio in',
  photographer: 'Based in',
  filmmaker: 'Based in',
  designer: 'Studio in',
  performer: 'Based in',
  other: 'Based in',
}

const dedupe = (xs: string[]) => [...new Set(xs)]

// A studio can hold several practices. Everything it offers is the union, in practice order.
export function textKinds(dept: Department | null | undefined): string[] {
  const acts = getActivities(dept)
  if (acts.length === 0) return [...PRACTICE_TEXT_KINDS.other, 'Other']
  return dedupe([...acts.flatMap(a => PRACTICE_TEXT_KINDS[a] ?? []), 'Other'])
}

export function linkLabels(dept: Department | null | undefined): string[] {
  const acts = getActivities(dept)
  return dedupe([...COMMON_LINKS, ...acts.flatMap(a => PRACTICE_LINKS[a] ?? [])])
}

// The practice a page speaks in: the only one, or the first of several.
export function leadPractice(dept: Department | null | undefined): Activity {
  return getActivities(dept)[0] ?? 'other'
}

export const subjectWord = (dept: Department | null | undefined) => PRACTICE_SUBJECT[leadPractice(dept)]
export const placeWord = (dept: Department | null | undefined) => PRACTICE_PLACE[leadPractice(dept)]

// A rough word count, for the line under a text's title.
export function wordCount(body: string): number {
  const t = body.trim()
  return t ? t.split(/\s+/).length : 0
}
