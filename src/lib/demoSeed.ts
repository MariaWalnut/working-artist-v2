import { db, type Activity, type BoardItem, type EventEntry, type Opportunity, type PressEntry, type Project, type Work } from '../db/db'
import type { DemoField } from './mode'

// Sample studios for the open demos. Everyone and everything here is invented.
// Upcoming dates are relative to today, so a demo never looks stale.

const DAY = 864e5
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)

interface Seed {
  name: string
  activities: Activity[]
  works: Array<Omit<Work, 'departmentId'>>
  projects: Array<{ project: Omit<Project, 'departmentId'>; todos: Array<[string, number | null, boolean?]> }>
  // workIds here are indexes into `works`
  events: Array<Omit<EventEntry, 'departmentId'>>
  opportunities: Array<Omit<Opportunity, 'departmentId'>>
  // workId here is an index into `works`
  press: Array<Omit<PressEntry, 'departmentId'>>
  board: { name: string; items: Array<Pick<BoardItem, 'itemType' | 'content' | 'x' | 'y' | 'w' | 'h' | 'color'>> }
}

const boardItems = (title: string, quote: string, notes: string[], tags: string[]) => [
  { itemType: 'title' as const, content: title, x: 40, y: 32, w: 280, h: 90, color: '#FFFFFF' },
  { itemType: 'quote' as const, content: quote, x: 380, y: 40, w: 260, h: 116, color: '#F5E642' },
  ...notes.map((n, i) => ({ itemType: 'note' as const, content: n, x: 40 + i * 230, y: 190 + (i % 2) * 24, w: 200, h: 110, color: ['#FFFFFF', '#E8C4B4', '#B8E0A4'][i % 3] })),
  ...tags.map((t, i) => ({ itemType: 'tag' as const, content: t, x: 60 + i * 150, y: 360, w: 130, h: 44, color: '#111111' })),
]

const SEEDS: Record<DemoField, () => Seed> = {
  musician: () => ({
    name: 'Lena Moss',
    activities: ['musician'],
    works: [
      { title: 'Low Tide', kind: 'Release', format: 'Album', label: 'Northbound Records', year: 2025, month: 3, location: 'Berlin' },
      { title: 'Paper Lanterns', kind: 'Release', format: 'EP', label: 'Self-released', year: 2023, month: 9, location: 'Lisbon' },
      { title: 'Glass Hour', kind: 'Release', format: 'Single', label: 'Northbound Records', year: 2026, month: 6, location: 'Berlin' },
      { title: 'Field Recordings, Vol. 1', kind: 'Release', format: 'Cassette', label: 'Self-released', year: 2022, month: 11, location: 'London' },
    ],
    projects: [
      { project: { title: 'Second album', projectType: 'Release', status: 'Active', label: 'Northbound Records', notes: 'Twelve songs demoed. Choosing nine.' },
        todos: [['Finish lyrics for Harbour', 6], ['Book mixing engineer for January', 20], ['Send demos to label', null, true]] },
      { project: { title: 'Spring tour 2027', projectType: 'Other', status: 'Active', notes: 'Vienna, Copenhagen, Amsterdam.' },
        todos: [['Confirm Vienna venue', 10], ['Draft tour budget', 14], ['Ask Copenhagen promoter for dates', 21]] },
      { project: { title: 'Theatre score: The Orchard', projectType: 'Commission', status: 'Active', client: 'Kleines Haus Ensemble' },
        todos: [['Deliver cue list', 25], ['Record piano sketches', 9], ['Read the script twice', null, true]] },
    ],
    events: [
      { title: 'Low Tide release show', type: 'Performance', location: 'Berlin', date: '2025-03-14', workIds: [0] },
      { title: 'Radio session', type: 'Performance', location: 'London', date: '2025-06-02', workIds: [0] },
      { title: 'Glass Hour listening night', type: 'Performance', location: 'Lisbon', date: '2026-06-20', workIds: [2] },
      { title: 'Autumn showcase', type: 'Performance', location: 'Copenhagen', date: inDays(12), goals: 'Meet two promoters\nSell 30 records' },
      { title: 'Songwriting talk', type: 'Talk', location: 'Vienna', date: inDays(40) },
      { title: 'Winter record market', type: 'Market', location: 'Berlin', date: inDays(55), endDate: inDays(57) },
    ],
    opportunities: [
      { title: 'Tour support grant', opportunityType: 'Grant', organisation: 'Music Fund Berlin', deadline: inDays(21), status: 'Active' },
      { title: 'Festival open call', opportunityType: 'Open call', organisation: 'North Shore Festival', deadline: inDays(9), status: 'Draft' },
      { title: 'Studio residency', opportunityType: 'Residency', organisation: 'Harbour Studios', deadline: inDays(-30), status: 'Applied' },
      { title: 'Sync brief: coffee advert', opportunityType: 'Commission', organisation: 'Field Agency', deadline: inDays(-12), status: 'Shortlisted' },
      { title: 'Radio feature pitch', opportunityType: 'Press', organisation: 'Late Night Radio', deadline: inDays(-60), status: 'Won' },
    ],
    press: [
      { title: 'Low Tide reviewed', type: 'Review', outlet: 'Soundcheck Magazine', date: '2025-04', workId: 0, category: 'press' },
      { title: 'Album of the month', type: 'Selection', outlet: 'Northern Music Blog', date: '2025-04', workId: 0, category: 'press' },
      { title: 'Interview: writing by the sea', type: 'Interview', outlet: 'City Radio', date: '2025-05', category: 'press' },
      { title: 'Best Independent Album, shortlist', outlet: 'Independent Music Prize', date: '2025-11', workId: 0, category: 'award' },
    ],
    board: { name: '2027', items: boardItems('2027', 'Play the room you are in.', ['Tour three cities', 'Finish album two', 'Teach one workshop'], ['slow', 'warm', 'live']) },
  }),

  painter: () => ({
    name: 'Tomás Vale',
    activities: ['visual_artist'],
    works: [
      { title: 'Salt Flats I', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 5, location: 'Lisbon', collection: 'Private collection' },
      { title: 'Salt Flats II', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 7, location: 'Lisbon' },
      { title: 'Interior with Blue Chair', kind: 'Artwork', medium: 'Oil on canvas', dimensions: '80 × 60 cm', year: 2025, month: 2, location: 'Berlin', collection: 'Available' },
      { title: 'Night Garden', kind: 'Artwork', medium: 'Acrylic and pastel on paper', dimensions: '50 × 70 cm', year: 2025, month: 10, location: 'Berlin' },
      { title: 'Study for a Window', kind: 'Artwork', medium: 'Oil on panel', dimensions: '30 × 24 cm', year: 2026, month: 4, location: 'Berlin' },
    ],
    projects: [
      { project: { title: 'Solo show: Quiet Rooms', projectType: 'Exhibition', status: 'Active', location: 'Berlin', institution: 'Galerie Nordlicht', dateStart: inDays(45), dateEnd: inDays(80) },
        todos: [['Finalise works list', 7], ['Order frames', 12], ['Write press text', 20], ['Photograph new paintings', null, true]] },
      { project: { title: 'Lobby commission', projectType: 'Commission', status: 'Active', client: 'Hotel Linde' },
        todos: [['Send three sketch options', 5], ['Agree fee and timeline', null, true]] },
      { project: { title: 'Catalogue', projectType: 'Publications', status: 'Active' },
        todos: [['Choose 20 images', 30], ['Ask a writer for the essay', 18]] },
    ],
    events: [
      { title: 'Group show: Surface', type: 'Exhibition', location: 'Vienna', date: '2024-09-12', endDate: '2024-11-03', workIds: [0] },
      { title: 'Art fair booth', type: 'Exhibition', location: 'Madrid', date: '2025-02-26', endDate: '2025-03-02', workIds: [2] },
      { title: 'Open studio', type: 'Other', location: 'Berlin', date: '2025-05-17' },
      { title: 'Quiet Rooms opening', type: 'Exhibition', location: 'Berlin', date: inDays(45), endDate: inDays(80), workIds: [3, 4], goals: 'Sell two paintings\nInvite five collectors' },
      { title: 'Artist talk', type: 'Talk', location: 'Berlin', date: inDays(52) },
      { title: 'Christmas print market', type: 'Market', location: 'Berlin', date: inDays(60) },
    ],
    opportunities: [
      { title: 'Painting prize 2027', opportunityType: 'Open call', organisation: 'City Art Foundation', deadline: inDays(18), status: 'Active' },
      { title: 'Studio grant', opportunityType: 'Grant', organisation: 'Arts Council Fund', deadline: inDays(33), status: 'Draft' },
      { title: 'Residency in Lisbon', opportunityType: 'Residency', organisation: 'Atlantic Studios', deadline: inDays(-40), status: 'Applied' },
      { title: 'Public art commission', opportunityType: 'Commission', organisation: 'Town of Riverside', deadline: inDays(-20), status: 'Shortlisted' },
      { title: 'Summer group show', opportunityType: 'Open call', organisation: 'Kunstraum West', deadline: inDays(-90), status: 'Closed' },
    ],
    press: [
      { title: 'Review: Surface', type: 'Review', outlet: 'Vienna Art Notes', date: '2024-10', workId: 0, category: 'press' },
      { title: 'Studio visit', type: 'Feature', outlet: 'Art Weekly', date: '2025-03', category: 'press' },
      { title: 'Young Painters Prize, shortlist', outlet: 'City Art Foundation', date: '2025-06', workId: 2, category: 'award' },
    ],
    board: { name: 'Next body of work', items: boardItems('Next body of work', 'Paint what the light does, not what the thing is.', ['Larger canvases', 'More green', 'Show in Lisbon'], ['quiet', 'light', 'rooms']) },
  }),

  illustrator: () => ({
    name: 'Ines Okafor',
    activities: ['picture_book'],
    works: [
      { title: 'The Fox Who Kept the Moon', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2024-09', year: 2024, month: 9, language: 'English',
        credits: 'Text by Mara Holt, illustrated by Ines Okafor', pages: 32, dimensions: '24 × 30 cm', technique: 'Gouache, pencil', location: 'London',
        contract: { currency: '€', price: 16, binding: 'Hardcover', printRun: 4000, advance: 4000, advancePaid: 'full', royaltyRate: 5, royaltyBase: 'retail', territory: 'World, English language', signed: '2023-02' },
        rights: [{ id: 'r1', language: 'German', publisher: 'Blauer Verlag', year: 2025, status: 'sold', advance: 2000 }, { id: 'r2', language: 'Korean', status: 'pending' }] },
      { title: 'Hush, Little Harbour', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2026-05', year: 2026, month: 5, language: 'English',
        credits: 'Written and illustrated by Ines Okafor', pages: 40, dimensions: '25 × 25 cm', technique: 'Gouache, coloured pencil', location: 'London',
        contract: { currency: '€', price: 17, binding: 'Hardcover', printRun: 5000, advance: 6000, advancePaid: 'part', royaltyRate: 7, royaltyBase: 'retail', territory: 'World, all languages', signed: '2024-06' } },
      { title: 'Autumn cover', kind: 'Illustration', publisher: 'City Magazine', publishedDate: '2025-10', year: 2025, month: 10, medium: 'Gouache, digital' },
      { title: 'Book festival poster', kind: 'Illustration', publisher: "Children's Book Festival", publishedDate: '2026-02', year: 2026, month: 2, medium: 'Gouache', location: 'Paris' },
    ],
    projects: [
      { project: { title: 'Picture book three: Snow Days', projectType: 'Books', status: 'Active', publisher: 'Little Lantern Books', author: 'Ines Okafor' },
        todos: [['Thumbnails for spreads 1 to 8', 9], ['Final art due', 60], ['Character sheet to editor', null, true]] },
      { project: { title: 'Book fair portfolio', projectType: 'Other', status: 'Active' },
        todos: [['Print ten portfolio samples', 30], ['Book meetings with three agents', 40]] },
      { project: { title: 'School visits', projectType: 'Other', status: 'Active' },
        todos: [['Prepare drawing workshop', 15], ['Pack fox puppets', 16]] },
    ],
    events: [
      { title: 'Launch reading: The Fox Who Kept the Moon', type: 'Reading', location: 'London', date: '2024-09-21', workIds: [0] },
      { title: 'Illustration exhibition', type: 'Exhibition', location: 'Paris', date: '2025-11-08', endDate: '2025-12-20', workIds: [3] },
      { title: 'Hush, Little Harbour launch', type: 'Reading', location: 'Amsterdam', date: '2026-05-30', workIds: [1] },
      { title: 'School workshop', type: 'Talk', location: 'Berlin', date: inDays(16) },
      { title: 'Christmas book market', type: 'Market', location: 'Vienna', date: inDays(58), endDate: inDays(59) },
      { title: "Children's book fair", type: 'Book Fair', location: 'Bologna', date: inDays(170), endDate: inDays(173), goals: 'Show Snow Days to two foreign publishers\nMeet an agent' },
    ],
    opportunities: [
      { title: 'Proposal: Snow Days, German edition', opportunityType: 'Publisher proposal', organisation: 'Blauer Verlag', deadline: inDays(-14), status: 'Applied' },
      { title: 'International illustration prize', opportunityType: 'Open call', organisation: 'Illustrators Guild', deadline: inDays(25), status: 'Active' },
      { title: 'Translation grant', opportunityType: 'Grant', organisation: 'Book Translation Fund', deadline: inDays(40), status: 'Draft' },
      { title: 'Residency for illustrators', opportunityType: 'Residency', organisation: 'Seaside Studio', deadline: inDays(-45), status: 'Shortlisted' },
      { title: 'Magazine cover pitch', opportunityType: 'Commission', organisation: 'City Magazine', deadline: inDays(-120), status: 'Won' },
    ],
    press: [
      { title: 'Five picture books for autumn', type: 'Selection', outlet: 'Weekend Books', date: '2024-10', workId: 0, category: 'press' },
      { title: 'Interview: drawing foxes', type: 'Interview', outlet: 'Picture Book Podcast', date: '2025-01', workId: 0, category: 'press' },
      { title: 'Debut Picture Book Award, winner', outlet: 'Illustrators Guild', date: '2025-03', workId: 0, category: 'award' },
    ],
    board: { name: 'Book three', items: boardItems('Book three', 'Leave room for the reader.', ['Softer palette', 'One spread without words', 'Finish by spring'], ['snow', 'quiet', 'play']) },
  }),

  writer: () => ({
    name: 'Clara Brandt',
    activities: ['writer'],
    works: [
      { title: 'The Summer House', kind: 'Book', subtitle: 'A novel', publisher: 'Harbour Press', publishedDate: '2023-04', year: 2023, month: 4, language: 'English', pages: 280, location: 'London',
        contract: { currency: '€', price: 20, binding: 'Hardcover', printRun: 5000, advance: 8000, advancePaid: 'full', royaltyRate: 10, royaltyBase: 'retail', royaltySteps: '12.5% from 10,000 copies', territory: 'World, English language', signed: '2021-11', agent: 'Ruth Adler', agentCommission: 15 },
        rights: [{ id: 'r1', language: 'German', publisher: 'Nordwind Verlag', year: 2024, status: 'sold', advance: 3500 }, { id: 'r2', language: 'Portuguese', publisher: 'Edições Mar', year: 2025, status: 'live' }] },
      { title: 'Small Weather', kind: 'Book', subtitle: 'Stories', publisher: 'Harbour Press', publishedDate: '2025-09', year: 2025, month: 9, language: 'English', pages: 190, location: 'Dublin',
        contract: { currency: '€', price: 18, binding: 'Paperback', printRun: 3000, advance: 5000, advancePaid: 'part', royaltyRate: 7.5, royaltyBase: 'retail', signed: '2024-03', agent: 'Ruth Adler', agentCommission: 15 } },
      { title: 'On Walking', kind: 'Other', medium: 'Essay, City Review', year: 2024, month: 3 },
    ],
    projects: [
      { project: { title: 'Novel two: The Lighthouse Keepers', projectType: 'Books', status: 'Active', publisher: 'Harbour Press' },
        todos: [['Finish chapter 9', 5], ['Send first half to agent', 30], ['Research trip notes', null, true]] },
      { project: { title: 'Festival season', projectType: 'Other', status: 'Active' },
        todos: [['Prepare reading excerpt', 12], ['Confirm travel to Lisbon', 20]] },
      { project: { title: 'German edition edits', projectType: 'Publications', status: 'Active', publisher: 'Nordwind Verlag' },
        todos: [['Answer translator queries', 8]] },
    ],
    events: [
      { title: 'The Summer House launch', type: 'Reading', location: 'London', date: '2023-04-20', workIds: [0] },
      { title: 'Small Weather launch', type: 'Reading', location: 'Dublin', date: '2025-09-18', workIds: [1] },
      { title: 'Panel: writing place', type: 'Talk', location: 'Berlin', date: '2025-10-02' },
      { title: 'Literature festival reading', type: 'Reading', location: 'Lisbon', date: inDays(24), workIds: [1], goals: 'Sell 40 copies\nMeet the Portuguese editor' },
      { title: 'Writing workshop', type: 'Talk', location: 'Vienna', date: inDays(48) },
      { title: 'Book fair', type: 'Book Fair', location: 'Frankfurt', date: inDays(365), endDate: inDays(369) },
    ],
    opportunities: [
      { title: 'Short story prize', opportunityType: 'Open call', organisation: 'Coastal Writing Prize', deadline: inDays(14), status: 'Active' },
      { title: 'Writing residency', opportunityType: 'Residency', organisation: 'House of Letters', deadline: inDays(35), status: 'Draft' },
      { title: 'Translation grant, Portuguese edition', opportunityType: 'Grant', organisation: 'Literature Abroad Fund', deadline: inDays(-25), status: 'Applied' },
      { title: 'Festival open call', opportunityType: 'Open call', organisation: 'Harbour Literature Festival', deadline: inDays(-50), status: 'Shortlisted' },
      { title: 'Essay commission', opportunityType: 'Commission', organisation: 'City Review', deadline: inDays(-200), status: 'Won' },
    ],
    press: [
      { title: 'Review: The Summer House', type: 'Review', outlet: 'The Literary Weekly', date: '2023-05', workId: 0, category: 'press' },
      { title: 'Interview: stories about weather', type: 'Interview', outlet: 'Books Podcast', date: '2025-10', workId: 1, category: 'press' },
      { title: 'First Novel Prize, longlist', outlet: 'Literary Society', date: '2023-09', workId: 0, category: 'award' },
    ],
    board: { name: 'Novel two', items: boardItems('Novel two', 'Write the book only you can write.', ['Mornings for drafting', 'Visit the coast', 'Finish by summer'], ['salt', 'light', 'keepers']) },
  }),
}

// Replaces whatever is in the demo database with the sample studio for this field.
export async function seedDemo(field: DemoField) {
  const s = SEEDS[field]()
  const now = Date.now()
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    const departmentId = await db.departments.add({ name: s.name, discipline: field === 'musician' ? 'music' : field === 'illustrator' ? 'picture_books' : 'painter', activities: s.activities, createdAt: now }) as number

    const workIds: number[] = []
    for (const w of s.works) workIds.push(await db.works.add({ ...w, departmentId }) as number)

    for (const { project, todos } of s.projects) {
      const projectId = await db.projects.add({ ...project, departmentId }) as number
      for (const [title, due, done] of todos) {
        await db.todos.add({ departmentId, projectId, title, done: !!done, kanbanStatus: done ? 'done' : 'todo', dueDate: due == null ? undefined : inDays(due) })
      }
    }

    for (const e of s.events) await db.eventEntries.add({ ...e, departmentId, workIds: e.workIds?.map(i => workIds[i]) })
    for (const o of s.opportunities) await db.opportunities.add({ ...o, departmentId })
    for (const p of s.press) await db.pressEntries.add({ ...p, departmentId, workId: p.workId == null ? undefined : workIds[p.workId] })

    const boardId = await db.boards.add({ departmentId, name: s.board.name, boardType: 'Board', createdAt: now }) as number
    for (const item of s.board.items) await db.boardItems.add({ ...item, boardId, createdAt: now })
  })
}
