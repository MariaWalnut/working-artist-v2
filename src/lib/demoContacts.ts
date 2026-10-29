import type { Contact } from '../db/db'
import type { DemoField } from './mode'

// Sample contacts for the open demos. Everyone here is invented; web and email addresses use
// the reserved .example domain so none of them reach a real person.
// Works, events and projects are named by title and linked when the demo is set up.

export type DemoContact = Omit<Contact, 'id' | 'departmentId' | 'createdAt' | 'workIds' | 'eventIds' | 'projectIds'> & {
  works?: string[]; events?: string[]; projects?: string[]
}
export interface DemoList { name: string; project?: string; members: Array<[name: string, done?: boolean]> }

const C = (name: string, category: string, organisation: string, role: string, extra: Partial<DemoContact> = {}): DemoContact => {
  const handle = name.split(' ')[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const domain = organisation.toLowerCase().replace(/[^a-z]+/g, '') || 'studio'
  return { name, category, organisation: organisation || undefined, role: role || undefined, email: `${handle}@${domain}.example`, ...extra }
}

export const DEMO_CONTACTS: Record<DemoField, { contacts: DemoContact[]; lists: DemoList[] }> = {
  musician: {
    contacts: [
      C('Jonas Weber', 'Client', 'Northbound Records', 'Label manager', { phone: '+49 30 5550 1820', website: 'northboundrecords.example', address: 'Northbound Records\nLinienstraße 41\n10119 Berlin\nGermany', tags: ['label'], note: 'Prefers calls before noon.', works: ['Low Tide', 'Glass Hour'], projects: ['Second album'] }),
      C('Mira Lund', 'Press', 'Nordic Sound Magazine', 'Music editor', { address: 'Vesterbrogade 12\n1620 Copenhagen\nDenmark', tags: ['press', 'Copenhagen'], works: ['Northern Lights (Live)'] }),
      C('Pedro Alves', 'Institution', 'Lisbon Music Hall', 'Booker', { phone: '+351 21 555 0144', address: 'Rua das Flores 88\n1200-195 Lisbon\nPortugal', tags: ['venue'], events: ['Paper Lanterns tour'], projects: ['Spring tour 2027'] }),
      C('Hanna Gruber', 'Client', 'Kleines Haus Ensemble', 'Artistic director', { address: 'Kleines Haus\nGumpendorfer Straße 9\n1060 Vienna\nAustria', note: 'Met at the Small Hours show.', projects: ['Theatre score: The Orchard'], events: ['Small Hours release show'] }),
      C('Sam Okafor', 'Artist', 'Studio Okafor', 'Mixing engineer', { phone: '+44 20 5550 3391', website: 'okafor.example', address: '14 Lark Lane\nLondon E8 3QS\nUnited Kingdom', tags: ['studio'], projects: ['Second album'] }),
      C('Yuki Mori', 'Institution', 'Tokyo Live Tours', 'Promoter', { address: '2-4-1 Shibuya\nTokyo 150-0002\nJapan', tags: ['touring'], events: ['Japan tour'] }),
      C('Clara Visser', 'Curator', 'Amsterdam Song Festival', 'Programmer', { address: 'Prinsengracht 300\n1016 HX Amsterdam\nNetherlands', events: ['Spring tour: Amsterdam'] }),
    ],
    lists: [
      { name: 'Christmas Card 2026', members: [['Jonas Weber', true], ['Mira Lund', true], ['Pedro Alves'], ['Hanna Gruber'], ['Sam Okafor'], ['Clara Visser']] },
      { name: 'Album launch guests', project: 'Second album', members: [['Jonas Weber'], ['Mira Lund'], ['Sam Okafor']] },
    ],
  },
  painter: {
    contacts: [
      C('Lena Hoffmann', 'Gallery', 'Galerie Nordlicht', 'Director', { phone: '+49 30 5550 7714', website: 'galerienordlicht.example', address: 'Galerie Nordlicht\nAuguststraße 22\n10117 Berlin\nGermany', tags: ['Berlin'], note: 'Likes the small panels best.', projects: ['Solo show: Quiet Rooms'], events: ['Quiet Rooms opening'], works: ['Green Hour'] }),
      C('Tomás Reis', 'Institution', 'Atlantic Studios', 'Residency coordinator', { address: 'Atlantic Studios\nRua do Alecrim 5\n1200-014 Lisbon\nPortugal', tags: ['residency'], projects: ['Residency: Lisbon'] }),
      C('Anna Berger', 'Collector', '', '', { email: 'anna.berger@mail.example', address: 'Schönbrunner Straße 7\n1050 Vienna\nAustria', tags: ['collector', 'Vienna'], note: 'Bought Red Room. Send a card every year.', works: ['Red Room'], events: ['Red Room, solo show'] }),
      C('Felix Brandt', 'Client', 'Hotel Linde', 'Owner', { phone: '+49 89 5550 2208', address: 'Hotel Linde\nLindenallee 3\n80333 Munich\nGermany', projects: ['Lobby commission'] }),
      C('Sofia Marín', 'Curator', 'Madrid Art Fair', 'Section curator', { address: 'Paseo del Prado 30\n28014 Madrid\nSpain', projects: ['Art fair: Madrid'], events: ['Art fair booth'] }),
      C('Ruth Klein', 'Press', 'Art Weekly', 'Writer', { address: 'Kantstraße 61\n10627 Berlin\nGermany', tags: ['press'], note: 'Wrote the studio visit piece.', projects: ['Catalogue'] }),
      C('Ines Duarte', 'Collector', '', '', { email: 'ines.duarte@mail.example', address: 'Rua da Prata 120\n1100-417 Lisbon\nPortugal', tags: ['collector', 'Lisbon'], works: ['Salt Flats I'] }),
    ],
    lists: [
      { name: 'Christmas Card 2026', members: [['Lena Hoffmann', true], ['Anna Berger', true], ['Ines Duarte'], ['Tomás Reis'], ['Felix Brandt'], ['Ruth Klein']] },
      { name: 'Quiet Rooms opening guests', project: 'Solo show: Quiet Rooms', members: [['Anna Berger'], ['Ines Duarte'], ['Ruth Klein'], ['Sofia Marín']] },
    ],
  },
  illustrator: {
    contacts: [
      C('Mara Holt', 'Publisher', 'Little Lantern Books', 'Editor', { phone: '+44 20 5550 6620', website: 'littlelantern.example', address: 'Little Lantern Books\n9 Cloth Fair\nLondon EC1A 7JQ\nUnited Kingdom', tags: ['editor'], note: 'Wrote The Fox Who Kept the Moon.', works: ['The Fox Who Kept the Moon'], projects: ['Picture book three: Snow Days'] }),
      C('Ines Okafor', 'Publisher', 'Little Lantern Books', 'Art director', { address: 'Little Lantern Books\n9 Cloth Fair\nLondon EC1A 7JQ\nUnited Kingdom', works: ['Hush, Little Harbour'] }),
      C('Katrin Vogel', 'Publisher', 'Mondschein Verlag', 'Rights manager', { address: 'Mondschein Verlag\nTorstraße 140\n10119 Berlin\nGermany', tags: ['rights', 'German'], projects: ['German edition'] }),
      C('Giulia Conti', 'Curator', 'Bologna Book Fair', 'Exhibition curator', { address: 'Piazza Costituzione 6\n40128 Bologna\nItaly', events: ['Book fair talk'], projects: ['Book fair portfolio'] }),
      C('Paul Martin', 'Institution', 'Paris Library Network', 'Children’s librarian', { address: '12 Rue de Rivoli\n75004 Paris\nFrance', tags: ['schools'], events: ['Library tour'], projects: ['School visits'] }),
      C('Nora Fitz', 'Press', 'Picture Book Podcast', 'Host', { address: '22 Church Road\nDublin D06 X2K8\nIreland', tags: ['press'] }),
      C('Eva Lind', 'Gallery', 'Gallery of Small Things', 'Owner', { address: 'Linnégatan 18\n114 47 Stockholm\nSweden', projects: ['Original art show'], events: ['Original art show'] }),
    ],
    lists: [
      { name: 'Christmas Card 2026', members: [['Mara Holt', true], ['Ines Okafor'], ['Katrin Vogel'], ['Giulia Conti'], ['Paul Martin'], ['Eva Lind']] },
      { name: 'Snow Days launch', project: 'Picture book three: Snow Days', members: [['Mara Holt'], ['Ines Okafor'], ['Nora Fitz']] },
    ],
  },
  writer: {
    contacts: [
      C('Helen Marsh', 'Publisher', 'Harbour Press', 'Editor', { phone: '+44 131 555 0192', website: 'harbourpress.example', address: 'Harbour Press\n4 Leith Walk\nEdinburgh EH6 8RQ\nUnited Kingdom', tags: ['editor'], works: ['The Summer House', 'Small Weather'], projects: ['Novel two: The Lighthouse Keepers'] }),
      C('Jakob Stein', 'Publisher', 'Verlag am See', 'Translator', { address: 'Seestraße 5\n8002 Zurich\nSwitzerland', tags: ['translation', 'German'], works: ['Das Sommerhaus'], projects: ['German edition edits'] }),
      C('Rachel Adler', 'Client', 'Adler Literary', 'Agent', { phone: '+44 20 5550 4471', address: 'Adler Literary\n31 Bedford Square\nLondon WC1B 3EG\nUnited Kingdom', note: 'Call before any contract.', projects: ['Novel two: The Lighthouse Keepers'] }),
      C('Marta Silva', 'Curator', 'Lisbon Literature Festival', 'Programmer', { address: 'Largo do Carmo 2\n1200-092 Lisbon\nPortugal', events: ['Literature festival reading'], projects: ['Festival season'] }),
      C('Owen Price', 'Press', 'The Weekend Review', 'Books editor', { address: '8 Fleet Street\nLondon EC4Y 1AA\nUnited Kingdom', tags: ['press'], works: ['Letters from Lisbon'] }),
      C('Ana Ruiz', 'Institution', 'City Library Dublin', 'Events', { address: '138 Pearse Street\nDublin D02 HE37\nIreland', events: ['Library talk'] }),
      C('Lukas Brenner', 'Client', 'Kulturmagazin', 'Commissioning editor', { address: 'Neubaugasse 14\n1070 Vienna\nAustria', projects: ['Essay commission'] }),
    ],
    lists: [
      { name: 'Christmas Card 2026', members: [['Helen Marsh', true], ['Rachel Adler', true], ['Jakob Stein'], ['Marta Silva'], ['Ana Ruiz'], ['Lukas Brenner']] },
      { name: 'Festival season contacts', project: 'Festival season', members: [['Marta Silva'], ['Ana Ruiz'], ['Owen Price']] },
    ],
  },
  fineart: {
    contacts: [
      C('Ingrid Solberg', 'Curator', 'Nordic Pavilion', 'Curator', { phone: '+47 22 55 50 18', website: 'nordicpavilion.example', address: 'Nordic Pavilion\nGiardini della Biennale\n30122 Venice\nItaly', tags: ['Biennale'], note: 'Site visits on Tuesdays only.', projects: ['Biennale installation'], events: ['Biennale opening'], works: ['Breathing Wall'] }),
      C('Martin Keller', 'Client', 'City of Zurich', 'Public art officer', { phone: '+41 44 555 03 77', address: 'Stadt Zürich, Kunst im öffentlichen Raum\nStadthausquai 17\n8001 Zurich\nSwitzerland', projects: ['Public sculpture: Common Ground'], works: ['Common Ground'] }),
      C('Femke de Vries', 'Institution', 'Kunsthal Rotterdam', 'Head of exhibitions', { address: 'Westzeedijk 341\n3015 AA Rotterdam\nNetherlands', events: ['Tidal Archive premiere'], works: ['Tidal Archive'] }),
      C('Aiko Tanaka', 'Institution', 'Villa Kamogawa', 'Residency director', { address: '17 Yoshida-honmachi\nKyoto 606-8501\nJapan', tags: ['residency'], projects: ['Residency: Kyoto'] }),
      C('Daniel Roth', 'Gallery', 'Galerie Roth', 'Gallerist', { phone: '+49 30 5550 9120', address: 'Galerie Roth\nPotsdamer Straße 81\n10785 Berlin\nGermany', tags: ['Berlin'], events: ['Small Monuments', 'Art fair booth'], works: ['Small Monuments'], projects: ['Gallery dinner'] }),
      C('Selma Haug', 'Press', 'Sculpture Today', 'Critic', { address: 'Grünerløkka 4\n0552 Oslo\nNorway', tags: ['press'], works: ['Tidal Archive'] }),
      C('Victor Lenz', 'Collector', '', '', { email: 'victor.lenz@mail.example', address: 'Mariahilfer Straße 40\n1070 Vienna\nAustria', tags: ['collector'], works: ['Weight of Water'], events: ['Weight of Water, solo show'] }),
    ],
    lists: [
      { name: 'Christmas Card 2026', members: [['Ingrid Solberg', true], ['Daniel Roth', true], ['Victor Lenz'], ['Femke de Vries'], ['Martin Keller'], ['Aiko Tanaka']] },
      { name: 'Gallery dinner guests', project: 'Gallery dinner', members: [['Daniel Roth'], ['Victor Lenz'], ['Selma Haug'], ['Ingrid Solberg']] },
    ],
  },
}
