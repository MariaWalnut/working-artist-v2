// Finding places on the career map. The city list ships with the app, so nothing is looked up online.
// City data: GeoNames (geonames.org), CC BY 4.0.

export type City = [name: string, country: string, lon: number, lat: number]
export interface Place { name: string; coords: [number, number] }

// Other spellings of a city, pointing at the name the list uses, which is sometimes the local one.
const ALIASES: Record<string, string> = {
  lisboa: 'Lisbon', porto: 'Porto', oporto: 'Porto', seville: 'Sevilla', saragossa: 'Zaragoza', 'a coruna': 'A Coruña',
  roma: 'Rome', milano: 'Milan', firenze: 'Florence', venezia: 'Venice', napoli: 'Naples', torino: 'Turin', genova: 'Genoa', padua: 'Padova',
  wien: 'Vienna', munchen: 'Munich', cologne: 'Köln', nuremberg: 'Nürnberg', hanover: 'Hannover', brunswick: 'Braunschweig',
  zurich: 'Zürich', geneve: 'Geneva', genf: 'Geneva', basle: 'Basel', lucerne: 'Luzern',
  bruxelles: 'Brussels', brussel: 'Brussels', antwerp: 'Antwerpen', ghent: 'Gent', bruges: 'Brugge', 'den haag': 'The Hague', "'s-gravenhage": 'The Hague',
  praha: 'Prague', warszawa: 'Warsaw', krakow: 'Kraków', cracow: 'Kraków', wroclaw: 'Wrocław', gdansk: 'Gdańsk',
  kobenhavn: 'Copenhagen', gothenburg: 'Göteborg', reykjavik: 'Reykjavík',
  moskva: 'Moscow', sankt: 'Saint Petersburg', 'st petersburg': 'Saint Petersburg', 'st. petersburg': 'Saint Petersburg', kiev: 'Kyiv',
  athina: 'Athens', athen: 'Athens', thessaloniki: 'Thessaloníki', bucuresti: 'Bucharest', beograd: 'Belgrade', sofiya: 'Sofia',
  peking: 'Beijing', bombay: 'Mumbai', calcutta: 'Kolkata', saigon: 'Ho Chi Minh City', 'nyc': 'New York City', 'new york': 'New York City', 'la': 'Los Angeles',
  'mexico': 'Mexico City', 'ciudad de mexico': 'Mexico City', cdmx: 'Mexico City', 'sao paulo': 'São Paulo', 'rio': 'Rio de Janeiro', 'bogota': 'Bogotá',
  'washington dc': 'Washington, D.C.', 'washington': 'Washington, D.C.', washingtondc: 'Washington, D.C.', montreal: 'Montréal', quebec: 'Québec',
}

export const placeKey = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

let loading: Promise<City[]> | null = null
export function loadCities(): Promise<City[]> {
  loading ??= import('../data/cities.json').then(m => m.default as unknown as City[])
  return loading
}

// Biggest city wins a shared name: the list is sorted by population.
export function indexCities(cities: City[]) {
  const index = new Map<string, City>()
  for (const c of cities) { const k = placeKey(c[0]); if (!index.has(k)) index.set(k, c) }
  return index
}

// A location can be "Berlin", "Lisboa", "Galerie Nordlicht, Berlin" or "Portugal / Berlin".
export function findPlace(text: string, index: Map<string, City>): Place | null {
  const parts = [text, ...text.split(/[,/·|;()]| - | – /)].map(placeKey).filter(Boolean)
  for (const part of parts) {
    const alias = ALIASES[part]
    const city = (alias && index.get(placeKey(alias))) || index.get(part)
    if (city) return { name: city[0], coords: [city[2], city[3]] }
  }
  return null
}
