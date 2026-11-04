import { db, type Activity, type BoardItem, type EventEntry, type Opportunity, type PressEntry, type Project, type Work } from '../db/db'
import type { DemoField } from './mode'
import { DEMO_CONTACTS } from './demoContacts'

// Sample studios for the open demos. Everyone and everything here is invented.
// Upcoming dates are relative to today, so a demo never looks stale.

// Bump when the sample content changes: every visitor's demo is set up again once.
export const DEMO_VERSION = '2026-11-04a'

const DAY = 864e5
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)

type Todo = [title: string, dueInDays: number | null, done?: boolean]
type Item = Pick<BoardItem, 'itemType' | 'content' | 'x' | 'y' | 'w' | 'h' | 'color'>

interface Seed {
  name: string
  activities: Activity[]
  practiceMode?: 'together' | 'separate'
  practiceNames?: Partial<Record<Activity, string>>
  works: Array<Omit<Work, 'departmentId'>>
  projects: Array<{ project: Omit<Project, 'departmentId'>; todos: Todo[] }>
  // workIds here are indexes into `works`
  events: Array<Omit<EventEntry, 'departmentId'>>
  opportunities: Array<Omit<Opportunity, 'departmentId'>>
  // workId here is an index into `works`
  press: Array<Omit<PressEntry, 'departmentId'>>
  desk: Desk | Desk[]
  board: Vision
}

// The free boxes on the desk. A studio with several practices has a set for each.
interface Desk {
  practice?: Activity
  list: { title: string; items: Array<[string, boolean?]> }
  quote: string
  note: string
  // an index into `opportunities`
  submission: number
}

// A Manifest board: empty picture slots in the middle, aspirational quotes above,
// goals down the left, artist references down the right, joined by connectors.
interface Vision {
  name: string
  quotes: [string, string]
  goals: [string, string, string]
  refs: [string, string, string]
  tags: string[]
}

const P = (title: string, type: string, extra: Partial<Project>, todos: Todo[]) =>
  ({ project: { title, projectType: type, status: 'Active', ...extra }, todos })

const ev = (title: string, type: string, location: string, date: string, extra: Partial<EventEntry> = {}) =>
  ({ title, type, location, date, ...extra })

const op = (title: string, opportunityType: string, organisation: string, due: number, status: string) =>
  ({ title, opportunityType, organisation, deadline: inDays(due), status })

const pr = (title: string, type: string | undefined, outlet: string, date: string, workId?: number, category: 'press' | 'award' = 'press') =>
  ({ title, type, outlet, date, workId, category })

// A studio with several practices, each keeping the sample career of its own demo.
// Separate: shown one practice at a time, each with its own desk boxes.
// Together: one desk and one timeline, the practices' projects side by side and the desk boxes shared.
// `leaveOut` drops projects that the practices would otherwise both have.
function combine(mode: 'together' | 'separate', parts: Array<[Activity, Seed]>, board: Vision, leaveOut: string[] = []): Seed {
  const seed: Seed = {
    name: 'Working Artist', activities: parts.map(([a]) => a), practiceMode: mode,
    practiceNames: Object.assign({}, ...parts.map(([, s]) => s.practiceNames)),
    works: [], projects: [], events: [], opportunities: [], press: [], desk: [], board,
  }
  const desks: Desk[] = []
  const projects: Array<Seed['projects']> = []
  for (const [practice, s] of parts) {
    const w = seed.works.length, o = seed.opportunities.length
    seed.works.push(...s.works.map(x => ({ ...x, practice })))
    projects.push(s.projects.filter(p => !leaveOut.includes(p.project.title)).map(p => ({ ...p, project: { ...p.project, practice } })))
    seed.events.push(...s.events.map(e => ({ ...e, practice, workIds: e.workIds?.map(i => i + w) })))
    seed.opportunities.push(...s.opportunities.map(x => ({ ...x, practice })))
    seed.press.push(...s.press.map(x => ({ ...x, practice, workId: x.workId == null ? undefined : x.workId + w })))
    desks.push(...[s.desk].flat().map(d => ({ ...d, practice, submission: d.submission + o })))
  }
  if (mode === 'separate') return { ...seed, projects: projects.flat(), desk: desks }
  // Together: projects take turns, and one set of desk boxes mixes the practices.
  const turns = Math.max(...projects.map(p => p.length))
  const mixed = Array.from({ length: turns }, (_, i) => projects.map(p => p[i]).filter(Boolean)).flat()
  const [first, second = desks[0]] = desks
  return { ...seed, projects: mixed, desk: { list: first.list, quote: second.quote, note: first.note, submission: first.submission } }
}

type Keyed = Item & { key: string }

function visionLayout(v: Vision): { items: Keyed[]; arrows: Array<[string, string]> } {
  const label = (key: string, content: string, x: number): Keyed =>
    ({ key, itemType: 'text', content, x, y: 168, w: 190, h: 52, color: '#FAFAFA' })
  const items: Keyed[] = [
    { key: 'title', itemType: 'title', content: v.name, x: 469, y: 24, w: 270, h: 72, color: '#FFFFFF' },
    { key: 'hero', itemType: 'image', content: 'Picture', x: 484, y: 136, w: 240, h: 300 },
    { key: 'left', itemType: 'image', content: 'Picture', x: 262, y: 230, w: 180, h: 135 },
    { key: 'right', itemType: 'image', content: 'Picture', x: 770, y: 214, w: 168, h: 168 },
    { key: 'q0', itemType: 'quote', content: v.quotes[0], x: 24, y: 24, w: 240, h: 110, color: '#F5E642' },
    { key: 'q1', itemType: 'quote', content: v.quotes[1], x: 944, y: 24, w: 240, h: 110, color: '#FFFFFF' },
    label('goals', 'Goals', 44),
    label('refs', 'References', 974),
    ...v.goals.map((g, i) => ({ key: `g${i}`, itemType: 'note' as const, content: g, x: 44, y: 236 + i * 92, w: 190, h: 56, color: ['#B8E0A4', '#FFFFFF', '#E8C4B4'][i] })),
    ...v.refs.map((r, i) => ({ key: `r${i}`, itemType: 'note' as const, content: r, x: 974, y: 236 + i * 92, w: 190, h: 68, color: '#F5F5F5' })),
    ...v.tags.map((t, i) => ({ key: `t${i}`, itemType: 'tag' as const, content: t, x: 401 + i * 140, y: 480, w: 125, h: 36, color: '#111111' })),
  ]
  // Every connector runs to the nearest picture, and the side pictures feed the vision in the middle.
  const arrows: Array<[string, string]> = [
    ['q0', 'left'], ['g0', 'left'], ['g1', 'left'], ['g2', 'left'],
    ['q1', 'right'], ['r0', 'right'], ['r1', 'right'], ['r2', 'right'],
    ['left', 'hero'], ['right', 'hero'],
  ]
  return { items, arrows }
}

const SEEDS: Record<DemoField, () => Seed> = {
  musician: () => ({
    name: 'Working Artist',
    activities: ['musician'],
    works: [
      { title: 'Low Tide', category: 'Albums', kind: 'Release', format: 'Album', label: 'Northbound Records', year: 2025, month: 3, location: 'Berlin' },
      { title: 'Paper Lanterns', category: 'EPs', kind: 'Release', format: 'EP', label: 'Self-released', year: 2023, month: 9, location: 'Lisbon' },
      { title: 'Glass Hour', category: 'Singles', kind: 'Release', format: 'Single', label: 'Northbound Records', year: 2026, month: 6, location: 'Berlin' },
      { title: 'Northern Lights (Live)', category: 'Live', kind: 'Release', format: 'Live album', label: 'Northbound Records', year: 2024, month: 2, location: 'Copenhagen' },
      { title: 'Field Recordings, Vol. 1', category: 'Albums', kind: 'Release', format: 'Cassette', label: 'Self-released', year: 2022, month: 11, location: 'London' },
      { title: 'Small Hours', category: 'EPs', kind: 'Release', format: 'EP', label: 'Self-released', year: 2021, month: 5, location: 'Vienna' },
    ],
    projects: [
      P('Second album', 'Release', { label: 'Northbound Records', notes: 'Twelve songs demoed. Choosing nine.' },
        [['Finish lyrics for Harbour', 2], ['Book mixing engineer for January', 5], ['Choose the nine songs', 12], ['Send demos to label', null, true]]),
      P('Spring tour 2027', 'Other', { notes: 'Vienna, Copenhagen, Amsterdam.' },
        [['Confirm Vienna venue', 3], ['Draft tour budget', 9], ['Ask Copenhagen promoter for dates', 16], ['Book the van', null, true]]),
      P('Theatre score: The Orchard', 'Commission', { client: 'Kleines Haus Ensemble' },
        [['Record piano sketches', 1], ['Deliver cue list', 20], ['Read the script twice', null, true]]),
      P('Glass Hour video', 'Release', { label: 'Northbound Records' },
        [['Pick a director', 6], ['Location scout in Lisbon', null, true]]),
      P('Songwriting workshop', 'Other', {},
        [['Write the workshop plan', 4], ['Print lyric sheets', 13]]),
      P('Merch', 'Other', {},
        [['Order tote bags', 8], ['Reprint Low Tide vinyl', null, true]]),
    ],
    events: [
      ev('Small Hours release show', 'Performance', 'Vienna', '2021-05-21', { workIds: [5] }),
      ev('Field Recordings listening', 'Performance', 'London', '2022-11-18', { workIds: [4] }),
      ev('Paper Lanterns tour', 'Performance', 'Lisbon', '2023-10-05', { endDate: '2023-10-08', workIds: [1] }),
      ev('Northern Lights live recording', 'Performance', 'Copenhagen', '2024-02-10', { workIds: [3] }),
      ev('Low Tide release show', 'Performance', 'Berlin', '2025-03-14', { workIds: [0] }),
      ev('Radio session', 'Performance', 'London', '2025-06-02', { workIds: [0] }),
      ev('Summer festival', 'Performance', 'Vienna', '2025-07-19'),
      ev('Showcase', 'Performance', 'Amsterdam', '2026-03-12'),
      ev('Glass Hour listening night', 'Performance', 'Lisbon', '2026-06-20', { workIds: [2] }),
      ev('Songwriting panel', 'Talk', 'Paris', '2026-09-24'),
      ev('Autumn showcase', 'Performance', 'Copenhagen', inDays(12), { goals: 'Meet two promoters\nSell 30 records' }),
      ev('Songwriting talk', 'Talk', 'Vienna', inDays(40)),
      ev('Winter record market', 'Market', 'Berlin', inDays(55), { endDate: inDays(57) }),
      ev('Spring tour: Amsterdam', 'Performance', 'Amsterdam', inDays(150)),
      ev('Japan tour', 'Performance', 'Tokyo', inDays(200), { endDate: inDays(208) }),
    ],
    opportunities: [
      op('Tour support grant', 'Grant', 'Music Fund Berlin', 21, 'Active'),
      op('Showcase application', 'Open call', 'City Sounds Showcase', 30, 'Active'),
      op('Festival open call', 'Open call', 'North Shore Festival', 9, 'Draft'),
      op('Composer fund', 'Grant', 'New Music Fund', 45, 'Draft'),
      op('Studio residency', 'Residency', 'Harbour Studios', -30, 'Applied'),
      op('Film score commission', 'Commission', 'Northlight Films', -20, 'Applied'),
      op('Sync brief: coffee advert', 'Commission', 'Field Agency', -12, 'Shortlisted'),
      op('Radio feature pitch', 'Press', 'Late Night Radio', -60, 'Won'),
      op('Lake festival', 'Open call', 'Lake Festival', -120, 'Closed'),
    ],
    press: [
      pr('Low Tide reviewed', 'Review', 'Soundcheck Magazine', '2025-04', 0),
      pr('Album of the month', 'Selection', 'Northern Music Blog', '2025-04', 0),
      pr('Interview: writing by the sea', 'Interview', 'City Radio', '2025-05'),
      pr('Live review: Copenhagen', 'Review', 'Nordic Sound', '2024-03', 3),
      pr('New voices', 'Profile', 'Weekend Paper', '2023-11', 1),
      pr('Glass Hour premiere', 'Feature', 'Indie Weekly', '2026-06', 2),
      pr('Best Independent Album, shortlist', undefined, 'Independent Music Prize', '2025-11', 0, 'award'),
      pr('Young Songwriter Award, winner', undefined, 'Songwriters Guild', '2023-12', 1, 'award'),
    ],
    desk: {
      list: { title: 'Setlist, Copenhagen', items: [['Low Tide'], ['Glass Hour'], ['Harbour (new)'], ['Paper Lanterns'], ['Small Hours']] },
      quote: 'Play the room you are in.',
      note: 'Call the label on Thursday',
      submission: 0,
    },
    board: { name: '2027',
      quotes: ['Play the room you are in.', 'Make the record you want to hear.'],
      goals: ['Finish album two', 'Tour three cities', 'Teach one workshop'],
      refs: ['Joni Mitchell, open tunings', 'Nils Frahm, the room as instrument', 'Arthur Russell, cello and echo'],
      tags: ['slow', 'warm', 'live'] },
  }),

  painter: () => ({
    name: 'Working Artist',
    activities: ['visual_artist'],
    practiceNames: { visual_artist: 'Painter' },
    works: [
      { title: 'Salt Flats I', category: 'Paintings', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 5, location: 'Lisbon', collection: 'Private collection' },
      { title: 'Salt Flats II', category: 'Paintings', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 7, location: 'Lisbon' },
      { title: 'Interior with Blue Chair', category: 'Paintings', kind: 'Artwork', medium: 'Oil on canvas', dimensions: '80 × 60 cm', year: 2025, month: 2, location: 'Berlin', collection: 'Available' },
      { title: 'Night Garden', category: 'Works on paper', kind: 'Artwork', medium: 'Acrylic and pastel on paper', dimensions: '50 × 70 cm', year: 2025, month: 10, location: 'Berlin' },
      { title: 'Study for a Window', category: 'Studies', kind: 'Artwork', medium: 'Oil on panel', dimensions: '30 × 24 cm', year: 2026, month: 4, location: 'Berlin' },
      { title: 'Red Room', category: 'Paintings', kind: 'Artwork', medium: 'Oil on canvas', dimensions: '150 × 120 cm', year: 2023, month: 11, location: 'Vienna', collection: 'City Museum' },
      { title: 'Orchard, Morning', category: 'Works on paper', kind: 'Artwork', medium: 'Gouache on paper', dimensions: '40 × 30 cm', year: 2026, month: 6, location: 'Lisbon' },
      { title: 'Green Hour', category: 'Paintings', kind: 'Artwork', medium: 'Oil on linen', dimensions: '100 × 80 cm', year: 2026, month: 8, location: 'Berlin', collection: 'Available' },
    ],
    projects: [
      P('Solo show: Quiet Rooms', 'Exhibition', { location: 'Berlin', institution: 'Galerie Nordlicht', dateStart: inDays(45), dateEnd: inDays(80) },
        [['Finalise works list', 1], ['Order frames', 3], ['Write press text', 10], ['Photograph new paintings', null, true]]),
      P('Lobby commission', 'Commission', { client: 'Hotel Linde' },
        [['Send three sketch options', 2], ['Agree fee and timeline', null, true]]),
      P('Catalogue', 'Publications', {},
        [['Ask a writer for the essay', 5], ['Choose 20 images', 12]]),
      P('Residency: Lisbon', 'Residency', { location: 'Lisbon', institution: 'Atlantic Studios', dateStart: inDays(120), dateEnd: inDays(180) },
        [['Book flights', 20], ['Ship materials', 60]]),
      P('Art fair: Madrid', 'Exhibition', { location: 'Madrid', dateStart: inDays(130), dateEnd: inDays(134) },
        [['Choose three works', 14]]),
      P('Studio move', 'Other', {},
        [['Measure the new studio', 4], ['Pack canvases', 21], ['Sign the lease', null, true]]),
    ],
    events: [
      ev('Red Room, solo show', 'Exhibition', 'Vienna', '2023-11-10', { endDate: '2024-01-20', workIds: [5] }),
      ev('Summer show', 'Exhibition', 'Lisbon', '2024-07-05', { endDate: '2024-08-30', workIds: [1] }),
      ev('Group show: Surface', 'Exhibition', 'Vienna', '2024-09-12', { endDate: '2024-11-03', workIds: [0] }),
      ev('Art fair booth', 'Exhibition', 'Madrid', '2025-02-26', { endDate: '2025-03-02', workIds: [2] }),
      ev('Open studio', 'Other', 'Berlin', '2025-05-17'),
      ev('Prize exhibition', 'Exhibition', 'Paris', '2025-06-12', { endDate: '2025-07-15', workIds: [2] }),
      ev('Window show', 'Exhibition', 'London', '2026-05-02', { endDate: '2026-06-10', workIds: [4] }),
      ev('Gallery night', 'Exhibition', 'Amsterdam', '2026-09-18', { workIds: [7] }),
      ev('Quiet Rooms opening', 'Exhibition', 'Berlin', inDays(45), { endDate: inDays(80), workIds: [3, 4, 7], goals: 'Sell two paintings\nInvite five collectors' }),
      ev('Artist talk', 'Talk', 'Berlin', inDays(52)),
      ev('Christmas print market', 'Market', 'Berlin', inDays(60)),
      ev('Paper fair', 'Exhibition', 'New York', inDays(200), { endDate: inDays(204) }),
    ],
    opportunities: [
      op('Painting prize 2027', 'Open call', 'City Art Foundation', 18, 'Active'),
      op('Museum acquisitions', 'Open call', 'City Museum', 25, 'Active'),
      op('Studio grant', 'Grant', 'Arts Council Fund', 33, 'Draft'),
      op('Print edition', 'Commission', 'Edition Press', 8, 'Draft'),
      op('Residency in Lisbon', 'Residency', 'Atlantic Studios', -40, 'Applied'),
      op('Travel grant', 'Grant', 'Arts Council Fund', -10, 'Applied'),
      op('Public art commission', 'Commission', 'Town of Riverside', -20, 'Shortlisted'),
      op('Young painters award', 'Open call', 'Painters Society', -150, 'Won'),
      op('Summer group show', 'Open call', 'Kunstraum West', -90, 'Closed'),
    ],
    press: [
      pr('Red Room reviewed', 'Review', 'Gallery Review', '2023-12', 5),
      pr('Review: Surface', 'Review', 'Vienna Art Notes', '2024-10', 0),
      pr('Studio visit', 'Feature', 'Art Weekly', '2025-03'),
      pr('Interview: painting light', 'Interview', 'Colour Podcast', '2025-11'),
      pr('Ten painters to watch', 'Selection', 'City Magazine', '2026-01'),
      pr('Window show review', 'Review', 'London Art Letter', '2026-05', 4),
      pr('Studio Prize, winner', undefined, 'Painters Society', '2024-12', 0, 'award'),
      pr('Young Painters Prize, shortlist', undefined, 'City Art Foundation', '2025-06', 2, 'award'),
    ],
    desk: {
      list: { title: 'Studio supplies', items: [['Linen, 2 m'], ['Cadmium yellow'], ['Stretcher bars 120 × 90'], ['Varnish', true]] },
      quote: 'Paint what the light does, not what the thing is.',
      note: 'Collector visit Friday, 3 pm',
      submission: 0,
    },
    board: { name: 'Next body of work',
      quotes: ['Paint what the light does, not what the thing is.', 'Fewer, larger, slower.'],
      goals: ['Larger canvases', 'Show in Lisbon', 'Paint every morning'],
      refs: ['Agnes Martin, pale grids', 'Pierre Bonnard, interiors', 'Etel Adnan, small mountains'],
      tags: ['quiet', 'light', 'rooms'] },
  }),

  illustrator: () => ({
    name: 'Working Artist',
    activities: ['picture_book'],
    works: [
      { title: 'The Fox Who Kept the Moon', category: 'Picture books', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2024-09', year: 2024, month: 9, language: 'English',
        credits: 'Text by Mara Holt, illustrated by Ines Okafor', pages: 32, dimensions: '24 × 30 cm', technique: 'Gouache, pencil', location: 'London',
        contract: { currency: '€', price: 16, binding: 'Hardcover', printRun: 4000, advance: 4000, advancePaid: 'full', royaltyRate: 5, royaltyBase: 'retail', territory: 'World, English language', signed: '2023-02' },
        rights: [
          { id: 'r1', language: 'German', publisher: 'Blauer Verlag', year: 2025, status: 'sold', advance: 2000, royaltyRate: 6, printRun: 3000 },
          { id: 'r2', language: 'French', publisher: 'Éditions Lune', year: 2025, status: 'live', advance: 1800 },
          { id: 'r3', language: 'Korean', status: 'pending' },
        ] },
      { title: 'Hush, Little Harbour', category: 'Picture books', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2026-05', year: 2026, month: 5, language: 'English',
        credits: 'Written and illustrated by Ines Okafor', pages: 40, dimensions: '25 × 25 cm', technique: 'Gouache, coloured pencil', location: 'London',
        contract: { currency: '€', price: 17, binding: 'Hardcover', printRun: 5000, advance: 6000, advancePaid: 'part', royaltyRate: 7, royaltyBase: 'retail', territory: 'World, all languages', signed: '2024-06' },
        rights: [{ id: 'r1', language: 'Dutch', publisher: 'Uitgeverij Zee', year: 2026, status: 'sold', advance: 1500 }] },
      { title: "Grandma's Garden", category: 'Picture books', kind: 'Book', publisher: 'Small Steps Press', publishedDate: '2022-04', year: 2022, month: 4, language: 'German',
        credits: 'Text by Ana Weiss, illustrated by Ines Okafor', pages: 28, dimensions: '22 × 28 cm', technique: 'Watercolour', location: 'Berlin' },
      { title: 'Autumn cover', category: 'Covers', kind: 'Illustration', publisher: 'City Magazine', publishedDate: '2025-10', year: 2025, month: 10, medium: 'Gouache, digital' },
      { title: 'Book festival poster', category: 'Posters', kind: 'Illustration', publisher: "Children's Book Festival", publishedDate: '2026-02', year: 2026, month: 2, medium: 'Gouache', location: 'Paris' },
      { title: 'Reading in bed', category: 'Editorial', kind: 'Illustration', publisher: 'Weekend Books', publishedDate: '2025-03', year: 2025, month: 3, medium: 'Pencil, digital' },
      { title: 'Snow Days, character sheet', category: 'Character sheets', kind: 'Illustration', publisher: 'Little Lantern Books', publishedDate: '2026-08', year: 2026, month: 8, medium: 'Gouache' },
    ],
    projects: [
      P('Picture book three: Snow Days', 'Books', { publisher: 'Little Lantern Books', author: 'Ines Okafor' },
        [['Thumbnails for spreads 1 to 8', 2], ['Final art due', 60], ['Character sheet to editor', null, true]]),
      P('Book fair portfolio', 'Other', {},
        [['Print ten portfolio samples', 12], ['Book meetings with three agents', 20]]),
      P('School visits', 'Other', {},
        [['Prepare drawing workshop', 4], ['Pack fox puppets', 5]]),
      P('Magazine series', 'Commission', { client: 'City Magazine' },
        [['Sketches for issue 3', 3], ['Invoice issue 2', null, true]]),
      P('Original art show', 'Exhibition', { location: 'Paris', dateStart: inDays(90), dateEnd: inDays(120) },
        [['Choose the originals', 25]]),
      P('German edition', 'Publications', { publisher: 'Blauer Verlag' },
        [['Check lettering in proofs', 6]]),
    ],
    events: [
      ev("Grandma's Garden launch", 'Reading', 'Berlin', '2022-05-14', { workIds: [2] }),
      ev('Launch reading: The Fox Who Kept the Moon', 'Reading', 'London', '2024-09-21', { workIds: [0] }),
      ev('Library tour', 'Reading', 'Vienna', '2025-03-10', { endDate: '2025-03-14', workIds: [0] }),
      ev('Book fair talk', 'Talk', 'Bologna', '2025-04-01'),
      ev('Illustration exhibition', 'Exhibition', 'Paris', '2025-11-08', { endDate: '2025-12-20', workIds: [4] }),
      ev('Hush, Little Harbour launch', 'Reading', 'Amsterdam', '2026-05-30', { workIds: [1] }),
      ev('Festival signing', 'Reading', 'Dublin', '2026-08-22', { workIds: [1] }),
      ev('School workshop', 'Talk', 'Berlin', inDays(16)),
      ev('Christmas book market', 'Market', 'Vienna', inDays(58), { endDate: inDays(59) }),
      ev('Original art show', 'Exhibition', 'Paris', inDays(90), { endDate: inDays(120) }),
      ev("Children's book fair", 'Book Fair', 'Bologna', inDays(170), { endDate: inDays(173), goals: 'Show Snow Days to two foreign publishers\nMeet an agent' }),
    ],
    opportunities: [
      op('Picture book competition', 'Open call', 'Picture Book Prize', 10, 'Active'),
      op('International illustration prize', 'Open call', 'Illustrators Guild', 25, 'Active'),
      op('Translation grant', 'Grant', 'Book Translation Fund', 40, 'Draft'),
      op('Proposal: Snow Days, German edition', 'Publisher proposal', 'Blauer Verlag', -14, 'Applied'),
      op('Proposal: Hush in Korean', 'Publisher proposal', 'Haneul Books', -5, 'Applied'),
      op('Residency for illustrators', 'Residency', 'Seaside Studio', -45, 'Shortlisted'),
      op('Magazine cover pitch', 'Commission', 'City Magazine', -120, 'Won'),
      op('Festival poster', 'Commission', "Children's Book Festival", -200, 'Won'),
      op('Debut grant', 'Grant', 'Arts Council Fund', -300, 'Closed'),
    ],
    press: [
      pr("Grandma's Garden reviewed", 'Review', 'Family Reading', '2022-06', 2),
      pr('Five picture books for autumn', 'Selection', 'Weekend Books', '2024-10', 0),
      pr('Picture books of the year', 'Selection', 'City Paper', '2024-12', 0),
      pr('Interview: drawing foxes', 'Interview', 'Picture Book Podcast', '2025-01', 0),
      pr('Studio visit', 'Feature', 'Illustration Now', '2025-09'),
      pr('Review: Hush, Little Harbour', 'Review', "Children's Books Review", '2026-06', 1),
      pr('Debut Picture Book Award, winner', undefined, 'Illustrators Guild', '2025-03', 0, 'award'),
      pr('Illustration Prize, shortlist', undefined, 'Picture Book Prize', '2026-09', 1, 'award'),
    ],
    desk: {
      list: { title: 'Book fair to do', items: [['Portfolio prints'], ['Business cards'], ['Meetings list'], ['Train tickets', true]] },
      quote: 'Leave room for the reader.',
      note: 'Editor call Wednesday',
      submission: 0,
    },
    board: { name: 'Book three',
      quotes: ['Leave room for the reader.', 'Draw it the way a child would remember it.'],
      goals: ['Finish by spring', 'One spread without words', 'Show it at the book fair'],
      refs: ['Tove Jansson, Moomin winters', 'Beatrice Alemagna, texture', 'Jon Klassen, the pause'],
      tags: ['snow', 'quiet', 'play'] },
  }),

  writer: () => ({
    name: 'Working Artist',
    activities: ['writer'],
    works: [
      { title: 'The Summer House', category: 'Novels', kind: 'Book', subtitle: 'A novel', publisher: 'Harbour Press', publishedDate: '2023-04', year: 2023, month: 4, language: 'English', pages: 280, location: 'London',
        contract: { currency: '€', price: 20, binding: 'Hardcover', printRun: 5000, advance: 8000, advancePaid: 'full', royaltyRate: 10, royaltyBase: 'retail', royaltySteps: '12.5% from 10,000 copies', territory: 'World, English language', signed: '2021-11', agent: 'Ruth Adler', agentCommission: 15 },
        rights: [
          { id: 'r1', language: 'German', publisher: 'Nordwind Verlag', year: 2024, status: 'sold', advance: 3500 },
          { id: 'r2', language: 'Portuguese', publisher: 'Edições Mar', year: 2025, status: 'live' },
          { id: 'r3', language: 'Danish', status: 'pending' },
        ] },
      { title: 'Small Weather', category: 'Short stories', kind: 'Book', subtitle: 'Stories', publisher: 'Harbour Press', publishedDate: '2025-09', year: 2025, month: 9, language: 'English', pages: 190, location: 'Dublin',
        contract: { currency: '€', price: 18, binding: 'Paperback', printRun: 3000, advance: 5000, advancePaid: 'part', royaltyRate: 7.5, royaltyBase: 'retail', signed: '2024-03', agent: 'Ruth Adler', agentCommission: 15 } },
      { title: 'Das Sommerhaus', category: 'Translations', kind: 'Book', subtitle: 'Roman', publisher: 'Nordwind Verlag', publishedDate: '2024-09', year: 2024, month: 9, language: 'German', credits: 'Translated by Jonas Berg', pages: 296, location: 'Berlin' },
      { title: 'On Walking', category: 'Essays', kind: 'Other', medium: 'Essay, City Review', year: 2024, month: 3 },
      { title: 'Salt', category: 'Short stories', kind: 'Other', medium: 'Short story, Coastal Review', year: 2022, month: 6 },
      { title: 'Letters from Lisbon', category: 'Essays', kind: 'Other', medium: 'Essay, Weekend Magazine', year: 2025, month: 12 },
    ],
    projects: [
      P('Novel two: The Lighthouse Keepers', 'Books', { publisher: 'Harbour Press' },
        [['Finish chapter 9', 1], ['Rewrite the opening', 6], ['Send first half to agent', 30], ['Research trip notes', null, true]]),
      P('Festival season', 'Other', {},
        [['Prepare reading excerpt', 5], ['Confirm travel to Lisbon', 11]]),
      P('German edition edits', 'Publications', { publisher: 'Nordwind Verlag' },
        [['Answer translator queries', 3]]),
      P('Essay commission', 'Commission', { client: 'City Review' },
        [['Draft 2,000 words', 9], ['Agree the fee', null, true]]),
      P('Writing workshop', 'Other', {},
        [['Prepare prompts', 13]]),
      P('Grant report', 'Other', {},
        [['Send report to the fund', 4]]),
    ],
    events: [
      ev('The Summer House launch', 'Reading', 'London', '2023-04-20', { workIds: [0] }),
      ev('Festival reading', 'Reading', 'Oslo', '2024-06-14', { workIds: [0] }),
      ev('German edition reading', 'Reading', 'Berlin', '2024-10-10', { workIds: [2] }),
      ev('Book club evening', 'Reading', 'Amsterdam', '2025-02-20', { workIds: [0] }),
      ev('Translation panel', 'Talk', 'Vienna', '2025-05-15'),
      ev('Small Weather launch', 'Reading', 'Dublin', '2025-09-18', { workIds: [1] }),
      ev('Panel: writing place', 'Talk', 'Berlin', '2025-10-02'),
      ev('Literature festival reading', 'Reading', 'Lisbon', inDays(24), { workIds: [1], goals: 'Sell 40 copies\nMeet the Portuguese editor' }),
      ev('Writing workshop', 'Talk', 'Vienna', inDays(48)),
      ev('Reading tour', 'Reading', 'Zurich', inDays(75), { endDate: inDays(78) }),
      ev('Library talk', 'Talk', 'Copenhagen', inDays(100)),
      ev('Book fair', 'Book Fair', 'Frankfurt', inDays(365), { endDate: inDays(369) }),
    ],
    opportunities: [
      op('Radio story pitch', 'Press', 'Story Hour Radio', 6, 'Active'),
      op('Short story prize', 'Open call', 'Coastal Writing Prize', 14, 'Active'),
      op('Writing residency', 'Residency', 'House of Letters', 35, 'Draft'),
      op('Novel grant', 'Grant', 'Literature Fund', 60, 'Draft'),
      op('Translation grant, Portuguese edition', 'Grant', 'Literature Abroad Fund', -25, 'Applied'),
      op('Anthology call', 'Open call', 'Coastal Review', -15, 'Applied'),
      op('Festival open call', 'Open call', 'Harbour Literature Festival', -50, 'Shortlisted'),
      op('Essay commission', 'Commission', 'City Review', -200, 'Won'),
      op('Fellowship', 'Residency', 'House of Letters', -300, 'Closed'),
    ],
    press: [
      pr('Debut of the month', 'Selection', 'City Paper', '2023-04', 0),
      pr('Review: The Summer House', 'Review', 'The Literary Weekly', '2023-05', 0),
      pr('Writing the coast', 'Profile', 'Weekend Magazine', '2024-07'),
      pr('Das Sommerhaus reviewed', 'Review', 'Bücher Heute', '2024-11', 2),
      pr('Interview: stories about weather', 'Interview', 'Books Podcast', '2025-10', 1),
      pr('Review: Small Weather', 'Review', 'Sunday Books', '2025-10', 1),
      pr('First Novel Prize, longlist', undefined, 'Literary Society', '2023-09', 0, 'award'),
      pr('Short Story Award, winner', undefined, 'Coastal Writing Prize', '2025-12', 1, 'award'),
    ],
    desk: {
      list: { title: 'Chapter 9', items: [['Storm scene'], ['Letter from Ana'], ['End at the lighthouse', true]] },
      quote: 'Write the book only you can write.',
      note: 'Agent lunch Tuesday',
      submission: 1,
    },
    board: { name: 'Novel two',
      quotes: ['Write the book only you can write.', 'Two pages a day, every day.'],
      goals: ['Finish by summer', 'Visit the coast', 'Read it aloud'],
      refs: ['Virginia Woolf, To the Lighthouse', 'Tove Ditlevsen, plainness', 'Jon Fosse, the sea'],
      tags: ['salt', 'light', 'keepers'] },
  }),

  fineart: () => ({
    name: 'Working Artist',
    activities: ['visual_artist'],
    practiceNames: { visual_artist: 'Artist' },
    works: [
      { title: 'Tidal Archive', category: 'Installations', kind: 'Artwork', medium: 'Installation: salt, glass and sound', dimensions: 'Room, 6 × 9 m', year: 2024, month: 4, location: 'Rotterdam' },
      { title: 'Weight of Water', category: 'Sculpture', kind: 'Artwork', medium: 'Cast bronze', dimensions: '42 × 30 × 28 cm', year: 2023, month: 9, location: 'Vienna', collection: 'Private collection' },
      { title: 'Small Monuments', category: 'Sculpture', kind: 'Artwork', medium: 'Glazed ceramic, 12 parts', dimensions: 'Variable', year: 2025, month: 3, location: 'Berlin', collection: 'Available' },
      { title: 'Field Notes', category: 'Video', kind: 'Artwork', medium: 'Single-channel video, 14 min', year: 2025, month: 8, location: 'Lisbon' },
      { title: 'Cloud Index', category: 'Works on paper', kind: 'Artwork', medium: 'Graphite and ink on paper', dimensions: '70 × 100 cm', year: 2022, month: 6, location: 'Copenhagen', collection: 'Kunsthalle collection' },
      { title: 'Breathing Wall', category: 'Installations', kind: 'Artwork', medium: 'Installation: textile and motors', dimensions: '4 × 12 m', year: 2026, month: 5, location: 'Venice' },
      { title: 'Common Ground', category: 'Sculpture', kind: 'Artwork', medium: 'Public sculpture: concrete and moss', dimensions: '3 × 8 m', year: 2026, month: 9, location: 'Zurich' },
    ],
    projects: [
      P('Biennale installation', 'Exhibition', { location: 'Venice', institution: 'Nordic Pavilion', dateStart: inDays(60), dateEnd: inDays(240) },
        [['Finalise floor plan', 2], ['Ship the glass panels', 9], ['Write wall text', 15], ['Site visit', null, true]]),
      P('Public sculpture: Common Ground', 'Commission', { client: 'City of Zurich' },
        [['Send foundation drawings', 3], ['Choose the moss supplier', 11], ['Sign the contract', null, true]]),
      P('Artist book', 'Publications', {},
        [['Choose the images', 6], ['Ask printers for quotes', 13]]),
      P('Residency: Kyoto', 'Residency', { location: 'Kyoto', institution: 'Villa Kamogawa', dateStart: inDays(150), dateEnd: inDays(240) },
        [['Visa paperwork', 20], ['Plan the first month', 45]]),
      P('Studio assistants', 'Other', {},
        [['Interview two assistants', 5], ['Set up payroll', null, true]]),
      P('Gallery dinner', 'Other', {},
        [['Draft the guest list', 8]]),
    ],
    events: [
      ev('Cloud Index, group show', 'Exhibition', 'Copenhagen', '2022-06-10', { endDate: '2022-08-21', workIds: [4] }),
      ev('Weight of Water, solo show', 'Exhibition', 'Vienna', '2023-09-14', { endDate: '2023-11-12', workIds: [1] }),
      ev('Tidal Archive premiere', 'Exhibition', 'Rotterdam', '2024-04-20', { endDate: '2024-07-14', workIds: [0] }),
      ev('Tidal Archive on tour', 'Exhibition', 'Oslo', '2024-10-03', { endDate: '2025-01-12', workIds: [0] }),
      ev('Small Monuments', 'Exhibition', 'Berlin', '2025-03-07', { endDate: '2025-04-26', workIds: [2] }),
      ev('Screening: Field Notes', 'Other', 'Lisbon', '2025-09-18', { workIds: [3] }),
      ev('Artist talk', 'Talk', 'London', '2025-11-20'),
      ev('Art fair booth', 'Exhibition', 'Basel', '2026-06-16', { endDate: '2026-06-21', workIds: [2] }),
      ev('Biennale opening', 'Exhibition', 'Venice', inDays(60), { endDate: inDays(240), workIds: [5], goals: 'Meet three curators\nFilm the installation' }),
      ev('Common Ground unveiling', 'Other', 'Zurich', inDays(95), { workIds: [6] }),
      ev('Studio open day', 'Other', 'Berlin', inDays(30)),
    ],
    opportunities: [
      op('Sculpture prize 2027', 'Open call', 'Foundation for Sculpture', 16, 'Active'),
      op('Production grant', 'Grant', 'Contemporary Art Fund', 28, 'Draft'),
      op('Museum commission', 'Commission', 'Kunsthalle Nord', 40, 'Active'),
      op('Video art festival', 'Open call', 'Moving Image Days', -30, 'Shortlisted'),
      op('Travel grant', 'Grant', 'Arts Council Fund', -12, 'Applied'),
      op('Residency in Kyoto', 'Residency', 'Villa Kamogawa', -60, 'Won'),
      op('Public art competition', 'Commission', 'City of Zurich', -200, 'Won'),
      op('Group show: Material', 'Open call', 'Kunstraum Ost', -120, 'Closed'),
    ],
    press: [
      pr('Tidal Archive reviewed', 'Review', 'Art Monthly North', '2024-05', 0),
      pr('Salt and sound', 'Feature', 'Sculpture Today', '2024-06', 0),
      pr('Interview: working with water', 'Interview', 'Studio Radio', '2025-02'),
      pr('Small Monuments review', 'Review', 'Berlin Art Letter', '2025-03', 2),
      pr('Artists for the Biennale', 'Selection', 'The Art Paper', '2026-02'),
      pr('Sculpture Prize, winner', undefined, 'Foundation for Sculpture', '2024-11', 1, 'award'),
      pr('Moving Image Award, shortlist', undefined, 'Moving Image Days', '2025-10', 3, 'award'),
    ],
    desk: {
      list: { title: 'Biennale shipping', items: [['Crate the glass panels'], ['Insurance papers'], ['Sound equipment list'], ['Salt, 400 kg', true]] },
      quote: 'Make the room do the work.',
      note: 'Curator call Thursday, 10 am',
      submission: 0,
    },
    board: { name: 'Next five years',
      quotes: ['Make the room do the work.', 'Stay curious about materials.'],
      goals: ['A museum solo show', 'Work outside the gallery', 'Teach a summer school'],
      refs: ['Ann Hamilton, sound rooms', 'Doris Salcedo, memory', 'Olafur Eliasson, light'],
      tags: ['material', 'space', 'time'] },
  }),

  filmmaker: () => ({
    name: 'Working Artist',
    activities: ['filmmaker'],
    works: [
      { title: 'Salt Road', category: 'Documentaries', kind: 'Film', format: 'Short documentary', runtime: '24 min', production: 'Northlight Films', credits: 'Written and directed by the artist', language: 'Portuguese, English', publishedDate: '2025-02', year: 2025, month: 2, location: 'Lisbon' },
      { title: 'The Quiet Hour', category: 'Shorts', kind: 'Film', format: 'Short fiction', runtime: '14 min', production: 'Self-produced', credits: 'Written and directed by the artist', language: 'English', publishedDate: '2023-06', year: 2023, month: 6, location: 'London' },
      { title: 'Field Recordings', category: 'Shorts', kind: 'Film', format: 'Experimental short', runtime: '9 min', production: 'Self-produced', language: 'No dialogue', publishedDate: '2022-10', year: 2022, month: 10, location: 'Copenhagen' },
      { title: 'Harbour Lights', category: 'Music videos', kind: 'Film', format: 'Music video', runtime: '4 min', production: 'Northbound Records', credits: 'Directed by the artist', publishedDate: '2024-05', year: 2024, month: 5, location: 'Berlin' },
      { title: 'Borrowed Rooms', category: 'Series', kind: 'Film', format: 'Documentary series, 3 episodes', runtime: '3 × 18 min', production: 'Arte Kurzfilm', language: 'German, French', publishedDate: '2026-04', year: 2026, month: 4, location: 'Berlin' },
      { title: 'Tidewater', category: 'Features', kind: 'Film', format: 'Feature fiction (in development)', runtime: '95 min', production: 'Northlight Films', credits: 'Written and directed by the artist', language: 'English', year: 2027, month: 9, location: 'Rotterdam' },
    ],
    projects: [
      P('Tidewater', 'Film', { client: 'Northlight Films', location: 'Rotterdam', dateStart: inDays(160), dateEnd: inDays(200), releaseDate: inDays(420).slice(0, 7) },
        [['Send revised script to producer', 2], ['Casting call for the lead', 9], ['Location scout in Rotterdam', 18], ['Apply to the script lab', null, true]]),
      P('Salt Road festival run', 'Film', { client: 'Northlight Films', releaseDate: '2025-02' },
        [['Export DCP for Venice', 3], ['Subtitles in French', 7], ['Update press kit', 12], ['Submit to Clermont-Ferrand', null, true]]),
      P('Music video: Glass Hour', 'Commission', { client: 'Northbound Records' },
        [['Treatment to the band', 1], ['Book the camera', 6]]),
      P('Borrowed Rooms, episode 3', 'Film', { client: 'Arte Kurzfilm', location: 'Paris', dateStart: inDays(20), dateEnd: inDays(34) },
        [['Interview schedule', 4], ['Archive footage licence', 10], ['Rough cut to the editor', 30]]),
      P('Residency: Berlinale Talents', 'Residency', { location: 'Berlin', institution: 'Berlinale Talents', dateStart: inDays(100), dateEnd: inDays(106) },
        [['Prepare the pitch', 40]]),
      P('Teaching: film school workshop', 'Other', {},
        [['Choose three clips', 5], ['Send the reading list', 11]]),
    ],
    events: [
      ev('Field Recordings premiere', 'Screening', 'Copenhagen', '2022-10-14', { workIds: [2] }),
      ev('The Quiet Hour premiere', 'Screening', 'London', '2023-06-09', { workIds: [1] }),
      ev('Short film festival', 'Festival', 'Rotterdam', '2024-01-27', { endDate: '2024-02-04', workIds: [1] }),
      ev('Harbour Lights launch', 'Screening', 'Berlin', '2024-05-17', { workIds: [3] }),
      ev('Salt Road world premiere', 'Festival', 'Berlin', '2025-02-16', { endDate: '2025-02-23', workIds: [0] }),
      ev('Salt Road at Clermont-Ferrand', 'Festival', 'Paris', '2025-09-12', { workIds: [0] }),
      ev('Q&A after the screening', 'Talk', 'Lisbon', '2025-11-08', { workIds: [0] }),
      ev('Borrowed Rooms broadcast', 'Screening', 'Paris', '2026-04-20', { workIds: [4] }),
      ev('Salt Road in Venice', 'Festival', 'Venice', inDays(40), { endDate: inDays(50), workIds: [0], goals: 'Meet two sales agents\nFind a co-producer for Tidewater' }),
      ev('Film school workshop', 'Talk', 'Amsterdam', inDays(26)),
      ev('Tidewater pitch', 'Talk', 'Berlin', inDays(100), { workIds: [5] }),
    ],
    opportunities: [
      op('Script development fund', 'Grant', 'Film Fund North', 12, 'Active'),
      op('Short film festival 2027', 'Open call', 'Rotterdam Shorts', 21, 'Active'),
      op('Co-production market', 'Open call', 'CineLink', 34, 'Draft'),
      op('Directors lab', 'Residency', 'Script Lab Europe', -30, 'Shortlisted'),
      op('Production grant', 'Grant', 'Media Fund', -15, 'Applied'),
      op('Berlinale Talents', 'Residency', 'Berlinale Talents', -90, 'Won'),
      op('Documentary pitch forum', 'Open call', 'DocForum', -160, 'Won'),
      op('TV commission round', 'Commission', 'Arte Kurzfilm', -200, 'Closed'),
    ],
    press: [
      pr('The Quiet Hour reviewed', 'Review', 'Short Film Weekly', '2023-07', 1),
      pr('New voices in documentary', 'Selection', 'Screen Notes', '2025-01'),
      pr('Salt Road reviewed', 'Review', 'Festival Daily', '2025-02', 0),
      pr('Interview: filming the coast', 'Interview', 'Cinema Podcast', '2025-03', 0),
      pr('Borrowed Rooms feature', 'Feature', 'TV Guide Europe', '2026-04', 4),
      pr('Best Short Documentary, winner', undefined, 'Rotterdam Shorts', '2025-02', 0, 'award'),
      pr('Young Director Award, shortlist', undefined, 'European Film Forum', '2023-11', 1, 'award'),
    ],
    desk: {
      list: { title: 'Shoot kit', items: [['Spare batteries'], ['Lav mics ×2'], ['Release forms'], ['Hard drives, 4 TB', true]] },
      quote: 'Cut what you love if it isn’t the film.',
      note: 'Producer call Monday, 11 am',
      submission: 0,
    },
    board: { name: 'Next five years',
      quotes: ['Cut what you love if it isn’t the film.', 'Find the story in the edit.'],
      goals: ['Shoot the first feature', 'A film in Cannes', 'Work with a sales agent'],
      refs: ['Agnès Varda, essay films', 'Chantal Akerman, long takes', 'Kelly Reichardt, landscapes'],
      tags: ['coast', 'light', 'time'] },
  }),

  photographer: () => ({
    name: 'Working Artist',
    activities: ['photographer'],
    works: [
      { title: 'Low Water', category: 'Series', kind: 'Artwork', medium: 'Archival pigment print, edition of 5', dimensions: '100 × 125 cm', year: 2024, month: 3, location: 'Rotterdam', collection: 'Harbour Photo Museum' },
      { title: 'Saltpans, Aveiro', category: 'Series', kind: 'Artwork', medium: 'C-type print, edition of 7', dimensions: '80 × 100 cm', year: 2023, month: 8, location: 'Lisbon', collection: 'Private collection' },
      { title: 'Night Ferries', category: 'Series', kind: 'Artwork', medium: 'Archival pigment print, edition of 5', dimensions: '60 × 75 cm', year: 2025, month: 1, location: 'Copenhagen', collection: 'Available' },
      { title: 'Borrowed Light', category: 'Photobooks', kind: 'Book', subtitle: 'Photographs 2019 to 2024', publisher: 'Harbour Editions', publishedDate: '2025-05', year: 2025, month: 5, language: 'English',
        credits: 'Photographs by the artist, essay by Lotte Brandt', pages: 120, dimensions: '24 × 30 cm', technique: 'Offset, Swiss binding', location: 'Copenhagen' },
      { title: 'Harbour Workers', category: 'Portraits', kind: 'Artwork', medium: 'Silver gelatin print, edition of 10', dimensions: '40 × 50 cm', year: 2022, month: 10, location: 'Hamburg' },
      { title: 'Tidal Studies', category: 'Series', kind: 'Artwork', medium: 'Archival pigment print, edition of 3', dimensions: '50 × 60 cm', year: 2026, month: 6, location: 'Lisbon', collection: 'Available' },
      { title: 'Glasshouse', category: 'Series', kind: 'Artwork', medium: 'Archival pigment print, edition of 5', dimensions: '120 × 150 cm', year: 2026, month: 9, location: 'Berlin', collection: 'Available' },
    ],
    projects: [
      P('Solo show: Glasshouse', 'Exhibition', { location: 'Berlin', institution: 'Galerie Kontakt', dateStart: inDays(38), dateEnd: inDays(75) },
        [['Final print proofs', 2], ['Order frames and mounts', 6], ['Write the wall text', 12], ['Choose the twelve images', null, true]]),
      P('Second photobook', 'Publications', { publisher: 'Harbour Editions' },
        [['Sequence the dummy', 5], ['Ask for paper samples', 9], ['Send the dummy to the publisher', 30]]),
      P('Editorial commission: coastal towns', 'Commission', { client: 'Weekend Magazine' },
        [['Shot list to the photo editor', 1], ['Book the car', 4], ['Invoice the first story', null, true]]),
      P('Portfolio review', 'Other', {},
        [['Print 20 work prints', 10], ['Book reviewer slots', 14]]),
      P('Residency: Reykjavík', 'Residency', { location: 'Reykjavík', institution: 'North Light Residency', dateStart: inDays(140), dateEnd: inDays(200) },
        [['Visa and insurance', 30], ['Plan the film stock', 60]]),
      P('Archive and editions', 'Other', {},
        [['Scan the 2022 negatives', 7], ['Update the edition register', 18], ['Back up the archive', null, true]]),
    ],
    events: [
      ev('Harbour Workers, group show', 'Exhibition', 'Hamburg', '2022-11-04', { endDate: '2023-01-15', workIds: [4] }),
      ev('Saltpans, solo show', 'Exhibition', 'Lisbon', '2023-09-08', { endDate: '2023-10-28', workIds: [1] }),
      ev('Low Water at the Photo Museum', 'Exhibition', 'Rotterdam', '2024-03-15', { endDate: '2024-06-09', workIds: [0] }),
      ev('Summer photo festival', 'Festival', 'Arles', '2024-07-01', { endDate: '2024-07-07', workIds: [0] }),
      ev('Night Ferries', 'Exhibition', 'Copenhagen', '2025-02-07', { endDate: '2025-03-30', workIds: [2] }),
      ev('Borrowed Light launch', 'Other', 'Copenhagen', '2025-05-16', { workIds: [3] }),
      ev('Photobook fair', 'Book Fair', 'Paris', '2025-11-13', { endDate: '2025-11-16', workIds: [3] }),
      ev('Artist talk', 'Talk', 'Vienna', '2026-03-19'),
      ev('Tidal Studies, group show', 'Exhibition', 'Lisbon', '2026-06-12', { endDate: '2026-08-02', workIds: [5] }),
      ev('Portfolio review', 'Festival', 'Amsterdam', inDays(22)),
      ev('Glasshouse opening', 'Exhibition', 'Berlin', inDays(38), { endDate: inDays(75), workIds: [6], goals: 'Sell three editions\nMeet two museum curators' }),
      ev('Print sale', 'Market', 'Berlin', inDays(52)),
      ev('Photobook fair', 'Book Fair', 'London', inDays(110), { endDate: inDays(112), workIds: [3] }),
    ],
    opportunities: [
      op('Photography prize 2027', 'Open call', 'European Photo Foundation', 14, 'Active'),
      op('Photobook dummy award', 'Open call', 'Photobook Days', 27, 'Active'),
      op('Production grant', 'Grant', 'Arts Council Fund', 36, 'Draft'),
      op('Museum acquisitions', 'Open call', 'Harbour Photo Museum', 8, 'Draft'),
      op('Travel grant', 'Grant', 'Culture Exchange Fund', -10, 'Applied'),
      op('New talent award', 'Open call', 'Summer Photo Festival', -15, 'Shortlisted'),
      op('Editorial commission', 'Commission', 'Weekend Magazine', -25, 'Won'),
      op('Residency in Reykjavík', 'Residency', 'North Light Residency', -50, 'Won'),
      op('Group show: Water', 'Open call', 'Kunstraum Hafen', -130, 'Closed'),
    ],
    press: [
      pr('Saltpans, a portfolio', 'Feature', 'Image Quarterly', '2023-10', 1),
      pr('Low Water reviewed', 'Review', 'Photo Monthly', '2024-04', 0),
      pr('Night Ferries review', 'Review', 'Nordic Art Letter', '2025-02', 2),
      pr('Interview: waiting for the tide', 'Interview', 'Lens Radio', '2025-06', 3),
      pr('Photobooks of the year', 'Selection', 'The Photobook Review', '2025-12', 3),
      pr('Ten photographers to watch', 'Selection', 'City Magazine', '2026-01'),
      pr('New Talent Award, winner', undefined, 'European Photo Foundation', '2024-09', 0, 'award'),
      pr('Photobook Award, shortlist', undefined, 'Photobook Days', '2025-11', 3, 'award'),
    ],
    desk: {
      list: { title: 'Shoot kit', items: [['Film, 20 rolls'], ['Tripod plate'], ['Light meter batteries'], ['Lens cloth', true]] },
      quote: 'Wait for the light, then wait a little longer.',
      note: 'Printer call Tuesday, 9 am',
      submission: 0,
    },
    board: { name: 'Next five years',
      quotes: ['Wait for the light, then wait a little longer.', 'Fewer pictures, better sequenced.'],
      goals: ['A museum solo show', 'Second photobook', 'Shoot on large format'],
      refs: ['Rinko Kawauchi, everyday light', 'Saul Leiter, colour in the street', 'Joel Sternfeld, the long view'],
      tags: ['water', 'light', 'waiting'] },
  }),

  'illustrator-painter': () => combine('together', [['picture_book', SEEDS.illustrator()], ['visual_artist', SEEDS.painter()]], {
    name: 'Next five years',
    quotes: ['Leave room for the reader.', 'Paint what the light does, not what the thing is.'],
    goals: ['Finish Snow Days', 'Larger canvases', 'Show the originals in Paris'],
    refs: ['Tove Jansson, Moomin winters', 'Pierre Bonnard, interiors', 'Etel Adnan, small mountains'],
    tags: ['quiet', 'light', 'play'],
  }),

  'photographer-musician': () => combine('separate', [['photographer', SEEDS.photographer()], ['musician', SEEDS.musician()]], {
    name: 'Next five years',
    quotes: ['Wait for the light, then wait a little longer.', 'Play the room you are in.'],
    goals: ['A museum solo show', 'Finish album two', 'Photograph the tour'],
    refs: ['Rinko Kawauchi, everyday light', 'Nils Frahm, the room as instrument', 'Saul Leiter, colour in the street'],
    tags: ['water', 'live', 'light'],
  }),
}

// Replaces whatever is in the demo database with the sample studio for this field.
export async function seedDemo(field: DemoField) {
  const s = SEEDS[field]()
  const now = Date.now()
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear()
    const departmentId = await db.departments.add({
      name: s.name, discipline: field === 'musician' ? 'music' : field === 'illustrator' ? 'picture_books' : 'painter',
      activities: s.activities, practiceMode: s.practiceMode, practiceNames: s.practiceNames, createdAt: now,
    }) as number

    const workIds: number[] = []
    for (const w of s.works) workIds.push(await db.works.add({ ...w, departmentId }) as number)

    const projectIds: number[] = []
    for (const { project, todos } of s.projects) {
      const projectId = await db.projects.add({ ...project, departmentId }) as number
      projectIds.push(projectId)
      for (const [title, due, done] of todos) {
        await db.todos.add({ departmentId, projectId, title, done: !!done, kanbanStatus: done ? 'done' : 'todo', dueDate: due == null ? undefined : inDays(due) })
      }
    }

    const eventIds: number[] = []
    for (const e of s.events) eventIds.push(await db.eventEntries.add({ ...e, departmentId, workIds: e.workIds?.map(i => workIds[i]) }) as number)
    const oppIds: number[] = []
    for (const o of s.opportunities) oppIds.push(await db.opportunities.add({ ...o, departmentId }) as number)
    for (const p of s.press) await db.pressEntries.add({ ...p, departmentId, workId: p.workId == null ? undefined : workIds[p.workId] })

    // Contacts, linked by title to the works, events and projects above, and their lists.
    const { contacts, lists } = DEMO_CONTACTS[field]
    const idOf = (titles: string[] | undefined, all: Array<{ title: string }>, ids: number[]) => {
      const found = (titles ?? []).map(t => ids[all.findIndex(x => x.title === t)]).filter((id): id is number => id != null)
      return found.length ? found : undefined
    }
    const contactIds: Record<string, number> = {}
    for (const { works, events, projects, ...c } of contacts) {
      contactIds[c.name] = await db.contacts.add({
        ...c, departmentId, createdAt: now,
        workIds: idOf(works, s.works, workIds), eventIds: idOf(events, s.events, eventIds), projectIds: idOf(projects, s.projects.map(p => p.project), projectIds),
      }) as number
    }
    for (const [i, l] of lists.entries()) {
      const projectId = l.project ? projectIds[s.projects.findIndex(p => p.project.title === l.project)] : undefined
      await db.contactLists.add({
        departmentId, name: l.name, projectId, createdAt: now - i,
        members: l.members.map(([name, done]) => ({ contactId: contactIds[name], done: done || undefined })).filter(m => m.contactId != null),
      })
    }

    // The desk, laid out in its four columns: projects on the left, tasks and a list beside them,
    // coming up, a quote, a submission and a note on the right. Each practice has its own list, quote,
    // submission and note in the same places; the desk only shows the practice in view.
    const deskId = await db.boards.add({ departmentId, name: 'Desk', boardType: 'desk', createdAt: now }) as number
    const desk: Array<Omit<BoardItem, 'boardId' | 'createdAt'>> = [
      { itemType: 'comingup', content: '', x: 3, y: 24, w: 1, h: 300 },
      ...projectIds.map((id, i) => ({ itemType: 'project' as const, content: String(id), x: i % 2, y: 24 + Math.floor(i / 2) * 216, w: 1, h: 176 })),
      { itemType: 'tasks', content: 'week', x: 2, y: 24, w: 1, h: 320 },
      ...[s.desk].flat().flatMap(({ practice, ...d }) => [
        { itemType: 'list' as const, content: JSON.stringify({ title: d.list.title, items: d.list.items.map(([text, isDone], i) => ({ id: `l${i}`, text, done: !!isDone })) }), x: 2, y: 456, w: 1, h: 200, practice },
        { itemType: 'quote' as const, content: d.quote, x: 3, y: 408, w: 1, h: 112, practice },
        { itemType: 'submission' as const, content: String(oppIds[d.submission]), x: 3, y: 576, w: 1, h: 112 },
        { itemType: 'note' as const, content: d.note, x: 3, y: 744, w: 1, h: 96, practice },
      ]),
    ]
    for (const item of desk) await db.boardItems.add({ ...item, boardId: deskId, createdAt: now })

    const boardId = await db.boards.add({ departmentId, name: s.board.name, boardType: 'Board', createdAt: now }) as number
    const { items, arrows } = visionLayout(s.board)
    const ids: Record<string, number> = {}
    for (const { key, ...item } of items) ids[key] = await db.boardItems.add({ ...item, boardId, createdAt: now }) as number
    for (const [from, to] of arrows) {
      await db.boardItems.add({ boardId, itemType: 'arrow', content: JSON.stringify({ fromId: ids[from], toId: ids[to] }), x: 0, y: 0, w: 0, h: 0, createdAt: now })
    }
  })
  try { localStorage.setItem(`wa-demo-version-${field}`, DEMO_VERSION) } catch { /* private mode */ }
}

// True when this browser's copy of the demo predates the current sample content.
export function demoOutdated(field: DemoField) {
  try { return localStorage.getItem(`wa-demo-version-${field}`) !== DEMO_VERSION } catch { return false }
}
