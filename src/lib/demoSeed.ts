import { db, type Activity, type BoardItem, type EventEntry, type Opportunity, type PressEntry, type Project, type Work } from '../db/db'
import type { DemoField } from './mode'
import { DEMO_CONTACTS } from './demoContacts'

// Sample studios for the open demos. Everyone and everything here is invented.
// Upcoming dates are relative to today, so a demo never looks stale.

// Bump when the sample content changes: every visitor's demo is set up again once.
export const DEMO_VERSION = '2026-10-29b'

const DAY = 864e5
const inDays = (n: number) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10)

type Todo = [title: string, dueInDays: number | null, done?: boolean]
type Item = Pick<BoardItem, 'itemType' | 'content' | 'x' | 'y' | 'w' | 'h' | 'color'>

interface Seed {
  name: string
  activities: Activity[]
  works: Array<Omit<Work, 'departmentId'>>
  projects: Array<{ project: Omit<Project, 'departmentId'>; todos: Todo[] }>
  // workIds here are indexes into `works`
  events: Array<Omit<EventEntry, 'departmentId'>>
  opportunities: Array<Omit<Opportunity, 'departmentId'>>
  // workId here is an index into `works`
  press: Array<Omit<PressEntry, 'departmentId'>>
  desk: { list: { title: string; items: Array<[string, boolean?]> }; quote: string; note: string; submission: number }
  board: Vision
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
      { title: 'Low Tide', kind: 'Release', format: 'Album', label: 'Northbound Records', year: 2025, month: 3, location: 'Berlin' },
      { title: 'Paper Lanterns', kind: 'Release', format: 'EP', label: 'Self-released', year: 2023, month: 9, location: 'Lisbon' },
      { title: 'Glass Hour', kind: 'Release', format: 'Single', label: 'Northbound Records', year: 2026, month: 6, location: 'Berlin' },
      { title: 'Northern Lights (Live)', kind: 'Release', format: 'Live album', label: 'Northbound Records', year: 2024, month: 2, location: 'Copenhagen' },
      { title: 'Field Recordings, Vol. 1', kind: 'Release', format: 'Cassette', label: 'Self-released', year: 2022, month: 11, location: 'London' },
      { title: 'Small Hours', kind: 'Release', format: 'EP', label: 'Self-released', year: 2021, month: 5, location: 'Vienna' },
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
    works: [
      { title: 'Salt Flats I', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 5, location: 'Lisbon', collection: 'Private collection' },
      { title: 'Salt Flats II', kind: 'Artwork', medium: 'Oil on linen', dimensions: '120 × 90 cm', year: 2024, month: 7, location: 'Lisbon' },
      { title: 'Interior with Blue Chair', kind: 'Artwork', medium: 'Oil on canvas', dimensions: '80 × 60 cm', year: 2025, month: 2, location: 'Berlin', collection: 'Available' },
      { title: 'Night Garden', kind: 'Artwork', medium: 'Acrylic and pastel on paper', dimensions: '50 × 70 cm', year: 2025, month: 10, location: 'Berlin' },
      { title: 'Study for a Window', kind: 'Artwork', medium: 'Oil on panel', dimensions: '30 × 24 cm', year: 2026, month: 4, location: 'Berlin' },
      { title: 'Red Room', kind: 'Artwork', medium: 'Oil on canvas', dimensions: '150 × 120 cm', year: 2023, month: 11, location: 'Vienna', collection: 'City Museum' },
      { title: 'Orchard, Morning', kind: 'Artwork', medium: 'Gouache on paper', dimensions: '40 × 30 cm', year: 2026, month: 6, location: 'Lisbon' },
      { title: 'Green Hour', kind: 'Artwork', medium: 'Oil on linen', dimensions: '100 × 80 cm', year: 2026, month: 8, location: 'Berlin', collection: 'Available' },
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
      { title: 'The Fox Who Kept the Moon', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2024-09', year: 2024, month: 9, language: 'English',
        credits: 'Text by Mara Holt, illustrated by Ines Okafor', pages: 32, dimensions: '24 × 30 cm', technique: 'Gouache, pencil', location: 'London',
        contract: { currency: '€', price: 16, binding: 'Hardcover', printRun: 4000, advance: 4000, advancePaid: 'full', royaltyRate: 5, royaltyBase: 'retail', territory: 'World, English language', signed: '2023-02' },
        rights: [
          { id: 'r1', language: 'German', publisher: 'Blauer Verlag', year: 2025, status: 'sold', advance: 2000, royaltyRate: 6, printRun: 3000 },
          { id: 'r2', language: 'French', publisher: 'Éditions Lune', year: 2025, status: 'live', advance: 1800 },
          { id: 'r3', language: 'Korean', status: 'pending' },
        ] },
      { title: 'Hush, Little Harbour', kind: 'Book', publisher: 'Little Lantern Books', publishedDate: '2026-05', year: 2026, month: 5, language: 'English',
        credits: 'Written and illustrated by Ines Okafor', pages: 40, dimensions: '25 × 25 cm', technique: 'Gouache, coloured pencil', location: 'London',
        contract: { currency: '€', price: 17, binding: 'Hardcover', printRun: 5000, advance: 6000, advancePaid: 'part', royaltyRate: 7, royaltyBase: 'retail', territory: 'World, all languages', signed: '2024-06' },
        rights: [{ id: 'r1', language: 'Dutch', publisher: 'Uitgeverij Zee', year: 2026, status: 'sold', advance: 1500 }] },
      { title: "Grandma's Garden", kind: 'Book', publisher: 'Small Steps Press', publishedDate: '2022-04', year: 2022, month: 4, language: 'German',
        credits: 'Text by Ana Weiss, illustrated by Ines Okafor', pages: 28, dimensions: '22 × 28 cm', technique: 'Watercolour', location: 'Berlin' },
      { title: 'Autumn cover', kind: 'Illustration', publisher: 'City Magazine', publishedDate: '2025-10', year: 2025, month: 10, medium: 'Gouache, digital' },
      { title: 'Book festival poster', kind: 'Illustration', publisher: "Children's Book Festival", publishedDate: '2026-02', year: 2026, month: 2, medium: 'Gouache', location: 'Paris' },
      { title: 'Reading in bed', kind: 'Illustration', publisher: 'Weekend Books', publishedDate: '2025-03', year: 2025, month: 3, medium: 'Pencil, digital' },
      { title: 'Snow Days, character sheet', kind: 'Illustration', publisher: 'Little Lantern Books', publishedDate: '2026-08', year: 2026, month: 8, medium: 'Gouache' },
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
      { title: 'The Summer House', kind: 'Book', subtitle: 'A novel', publisher: 'Harbour Press', publishedDate: '2023-04', year: 2023, month: 4, language: 'English', pages: 280, location: 'London',
        contract: { currency: '€', price: 20, binding: 'Hardcover', printRun: 5000, advance: 8000, advancePaid: 'full', royaltyRate: 10, royaltyBase: 'retail', royaltySteps: '12.5% from 10,000 copies', territory: 'World, English language', signed: '2021-11', agent: 'Ruth Adler', agentCommission: 15 },
        rights: [
          { id: 'r1', language: 'German', publisher: 'Nordwind Verlag', year: 2024, status: 'sold', advance: 3500 },
          { id: 'r2', language: 'Portuguese', publisher: 'Edições Mar', year: 2025, status: 'live' },
          { id: 'r3', language: 'Danish', status: 'pending' },
        ] },
      { title: 'Small Weather', kind: 'Book', subtitle: 'Stories', publisher: 'Harbour Press', publishedDate: '2025-09', year: 2025, month: 9, language: 'English', pages: 190, location: 'Dublin',
        contract: { currency: '€', price: 18, binding: 'Paperback', printRun: 3000, advance: 5000, advancePaid: 'part', royaltyRate: 7.5, royaltyBase: 'retail', signed: '2024-03', agent: 'Ruth Adler', agentCommission: 15 } },
      { title: 'Das Sommerhaus', kind: 'Book', subtitle: 'Roman', publisher: 'Nordwind Verlag', publishedDate: '2024-09', year: 2024, month: 9, language: 'German', credits: 'Translated by Jonas Berg', pages: 296, location: 'Berlin' },
      { title: 'On Walking', kind: 'Other', medium: 'Essay, City Review', year: 2024, month: 3 },
      { title: 'Salt', kind: 'Other', medium: 'Short story, Coastal Review', year: 2022, month: 6 },
      { title: 'Letters from Lisbon', kind: 'Other', medium: 'Essay, Weekend Magazine', year: 2025, month: 12 },
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
    works: [
      { title: 'Tidal Archive', kind: 'Artwork', medium: 'Installation: salt, glass and sound', dimensions: 'Room, 6 × 9 m', year: 2024, month: 4, location: 'Rotterdam' },
      { title: 'Weight of Water', kind: 'Artwork', medium: 'Cast bronze', dimensions: '42 × 30 × 28 cm', year: 2023, month: 9, location: 'Vienna', collection: 'Private collection' },
      { title: 'Small Monuments', kind: 'Artwork', medium: 'Glazed ceramic, 12 parts', dimensions: 'Variable', year: 2025, month: 3, location: 'Berlin', collection: 'Available' },
      { title: 'Field Notes', kind: 'Artwork', medium: 'Single-channel video, 14 min', year: 2025, month: 8, location: 'Lisbon' },
      { title: 'Cloud Index', kind: 'Artwork', medium: 'Graphite and ink on paper', dimensions: '70 × 100 cm', year: 2022, month: 6, location: 'Copenhagen', collection: 'Kunsthalle collection' },
      { title: 'Breathing Wall', kind: 'Artwork', medium: 'Installation: textile and motors', dimensions: '4 × 12 m', year: 2026, month: 5, location: 'Venice' },
      { title: 'Common Ground', kind: 'Artwork', medium: 'Public sculpture: concrete and moss', dimensions: '3 × 8 m', year: 2026, month: 9, location: 'Zurich' },
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
    // coming up, a quote, a submission and a note on the right.
    const deskId = await db.boards.add({ departmentId, name: 'Desk', boardType: 'desk', createdAt: now }) as number
    const desk: Array<Omit<BoardItem, 'boardId' | 'createdAt'>> = [
      { itemType: 'comingup', content: '', x: 3, y: 24, w: 1, h: 300 },
      ...projectIds.map((id, i) => ({ itemType: 'project' as const, content: String(id), x: i % 2, y: 24 + Math.floor(i / 2) * 216, w: 1, h: 176 })),
      { itemType: 'tasks', content: 'week', x: 2, y: 24, w: 1, h: 320 },
      { itemType: 'list', content: JSON.stringify({ title: s.desk.list.title, items: s.desk.list.items.map(([text, isDone], i) => ({ id: `l${i}`, text, done: !!isDone })) }), x: 2, y: 456, w: 1, h: 200 },
      { itemType: 'quote', content: s.desk.quote, x: 3, y: 408, w: 1, h: 112 },
      { itemType: 'submission', content: String(oppIds[s.desk.submission]), x: 3, y: 576, w: 1, h: 112 },
      { itemType: 'note', content: s.desk.note, x: 3, y: 744, w: 1, h: 96 },
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
