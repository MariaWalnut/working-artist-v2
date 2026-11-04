import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { geoEqualEarth } from 'd3-geo'
import { useLiveQuery } from 'dexie-react-hooks'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from 'react-simple-maps'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { practiceOf, usePractice } from '../lib/practice'
import { Shell } from '../components/layout/Shell'
import { CareerFrame } from '../components/CareerTabs'
import { PickPopover } from '../components/PickPopover'
import { formatAnyDate, isMeeting } from '../lib/eventDates'
import { findPlace, indexCities, loadCities, type City } from '../lib/places'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

interface CityItem { key: string; title: string; kind: 'Event' | 'Work'; date?: string; year?: number; to: string }
type View = { center: [number, number]; zoom: number }

const MAP_W = 800
const MAP_H = 420
const MAX_ZOOM = 16
const WORLD: View = { center: [10, 15], zoom: 1 }

// Same projection the map draws with, so the fit is measured in real map pixels.
const projection = geoEqualEarth().scale(140).translate([MAP_W / 2, MAP_H / 2])

// Closest view that still shows every location, with room for labels and the legend.
function fitView(coords: Array<[number, number]>): View {
  const pts = coords.map(c => projection(c)).filter((p): p is [number, number] => p != null)
  if (pts.length === 0) return WORLD
  const xs = pts.map(p => p[0])
  const ys = pts.map(p => p[1])
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const zoom = Math.min((MAP_W * 0.7) / Math.max(maxX - minX, 30), (MAP_H * 0.55) / Math.max(maxY - minY, 20))
  const center = projection.invert?.([(minX + maxX) / 2, (minY + maxY) / 2 + 6]) ?? WORLD.center
  return { center: [center[0], center[1]], zoom: Math.min(10, Math.max(1, zoom)) }
}

const yearOf = (d?: string | number) => Number(String(d ?? '').slice(0, 4)) || undefined

function Pin({ city, items, selected, scale, onClick }: { city: string; items: CityItem[]; selected: boolean; scale: number; onClick: () => void }) {
  const hub = items.length >= 3
  const onlyWorks = items.every(i => i.kind === 'Work')
  const bright = hub || onlyWorks
  return (
    <g transform={`scale(${scale})`} onClick={onClick} role="button" aria-label={`${city}, ${items.length}`} style={{ cursor: 'pointer' }}>
      <circle r={12} style={{ fill: 'transparent' }} />
      {selected && <circle r={hub ? 13 : 9} style={{ fill: 'none', stroke: 'var(--wa-ink)', strokeWidth: 1 }} />}
      <circle r={hub ? 9 : 5} style={{ fill: bright ? 'var(--accent)' : 'var(--wa-ink)' }} stroke={bright ? '#111111' : 'none'} strokeWidth={bright ? 1.5 : 0} />
      {hub && <text y={4} textAnchor="middle" style={{ fontFamily: 'sans-serif', fontSize: 7, fontWeight: 700, fill: '#111111', pointerEvents: 'none' }}>{items.length}</text>}
      <text y={hub ? 22 : 16} textAnchor="middle" style={{ fontFamily: 'sans-serif', fontSize: 7, fontWeight: 600, fill: 'var(--wa-muted)', letterSpacing: '0.04em', pointerEvents: 'none' }}>{city.toUpperCase()}</text>
    </g>
  )
}

export function WorldMapPanel() {
  const dept = useActiveDept()
  const navigate = useNavigate()
  const { acts, keep } = usePractice()
  const allEvents = useLiveQuery(() => dept?.id == null ? [] : db.eventEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const allWorks = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const of = practiceOf(acts, allWorks)
  const events = allEvents.filter(e => of.eventAll(e).some(keep) && !isMeeting(e) && !e.maybe)
  const works = allWorks.filter(w => keep(of.work(w)))

  const [cityList, setCityList] = useState<City[]>([])
  useEffect(() => { void loadCities().then(setCityList) }, [])
  const index = useMemo(() => indexCities(cityList), [cityList])
  const [year, setYear] = useState<number | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [placing, setPlacing] = useState<string | null>(null)

  const everything: Array<CityItem & { place: string }> = [
    ...events.filter(e => e.location?.trim()).map(e => (
      { key: `e${e.id}`, place: e.location!.trim(), title: e.title, kind: 'Event' as const, date: e.date, year: yearOf(e.date), to: `/projects/events?e=${e.id}` }
    )),
    ...works.filter(w => w.location?.trim()).map(w => {
      const date = w.publishedDate ?? (w.year != null ? String(w.year) : undefined)
      return { key: `w${w.id}`, place: w.location!.trim(), title: w.title, kind: 'Work' as const, date, year: yearOf(date), to: `/studio/${w.id}` }
    }),
  ]
  const years = [...new Set(everything.map(i => i.year).filter((y): y is number => y != null))].sort((a, b) => b - a)
  const shown = year == null ? everything : everything.filter(i => i.year === year)

  // Places by the name the map knows them by, so Lisbon and Lisboa are one pin.
  const resolve = (text: string) => dept?.places?.[text] ?? findPlace(text, index)
  const byCity = new Map<string, { coords: [number, number]; items: CityItem[] }>()
  const lost = new Map<string, number>()
  for (const item of shown) {
    const place = resolve(item.place)
    if (!place) { lost.set(item.place, (lost.get(item.place) ?? 0) + 1); continue }
    const city = byCity.get(place.name) ?? { coords: place.coords, items: [] }
    city.items.push(item)
    byCity.set(place.name, city)
  }
  const located = [...byCity].map(([city, v]) => ({ city, ...v })).sort((a, b) => b.items.length - a.items.length)
  const total = located.reduce((n, c) => n + c.items.length, 0)
  const open = selected ? located.find(c => c.city === selected) : undefined

  const fit = fitView(located.map(l => l.coords))
  const fitKey = located.map(l => l.city).sort().join('|')

  // The view refits itself whenever the set of places changes.
  const [saved, setSaved] = useState<View & { key: string }>({ ...WORLD, key: '' })
  const [movingZoom, setMovingZoom] = useState<number | null>(null)
  const view: View = saved.key === fitKey ? saved : fit
  const setView = (v: View) => setSaved({ ...v, key: fitKey })
  const markerScale = 1 / (movingZoom ?? view.zoom)
  const zoomBtn: React.CSSProperties = { width: 32, height: 32, background: 'var(--wa-surface)', border: 'none', borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,.10)', cursor: 'pointer', fontSize: 16, color: 'var(--wa-ink)' }

  function choose(city: string, coords: [number, number]) {
    setSelected(city)
    setView({ center: coords, zoom: Math.max(view.zoom, 5) })
  }
  const pickItems = useMemo(() => {
    if (placing == null) return []
    const names = new Intl.DisplayNames(['en'], { type: 'region' })
    return cityList.map((c, i) => { let sub = c[1]; try { sub = names.of(c[1]) ?? c[1] } catch { /* unknown code */ } return { id: i, label: c[0], sub } })
  }, [placing == null, cityList])
  async function place(text: string, i: number) {
    const c = cityList[i]
    if (dept?.id != null && c) await db.departments.update(dept.id, { places: { ...dept.places, [text]: { name: c[0], coords: [c[2], c[3]] } } })
    setPlacing(null)
  }

  const label: React.CSSProperties = { fontSize: 9, fontWeight: 600, color: 'var(--wa-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', margin: '0 0 12px' }
  const plainBtn: React.CSSProperties = { display: 'block', width: '100%', padding: 0, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }
  const yearChip = (text: string, value: number | null) => (
    <button key={text} onClick={() => { setYear(value); setSelected(null) }} aria-pressed={year === value}
      style={{ flexShrink: 0, minHeight: 28, padding: '0 11px', border: 'none', borderRadius: 999, background: year === value ? 'var(--wa-ink)' : 'var(--wa-surface)', color: year === value ? 'var(--wa-surface)' : 'var(--wa-text)', fontSize: 11, fontWeight: year === value ? 600 : 400, boxShadow: '0 1px 6px rgba(0,0,0,.10)', cursor: 'pointer', fontFamily: 'inherit' }}>
      {text}
    </button>
  )

  return (
    <div style={{ background: 'var(--wa-surface)', borderRadius: 20, display: 'flex', flexWrap: 'wrap', overflow: 'hidden', minHeight: 540 }}>
      {/* Map; the city list drops below it on narrow screens */}
      <div style={{ flex: '999 1 420px', minWidth: 0, position: 'relative' }}>
        <ComposableMap
          width={MAP_W}
          height={MAP_H}
          projectionConfig={{ scale: 140 }}
          preserveAspectRatio="xMidYMid slice"
          style={{ width: '100%', height: '100%', minHeight: 540, display: 'block', cursor: 'grab' }}
        >
          <ZoomableGroup
            center={view.center}
            zoom={view.zoom}
            minZoom={1}
            maxZoom={MAX_ZOOM}
            onMove={({ zoom }) => { if (zoom) setMovingZoom(zoom) }}
            onMoveEnd={({ coordinates, zoom }) => {
              setMovingZoom(null)
              if (coordinates && zoom) setView({ center: coordinates, zoom })
            }}
          >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="var(--wa-map-land)"
                  stroke="var(--wa-surface)"
                  strokeWidth={0.5 * markerScale}
                  style={{ outline: 'none' }}
                />
              ))
            }
          </Geographies>

          {/* The chosen city is drawn last so it sits on top */}
          {[...located].sort((a, b) => Number(a.city === selected) - Number(b.city === selected)).map(({ city, items, coords }) => (
            <Marker key={city} coordinates={coords}>
              <Pin city={city} items={items} selected={city === selected} scale={markerScale} onClick={() => choose(city, coords)} />
            </Marker>
          ))}
          </ZoomableGroup>
        </ComposableMap>

        {years.length > 0 && (
          <div style={{ position: 'absolute', top: 12, left: 12, right: 60, display: 'flex', gap: 6, overflowX: 'auto', padding: 2 }}>
            {yearChip('All', null)}
            {years.map(y => yearChip(String(y), y))}
          </div>
        )}

        {/* Zoom controls */}
        <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button aria-label="Zoom in" onClick={() => setView({ ...view, zoom: Math.min(MAX_ZOOM, view.zoom * 1.6) })} style={zoomBtn}>+</button>
          <button aria-label="Zoom out" onClick={() => setView({ ...view, zoom: Math.max(1, view.zoom / 1.6) })} style={zoomBtn}>−</button>
          <button onClick={() => { setView(fit); setSelected(null) }} style={{ ...zoomBtn, width: 'auto', padding: '0 10px', fontSize: 10, fontWeight: 600 }}>Fit</button>
        </div>

        <div style={{ position: 'absolute', bottom: 10, left: 12, display: 'flex', gap: 10, fontSize: 9, color: 'var(--wa-text-2)' }}>
          <span>{located.length} {located.length === 1 ? 'city' : 'cities'} · {total} {total === 1 ? 'item' : 'items'}</span>
          <a href="https://www.geonames.org" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Cities: GeoNames</a>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: '1 1 240px', borderLeft: '1px solid var(--wa-line)', borderTop: '1px solid var(--wa-line)', padding: '20px 18px', overflowY: 'auto', maxHeight: 620, boxSizing: 'border-box' }}>
        {open ? <>
          <button onClick={() => setSelected(null)} style={{ ...plainBtn, fontSize: 11, color: 'var(--wa-text-2)', marginBottom: 12 }}>← All cities</button>
          <h2 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 24, color: 'var(--wa-ink)', margin: '0 0 12px' }}>{open.city}</h2>
          {[...open.items].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).map(i => (
            <button key={i.key} onClick={() => navigate(i.to)} style={{ ...plainBtn, display: 'flex', gap: 10, alignItems: 'center', padding: '9px 0', borderTop: '1px solid var(--wa-line)' }}>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)' }}>{i.title}</span>
                <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2 }}>{[i.kind, formatAnyDate(i.date)].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          ))}
        </> : <>
          <p style={label}>By city</p>
          {located.length === 0 && lost.size === 0 && <p style={{ fontSize: 12, color: 'var(--wa-muted)', margin: 0 }}>{year == null ? 'Add locations to events or works to see them here.' : `Nothing with a place in ${year}.`}</p>}
          {located.map(({ city, items, coords }, i) => (
            <button key={city} data-tour-title={city} onClick={() => choose(city, coords)} style={{ ...plainBtn, padding: '10px 0', borderTop: i ? '1px solid var(--wa-line)' : 'none' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontFamily: 'Recoleta, serif', fontSize: 15, color: 'var(--wa-ink)' }}>{city}</span>
                <span style={{ fontSize: 10, color: 'var(--wa-text-2)', background: 'var(--wa-fill)', padding: '2px 7px', borderRadius: 999 }}>{items.length}</span>
              </span>
              <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{items.map(x => x.title).join(', ')}</span>
            </button>
          ))}
          {lost.size > 0 && cityList.length > 0 && <>
            <p style={{ ...label, margin: '22px 0 6px' }}>Not on the map</p>
            {[...lost].map(([text, n]) => (
              <div key={text} style={{ padding: '7px 0', borderTop: '1px solid var(--wa-line)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ minWidth: 0, fontSize: 12, color: 'var(--wa-ink)' }}>{text} <span style={{ color: 'var(--wa-muted)' }}>({n})</span></span>
                  <button onClick={() => setPlacing(placing === text ? null : text)} style={{ flexShrink: 0, padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit', borderBottom: '1px solid var(--accent)' }}>Find</button>
                </div>
                {placing === text && <div style={{ marginTop: 8 }}><PickPopover inline limit={30} items={pickItems} placeholder="Search cities" onPick={i => void place(text, i)} onClose={() => setPlacing(null)} /></div>}
              </div>
            ))}
          </>}
        </>}
      </div>
    </div>
  )
}

export function WorldMap() {
  return (
    <Shell>
      <CareerFrame active="map">
        <WorldMapPanel />
      </CareerFrame>
    </Shell>
  )
}
