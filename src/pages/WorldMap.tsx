import { useLiveQuery } from 'dexie-react-hooks'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

// [longitude, latitude]
const CITY_COORDS: Record<string, [number, number]> = {
  'Berlin':      [13.4,   52.5],
  'Paris':       [2.3,    48.9],
  'London':      [-0.1,   51.5],
  'Vienna':      [16.4,   48.2],
  'Amsterdam':   [4.9,    52.4],
  'New York':    [-74.0,  40.7],
  'Los Angeles': [-118.2, 34.1],
  'Tokyo':       [139.7,  35.7],
  'Sydney':      [151.2, -33.9],
  'São Paulo':   [-46.6, -23.5],
  'Mexico City': [-99.1,  19.4],
  'Mumbai':      [72.9,   19.1],
  'Shanghai':    [121.5,  31.2],
  'Toronto':     [-79.4,  43.7],
  'Madrid':      [-3.7,   40.4],
  'Rome':        [12.5,   41.9],
  'Stockholm':   [18.1,   59.3],
  'Warsaw':      [21.0,   52.2],
  'Brussels':    [4.4,    50.8],
  'Zurich':      [8.5,    47.4],
  'Barcelona':   [2.2,    41.4],
  'Copenhagen':  [12.6,   55.7],
  'Prague':      [14.4,   50.1],
  'Budapest':    [19.0,   47.5],
  'Athens':      [23.7,   37.9],
  'Lisbon':      [-9.1,   38.7],
  'Oslo':        [10.7,   59.9],
  'Helsinki':    [24.9,   60.2],
  'Dublin':      [-6.3,   53.3],
  'Geneva':      [6.1,    46.2],
  'Milan':       [9.2,    45.5],
  'Naples':      [14.3,   40.8],
  'Seoul':       [126.9,  37.6],
  'Beijing':     [116.4,  39.9],
  'Hong Kong':   [114.2,  22.3],
  'Singapore':   [103.8,   1.4],
  'Dubai':       [55.3,   25.2],
  'Cairo':       [31.2,   30.1],
  'Cape Town':   [18.4,  -33.9],
  'Nairobi':     [36.8,   -1.3],
  'Buenos Aires':[-58.4, -34.6],
  'Rio de Janeiro':[-43.2,-22.9],
  'Santiago':    [-70.7, -33.5],
  'Bogotá':      [-74.1,   4.7],
  'Chicago':     [-87.6,  41.9],
  'San Francisco':[-122.4, 37.8],
  'Washington':  [-77.0,  38.9],
  'Boston':      [-71.1,  42.4],
  'Montreal':    [-73.6,  45.5],
  'Vancouver':   [-123.1, 49.3],
  'Melbourne':   [144.9, -37.8],
  'Auckland':    [174.8, -36.9],
}

function getCityCoords(city: string): [number, number] | null {
  const c = city.trim()
  for (const [known, coords] of Object.entries(CITY_COORDS)) {
    if (c.toLowerCase().includes(known.toLowerCase()) || known.toLowerCase().includes(c.toLowerCase())) {
      return coords
    }
  }
  return null
}

type CityItem = { title: string; kind: 'event' | 'work'; date?: string }

export function WorldMapPanel() {
  const dept = useActiveDept()
  const events = useLiveQuery(() => dept?.id == null ? [] : db.eventEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const works = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  // Group by city
  const byCity: Record<string, CityItem[]> = {}
  for (const e of events) {
    const city = e.location?.trim()
    if (!city) continue
    byCity[city] = [...(byCity[city] ?? []), { title: e.title, kind: 'event', date: e.date }]
  }
  for (const w of works) {
    const city = w.location?.trim()
    if (!city) continue
    byCity[city] = [...(byCity[city] ?? []), { title: w.title, kind: 'work' }]
  }

  const cities = Object.entries(byCity).sort((a, b) => b[1].length - a[1].length)
  const total = Object.values(byCity).flat().length

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 20, display: 'flex', overflow: 'hidden', minHeight: 380 }}>
      {/* Map */}
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <ComposableMap
          width={800}
          height={420}
          projectionConfig={{ scale: 140, center: [10, 10] }}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#EFEFEF"
                  stroke="#FAFAFA"
                  strokeWidth={0.5}
                  style={{ outline: 'none' }}
                />
              ))
            }
          </Geographies>

          {cities.map(([city, items]) => {
            const coords = getCityCoords(city)
            if (!coords) return null
            const total = items.length
            const isHub = total >= 3
            const hasWork = items.some(i => i.kind === 'work')
            const hasEvent = items.some(i => i.kind === 'event')
            return (
              <Marker key={city} coordinates={coords}>
                <circle
                  r={isHub ? 9 : 5}
                  fill={isHub ? '#F5E642' : hasWork && !hasEvent ? '#F5E642' : '#111111'}
                  stroke={isHub || (hasWork && !hasEvent) ? '#111111' : 'none'}
                  strokeWidth={isHub || (hasWork && !hasEvent) ? 1.5 : 0}
                />
                {isHub && (
                  <text
                    y={4}
                    textAnchor="middle"
                    style={{ fontFamily: 'sans-serif', fontSize: 7, fontWeight: 700, fill: '#111111', pointerEvents: 'none' }}
                  >
                    {total}
                  </text>
                )}
                <text
                  y={isHub ? 22 : 16}
                  textAnchor="middle"
                  style={{ fontFamily: 'sans-serif', fontSize: 7, fontWeight: 600, fill: '#888888', letterSpacing: '0.04em', pointerEvents: 'none' }}
                >
                  {city.slice(0, 12).toUpperCase()}
                </text>
              </Marker>
            )
          })}
        </ComposableMap>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: 12, left: 12, background: 'rgba(255,255,255,0.92)', borderRadius: 10, padding: '8px 12px', display: 'flex', gap: 14, backdropFilter: 'blur(4px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#111111' }} />
            <span style={{ fontSize: 9, color: '#888888' }}>Event</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5E642', border: '1.5px solid #111111' }} />
            <span style={{ fontSize: 9, color: '#888888' }}>Work</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F5E642', border: '1.5px solid #111111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 5, fontWeight: 700 }}>3</span>
            </div>
            <span style={{ fontSize: 9, color: '#888888' }}>Hub (3+)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 9, color: '#BBBBBB' }}>{cities.length} cities · {total} items</span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ width: 220, flexShrink: 0, borderLeft: '1px solid #F5F5F5', padding: '20px 18px', overflowY: 'auto' }}>
        <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 14px' }}>By city</p>
        {cities.length === 0 ? (
          <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>Add locations to events or works to see them here.</p>
        ) : cities.map(([city, items], i) => {
          const eventItems = items.filter(x => x.kind === 'event')
          const workItems = items.filter(x => x.kind === 'work')
          return (
            <div key={city}>
              {i > 0 && <div style={{ height: 1, background: '#F5F5F5', margin: '14px 0' }} />}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontFamily: 'Recoleta, serif', fontSize: 13, color: '#111111' }}>{city}</span>
                <span style={{ fontSize: 9, color: '#AAAAAA', background: '#F5F5F5', padding: '2px 7px', borderRadius: 999 }}>{items.length}</span>
              </div>
              {eventItems.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  {eventItems.slice(0, 3).map((e, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#111111', flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontSize: 10, color: '#888888', lineHeight: 1.4 }}>{e.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {workItems.length > 0 && (
                <div>
                  {workItems.slice(0, 2).map((w, j) => (
                    <div key={j} style={{ display: 'flex', gap: 6, alignItems: 'baseline', marginBottom: 2 }}>
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#F5E642', border: '1px solid #999', flexShrink: 0, marginTop: 4 }} />
                      <span style={{ fontSize: 10, color: '#888888', lineHeight: 1.4 }}>{w.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function WorldMap() {
  return (
    <Shell>
      <WorldMapPanel />
    </Shell>
  )
}
