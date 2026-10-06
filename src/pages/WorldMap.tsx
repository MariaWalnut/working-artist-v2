import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

// Approximate world map city coords (lon → x, lat → y) in SVG viewBox 0 0 860 500
function lonLatToSvg(lon: number, lat: number): [number, number] {
  const x = ((lon + 180) / 360) * 860
  const y = ((90 - lat) / 180) * 500
  return [x, y]
}

// Known city coordinates
const CITY_COORDS: Record<string, [number, number]> = {
  'Berlin':     lonLatToSvg(13.4, 52.5),
  'Paris':      lonLatToSvg(2.3, 48.9),
  'London':     lonLatToSvg(-0.1, 51.5),
  'Vienna':     lonLatToSvg(16.4, 48.2),
  'Amsterdam':  lonLatToSvg(4.9, 52.4),
  'New York':   lonLatToSvg(-74, 40.7),
  'Los Angeles':lonLatToSvg(-118, 34),
  'Tokyo':      lonLatToSvg(139.7, 35.7),
  'Sydney':     lonLatToSvg(151.2, -33.9),
  'São Paulo':  lonLatToSvg(-46.6, -23.5),
  'Mexico City':lonLatToSvg(-99.1, 19.4),
  'Mumbai':     lonLatToSvg(72.9, 19),
  'Shanghai':   lonLatToSvg(121.5, 31.2),
  'Toronto':    lonLatToSvg(-79.4, 43.7),
  'Madrid':     lonLatToSvg(-3.7, 40.4),
  'Rome':       lonLatToSvg(12.5, 41.9),
  'Stockholm':  lonLatToSvg(18, 59.3),
  'Warsaw':     lonLatToSvg(21, 52.2),
  'Brussels':   lonLatToSvg(4.4, 50.8),
  'Zurich':     lonLatToSvg(8.5, 47.4),
}

function getCityCoords(city: string): [number, number] | null {
  for (const [known, coords] of Object.entries(CITY_COORDS)) {
    if (city.toLowerCase().includes(known.toLowerCase()) || known.toLowerCase().includes(city.toLowerCase())) {
      return coords
    }
  }
  return null
}

export function WorldMap() {
  const dept = useActiveDept()
  const projects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  // Group by city
  const byCity: Record<string, typeof projects> = {}
  for (const p of projects) {
    const city = p.location?.trim()
    if (!city) continue
    byCity[city] = [...(byCity[city] ?? []), p]
  }
  const cities = Object.entries(byCity).sort((a, b) => b[1].length - a[1].length)
  const total = projects.filter(p => p.location).length

  return (
    <Shell>
      <div style={{ background: '#FFFFFF', borderRadius: 20, display: 'flex', overflow: 'hidden', minHeight: 560 }}>
        {/* Map area */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 400 }}>
          <svg width="100%" height="100%" viewBox="0 0 860 500" preserveAspectRatio="xMidYMid meet" style={{ display: 'block', minHeight: 400 }}>
            {/* Ocean */}
            <rect width="860" height="500" fill="#F8F8F8" />

            {/* Simplified continents */}
            {/* North America */}
            <path fill="#F0F0F0" d="M50 55 C75 42 120 40 155 50 C178 58 196 78 204 105 C214 138 208 178 192 208 C176 236 152 248 130 240 C108 232 90 210 78 184 C64 156 55 128 50 100 C46 78 44 62 50 55 Z" />
            {/* South America */}
            <path fill="#F0F0F0" d="M168 244 C188 236 212 240 224 260 C238 282 240 320 232 358 C224 390 205 412 182 414 C159 416 142 396 136 368 C129 338 133 296 140 264 C146 248 155 249 168 244 Z" />
            {/* Europe */}
            <path fill="#F0F0F0" d="M362 68 C385 58 425 54 460 64 C488 72 502 94 492 118 C482 140 452 152 420 148 C388 144 362 126 354 104 C348 88 352 74 362 68 Z M340 72 C352 60 368 62 372 76 C374 90 362 102 348 100 C336 98 330 86 334 76 Z M394 40 C408 28 428 30 432 46 C435 60 420 72 406 68 C394 64 388 52 394 40 Z" />
            {/* Africa */}
            <path fill="#F0F0F0" d="M360 120 C392 110 438 112 464 128 C482 142 490 172 486 216 C482 262 466 310 446 348 C428 382 404 398 380 392 C356 386 336 362 326 326 C316 288 318 240 326 196 C334 156 340 128 360 120 Z" />
            {/* Asia + Russia */}
            <path fill="#F0F0F0" d="M462 38 C530 22 640 18 730 26 C790 34 830 56 840 84 C848 108 828 136 790 152 C750 168 698 172 648 162 C596 152 554 130 524 106 C494 82 466 60 462 38 Z M524 160 C544 154 566 162 574 184 C582 206 572 234 554 244 C536 254 516 240 510 218 C504 196 510 168 524 160 Z M638 172 C666 162 710 164 728 180 C738 192 726 210 700 214 C672 218 644 208 634 196 C628 186 630 176 638 172 Z" />
            {/* Australia */}
            <path fill="#F0F0F0" d="M618 300 C658 284 710 282 742 298 C762 312 768 340 758 368 C748 394 718 408 682 406 C646 404 618 386 606 360 C596 334 596 314 618 300 Z" />

            {/* City pins */}
            {cities.map(([city, evts]) => {
              const coords = getCityCoords(city)
              if (!coords) return null
              const [cx, cy] = coords
              const count = evts.length
              const isMain = count >= 3
              return (
                <g key={city}>
                  <circle cx={cx} cy={cy} r={isMain ? 14 : 7} fill={isMain ? '#F5E642' : '#111111'} stroke={isMain ? '#111111' : 'none'} strokeWidth={isMain ? 1.5 : 0} />
                  {isMain && <text x={cx} y={cy + 4} fontFamily="Inter, sans-serif" fontSize="10" fontWeight="700" fill="#111111" textAnchor="middle">{count}</text>}
                  <text x={cx} y={cy + (isMain ? 28 : 18)} fontFamily="Inter, sans-serif" fontSize="8.5" fontWeight="600" fill="#111111" textAnchor="middle" letterSpacing="0.05em">{city.toUpperCase().slice(0, 10)}</text>
                </g>
              )
            })}

            {/* Legend */}
            <rect x="14" y="454" width="220" height="38" rx="8" fill="white" opacity="0.92" />
            <circle cx="30" cy="466" r="5" fill="#F5E642" stroke="#111111" strokeWidth="1" />
            <text x="40" y="470" fontFamily="Inter, sans-serif" fontSize="9" fill="#666666">Main hub (3+ events)</text>
            <circle cx="30" cy="482" r="5" fill="#111111" />
            <text x="40" y="486" fontFamily="Inter, sans-serif" fontSize="9" fill="#666666">City with events</text>

            {/* Header */}
            <text x="16" y="26" fontFamily="Recoleta, serif" fontSize="18" fill="#111111">Where</text>
            <text x="16" y="42" fontFamily="Inter, sans-serif" fontSize="9.5" fill="#AAAAAA" letterSpacing="0.05em">{cities.length} cities · {total} events</text>
          </svg>
        </div>

        {/* Right panel */}
        <div style={{ width: 264, flexShrink: 0, borderLeft: '1px solid #F5F5F5', padding: '22px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <p style={{ fontSize: 9, fontWeight: 600, color: '#CCCCCC', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 16px' }}>Events by city</p>

          {cities.length === 0 ? (
            <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>Add locations to your projects to see them here.</p>
          ) : cities.map(([city, evts], i) => {
            const byYear: Record<number, typeof evts> = {}
            for (const p of evts) {
              const y = Number((p.dateStart ?? p.dateEnd ?? '0').slice(0, 4)) || 0
              byYear[y] = [...(byYear[y] ?? []), p]
            }
            const years = Object.keys(byYear).map(Number).sort((a, b) => b - a)
            return (
              <div key={city}>
                {i > 0 && <div style={{ height: 1, background: '#F5F5F5', margin: '16px 0' }} />}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: '#111111' }}>{city}</span>
                  <span style={{ fontSize: 10, color: '#AAAAAA', background: '#F5F5F5', padding: '3px 8px', borderRadius: 999 }}>{evts.length} {evts.length === 1 ? 'event' : 'events'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {years.filter(y => y > 0).slice(0, 3).map(y => (
                    <div key={y} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                      <span style={{ fontSize: 9, color: '#CCCCCC', fontWeight: 500, minWidth: 28 }}>{y}</span>
                      <span style={{ fontSize: 11, color: '#888888', lineHeight: 1.4 }}>{byYear[y].map(p => p.title).join(' · ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Shell>
  )
}
