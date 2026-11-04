import { useState, useMemo, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EventEntry } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { currentMonth, formatEventDate, isUpcoming, onTimeline } from '../lib/eventDates'
import { EventCalendar } from '../components/EventCalendar'
import { DateFields } from '../components/DateFields'
import { Shell } from '../components/layout/Shell'
import { PeopleCard } from '../components/PeopleCard'
import { Hint } from '../components/Hint'
import { FrameHeader } from '../components/FrameHeader'
import { AddButton, BoxHeading, FrameTitle, SideItem, SidePanel, pageFrame, pageGrid } from '../components/PageFrame'
import { PracticeFilter, PracticePicker } from '../components/Practice'
import { practiceOf, usePractice } from '../lib/practice'
import type { Activity, Work } from '../db/db'


const EVENT_TYPES = ['Meeting', 'Reading', 'Exhibition', 'Book Fair', 'Market', 'Talk', 'Performance', 'Screening', 'Festival', 'Award', 'Residency', 'Other']

const TYPE_DOT: Record<string, string> = {
  Meeting:     'var(--accent)',
  Reading:     '#8CB4D4',
  Exhibition:  'var(--wa-ink)',
  'Book Fair': '#F0C878',
  Market:      '#C8A88C',
  Talk:        '#B8C8A8',
  Performance: '#D4A8C8',
  Screening:   '#A8B4D4',
  Festival:    '#E0A030',
  Award:       'var(--accent)',
  Residency:   'var(--wa-muted)',
  Other:       'var(--wa-line-strong)',
}

const NARROW = '(max-width: 720px)'

function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW)
    const onChange = () => setNarrow(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return narrow
}

// ─── Form ─────────────────────────────────────────────────────────────────────

type Draft = Partial<Pick<EventEntry, 'date' | 'type' | 'projectIds' | 'maybe'>>

function EventForm({ entry, draft, works, allWorks, onDone }: {
  entry: EventEntry | null
  draft?: Draft
  works: Array<{ id?: number; title: string; medium?: string }>
  allWorks: Work[]
  onDone: () => void
}) {
  const dept = useActiveDept()
  const { acts, start } = usePractice({ filter: true })
  const [practices, setPractices] = useState<Activity[] | undefined>(() => {
    if (entry?.practices?.length) return entry.practices
    const one = entry ? entry.practice : start
    return one ? [one] : undefined
  })
  const [title, setTitle] = useState(entry?.title ?? '')
  const [type, setType] = useState(entry?.type ?? draft?.type ?? '')
  const [location, setLocation] = useState(entry?.location ?? '')
  const [date, setDate] = useState(entry?.date ?? draft?.date ?? '')
  const [time, setTime] = useState(entry?.time ?? '')
  const [projectIds, setProjectIds] = useState<number[]>(entry?.projectIds ?? draft?.projectIds ?? [])
  const [personIds, setPersonIds] = useState<number[]>([])
  // Older events stay on the timeline until taken off; new ones go on when ticked.
  const [timeline, setTimeline] = useState(entry ? onTimeline(entry) : false)
  const allProjects = useLiveQuery(() => dept?.id == null ? [] : db.projects.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const contacts = useLiveQuery(() => dept?.id == null ? [] : db.contacts.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const meeting = type === 'Meeting'
  const [maybe, setMaybe] = useState(entry?.maybe ?? draft?.maybe ?? false)
  const [url, setUrl] = useState(entry?.url ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [goals, setGoals] = useState(entry?.goals ?? '')
  const [workIds, setWorkIds] = useState<number[]>(entry?.workIds ?? [])
  const [endDate, setEndDate] = useState(entry?.endDate ?? '')
  const [showEnd, setShowEnd] = useState(!!entry?.endDate)
  const upcoming = !date || isUpcoming({ title, date, endDate: endDate || undefined })

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill-2)', padding: '8px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%' }

  function toggleWork(id: number) {
    setWorkIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function save() {
    if (!title.trim()) return
    const data: EventEntry = {
      departmentId: dept?.id,
      title: title.trim(),
      type: type || undefined,
      location: location.trim() || undefined,
      ...orderedDates(date, meeting ? '' : endDate),
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      goals: goals.trim() || undefined,
      workIds: workIds.length > 0 ? workIds : undefined,
      practice: practices?.[0],
      practices,
      time: meeting && time ? time : undefined,
      projectIds: meeting && projectIds.length ? projectIds : undefined,
      onTimeline: meeting || maybe ? false : timeline,
      maybe: maybe || undefined,
    }
    if (entry?.id != null) await db.eventEntries.update(entry.id, data as Partial<EventEntry>)
    else {
      const id = await db.eventEntries.add(data) as number
      for (const c of contacts.filter(x => personIds.includes(x.id!))) await db.contacts.update(c.id!, { eventIds: [...(c.eventIds ?? []), id] })
    }
    onDone()
  }

  async function del() {
    if (entry?.id != null) await db.eventEntries.delete(entry.id)
    onDone()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
      <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 28, width: 460, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.15)' }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 16px' }}>{entry ? 'Edit event' : 'Add event'}</p>

        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
          style={{ ...inp, marginBottom: 10, fontSize: 14 }}
          onKeyDown={e => { if (e.key === 'Enter') void save() }} />

        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <select aria-label="Type" value={type} onChange={e => setType(e.target.value)} style={{ ...inp, flex: 1, color: type ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>
            <option value="">Type…</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City / Venue" style={{ ...inp, flex: 1 }} />
        </div>
        {!meeting && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 12, color: 'var(--wa-text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={maybe} onChange={e => setMaybe(e.target.checked)} style={{ width: 14, height: 14, margin: 0, accentColor: 'var(--wa-ink)' }} />
            Some day, not confirmed yet
          </label>
        )}
        <PracticePicker value={practices ?? [practiceOf(acts, allWorks).event({ type, workIds })]} onChange={setPractices} style={{ marginBottom: 14 }} />

        {meeting ? (
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <label style={{ flex: 2, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 6px' }}>Date</span>
              <input type="date" value={date.length === 10 ? date : ''} onChange={e => setDate(e.target.value)} style={inp} />
            </label>
            <label style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 6px' }}>Time</span>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp} />
            </label>
          </div>
        ) : <>
        <DateFields label={showEnd ? 'Starts' : 'Date'} value={date} onChange={setDate} inp={inp}
          action={!showEnd && (
            <button type="button" onClick={() => setShowEnd(true)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--wa-muted)', cursor: 'pointer' }}>+ End date</button>
          )} />
        {showEnd && (
          <DateFields label="Ends" value={endDate} onChange={setEndDate} inp={inp}
            action={
              <button type="button" onClick={() => { setShowEnd(false); setEndDate('') }} style={{ background: 'none', border: 'none', padding: 0, fontSize: 10, color: 'var(--wa-muted)', cursor: 'pointer' }}>Remove</button>
            } />
        )}
        </>}

        {meeting && <>
          {allProjects.length > 0 && <ChipField label="Projects" items={allProjects.map(p => ({ id: p.id!, label: p.title }))} on={projectIds} onChange={setProjectIds} />}
        </>}
        {(meeting || maybe) && entry?.id == null && contacts.length > 0 && <ChipField label="People" items={contacts.map(c => ({ id: c.id!, label: c.name }))} on={personIds} onChange={setPersonIds} />}

        {!meeting && !maybe && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12, color: 'var(--wa-text)', cursor: 'pointer' }}>
            <input type="checkbox" checked={timeline} onChange={e => setTimeline(e.target.checked)} style={{ width: 14, height: 14, margin: 0, accentColor: 'var(--wa-ink)' }} />
            Show on my career timeline and map
          </label>
        )}

        <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" aria-label="Link" style={{ ...inp, marginBottom: 10 }} />

        {(upcoming || goals) && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 8px' }}>Goals</p>
            <textarea value={goals} onChange={e => setGoals(e.target.value)} rows={3} aria-label="Goals"
              placeholder={'One per line, e.g.\nMeet two publishers\nSell 20 books'}
              style={{ ...inp, resize: 'vertical' }} />
          </div>
        )}

        {works.length > 0 && !upcoming && (
          <div style={{ marginBottom: 10 }}>
            <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 8px' }}>Works shown</p>
            {workIds.length === 0 && <Hint id="event-works" style={{ marginBottom: 8 }}>Pick the works you showed. They appear together on your timeline and map.</Hint>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto' }}>
              {works.map(w => {
                if (w.id == null) return null
                const sel = workIds.includes(w.id)
                return (
                  <button key={w.id} type="button" onClick={() => toggleWork(w.id!)}
                    style={{ padding: '4px 11px', borderRadius: 999, border: sel ? 'none' : '1px solid var(--wa-line)', background: sel ? 'var(--accent)' : 'transparent', color: sel ? '#111111' : 'var(--wa-text-2)', fontSize: 11, fontWeight: sel ? 600 : 400, cursor: 'pointer', transition: 'background 0.1s' }}>
                    {w.title}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {entry?.id != null && <PeopleCard kind="event" id={entry.id} deptId={dept?.id} style={{ marginBottom: 12 }} />}

        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={2}
          style={{ ...inp, resize: 'vertical', marginBottom: 16 }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>{entry && <button onClick={() => void del()} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer' }}>Delete</button>}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onDone} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>{entry ? 'Save' : 'Add'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChipField({ label, items, on, onChange }: { label: string; items: Array<{ id: number; label: string }>; on: number[]; onChange: (ids: number[]) => void }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 8px' }}>{label}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 96, overflowY: 'auto' }}>
        {items.map(i => {
          const sel = on.includes(i.id)
          return <button key={i.id} type="button" onClick={() => onChange(sel ? on.filter(x => x !== i.id) : [...on, i.id])}
            style={{ padding: '4px 11px', borderRadius: 999, border: sel ? '1px solid transparent' : '1px solid var(--wa-line)', background: sel ? 'var(--accent)' : 'transparent', color: sel ? '#111111' : 'var(--wa-text)', fontSize: 11, fontWeight: sel ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>{i.label}</button>
        })}
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYear(s?: string) { return s ? Number(s.slice(0, 4)) : 0 }

// Drops an end that matches the start and swaps the two if they were entered backwards.
function orderedDates(start: string, end: string): Pick<EventEntry, 'date' | 'endDate'> {
  if (!start) return { date: end || undefined, endDate: undefined }
  if (!end || end === start) return { date: start, endDate: undefined }
  return end < start ? { date: end, endDate: start } : { date: start, endDate: end }
}

function exportCSV(events: EventEntry[]) {
  const rows = [['Date', 'Event', 'City', 'Type'], ...events.map(e => [formatEventDate(e.date, e.endDate), e.title, e.location ?? '', e.type ?? ''])]
  const csv = rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = 'events.csv'
  a.click()
}

// ─── AllEvents ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15

export function AllEvents() {
  const dept = useActiveDept()
  const narrow = useNarrow()
  const today = currentMonth()

  const [yearFilter, setYearFilter] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [cityFilter, setCityFilter] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [editing, setEditing] = useState<EventEntry | 'new' | null>(null)
  const [draft, setDraft] = useState<Draft | undefined>()
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const addEvent = (d?: Draft) => { setDraft(d); setEditing('new') }

  const { acts, keep } = usePractice({ filter: true })
  const allEntries = useLiveQuery(() => dept?.id == null ? [] : db.eventEntries.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  const allWorks = useLiveQuery(() => dept?.id == null ? [] : db.works.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []
  // A link from the map opens that event (?e=).
  const [params, setParams] = useSearchParams()
  const eParam = params.get('e')
  useEffect(() => {
    if (!eParam) return
    const e = allEntries.find(x => x.id === Number(eParam))
    if (e) { setEditing(e); setParams({}, { replace: true }) }
  }, [eParam, allEntries.length])
  // A project page adds a meeting about itself (?new=meeting&project=).
  useEffect(() => {
    if (params.get('new') !== 'meeting') return
    const project = Number(params.get('project'))
    addEvent({ type: 'Meeting', projectIds: project ? [project] : undefined })
    setParams({}, { replace: true })
  }, [params])
  const of = practiceOf(acts, allWorks)
  const inPractice = allEntries.filter(e => of.eventAll(e).some(keep))
  // Some day: not confirmed, or nothing fixed yet. Everything else has a date.
  const entries = inPractice.filter(e => !e.maybe && e.date)
  const works = allWorks.filter(w => keep(of.work(w)))

  const sorted = useMemo(() => [...entries].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')), [entries])

  const years = useMemo(() => [...new Set(sorted.map(e => toYear(e.date)).filter(Boolean))].sort((a, b) => b - a), [sorted])
  const types = useMemo(() => [...new Set(sorted.map(e => e.type).filter(Boolean))] as string[], [sorted])
  const cities = useMemo(() => [...new Set(sorted.map(e => e.location).filter(Boolean))] as string[], [sorted])

  const filtered = useMemo(() => sorted.filter(e => {
    if (yearFilter && toYear(e.date) !== yearFilter) return false
    if (typeFilter && e.type !== typeFilter) return false
    if (cityFilter && e.location !== cityFilter) return false
    return true
  }), [sorted, yearFilter, typeFilter, cityFilter])

  const upcoming = filtered.filter(e => isUpcoming(e, today)).reverse()
  const past = filtered.filter(e => !isUpcoming(e, today))
  const pastShown = showAll ? past : past.slice(0, PAGE_SIZE)
  const someDay = yearFilter ? [] : inPractice.filter(e => (e.maybe || !e.date) && (!typeFilter || e.type === typeFilter) && (!cityFilter || e.location === cityFilter)).sort((a, b) => a.title.localeCompare(b.title))

  const eventRow = (e: EventEntry, i: number, all: EventEntry[]) => (
            <div key={e.id} data-tour-title={e.title} onClick={() => setEditing(e)}
              style={{ display: 'grid', gridTemplateColumns: narrow ? '76px 1fr' : '110px 1fr 130px 110px', columnGap: narrow ? 12 : 16, padding: narrow ? '13px 16px' : '13px 20px', borderBottom: i < all.length - 1 ? '1px solid var(--wa-line)' : 'none', alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: isUpcoming(e, today) ? 'var(--wa-ink)' : 'var(--wa-muted)' }}>{[formatEventDate(e.date, e.endDate), e.time].filter(Boolean).join(' · ')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: TYPE_DOT[e.type ?? ''] ?? 'var(--wa-line)' }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--wa-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                </div>
                {narrow && (e.location || e.type) && (
                  <span style={{ paddingLeft: 14, fontSize: 10, color: 'var(--wa-muted)' }}>{[e.location, e.type].filter(Boolean).join(' · ')}</span>
                )}
                {e.workIds && e.workIds.length > 0 && (
                  <div style={{ paddingLeft: 14, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {e.workIds.map(id => {
                      const w = allWorks.find(x => x.id === id)
                      if (!w) return null
                      return <span key={id} style={{ fontSize: 9, color: 'var(--wa-muted)', background: 'var(--wa-fill)', padding: '1px 6px', borderRadius: 999 }}>{w.title}</span>
                    })}
                  </div>
                )}
              </div>
              </div>
              {!narrow && <span style={{ fontSize: 11, color: 'var(--wa-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.location ?? ''}</span>}
              {!narrow && <span style={{ fontSize: 9, fontWeight: 600, background: 'var(--wa-fill)', color: 'var(--wa-text-2)', padding: '3px 8px', borderRadius: 4, width: 'fit-content' }}>{e.type ?? ''}</span>}
            </div>
  )

  return (
    <Shell>
      {editing !== null && (
        <EventForm entry={editing === 'new' ? null : editing} draft={draft} works={works} allWorks={allWorks} onDone={() => setEditing(null)} />
      )}

      <div style={pageGrid(narrow)}>

        {/* Filters */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <PracticeFilter narrow={narrow} />
          {years.length > 0 && (
            <SidePanel title="Year" narrow={narrow}>
              <SideItem label="All" active={yearFilter === null} narrow={narrow} onClick={() => setYearFilter(null)} />
              {years.map(y => <SideItem key={y} label={String(y)} count={sorted.filter(e => toYear(e.date) === y).length} active={yearFilter === y} narrow={narrow} onClick={() => setYearFilter(yearFilter === y ? null : y)} />)}
            </SidePanel>
          )}
          {types.length > 0 && (
            <SidePanel title="Type" narrow={narrow}>
              {types.map(t => <SideItem key={t} label={t} dot={TYPE_DOT[t] ?? 'var(--wa-line)'} count={sorted.filter(e => e.type === t).length} active={typeFilter === t} narrow={narrow} onClick={() => setTypeFilter(typeFilter === t ? null : t)} />)}
            </SidePanel>
          )}
          {cities.length > 0 && (
            <SidePanel title="City" narrow={narrow}>
              {cities.slice(0, 8).map(c => <SideItem key={c} label={c} count={sorted.filter(e => e.location === c).length} active={cityFilter === c} narrow={narrow} onClick={() => setCityFilter(cityFilter === c ? null : c)} />)}
            </SidePanel>
          )}
        </div>

        <div data-tour="events-list" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={pageFrame}>
          <FrameHeader right={<>
              <div role="radiogroup" aria-label="View" style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'var(--wa-fill)' }}>
                {(['list', 'calendar'] as const).map(v => (
                  <button key={v} role="radio" aria-checked={view === v} onClick={() => setView(v)}
                    style={{ padding: '4px 10px', border: 'none', borderRadius: 6, background: view === v ? 'var(--wa-surface)' : 'none', fontSize: 10, fontWeight: view === v ? 600 : 400, color: view === v ? 'var(--wa-ink)' : 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {v === 'list' ? 'List' : 'Calendar'}
                  </button>
                ))}
              </div>
              <AddButton onClick={() => addEvent()} />
          </>}>
            <FrameTitle count={filtered.length + someDay.length}>Events</FrameTitle>
          </FrameHeader>

          {view === 'calendar' && <EventCalendar events={filtered} narrow={narrow} dot={e => TYPE_DOT[e.type ?? ''] ?? 'var(--wa-line-strong)'} onOpen={setEditing} onDay={date => addEvent({ date })} />}

          {view === 'list' && upcoming.length > 0 && <><BoxHeading label="Upcoming" count={upcoming.length} />{upcoming.map(eventRow)}</>}
          </div>

          {view === 'list' && past.length > 0 && (
            <div style={pageFrame}>
              <BoxHeading label="Past" count={past.length} />
              {pastShown.map(eventRow)}
              {!showAll && past.length > PAGE_SIZE && (
                <button onClick={() => setShowAll(true)} style={{ display: 'block', padding: '12px 20px', border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>Show all {past.length}</button>
              )}
            </div>
          )}

          {view === 'list' && (
            <div style={pageFrame}>
              <BoxHeading label="Some day" count={someDay.length} onAdd={() => addEvent({ maybe: true })} />
              {someDay.map(eventRow)}
              {someDay.length === 0 && <p style={{ margin: 0, padding: '2px 20px 16px', fontSize: 12, color: 'var(--wa-muted)' }}>Things you have talked about that might happen. No dates needed.</p>}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={() => exportCSV(filtered)} style={{ background: 'none', border: '1px solid var(--wa-line-strong)', borderRadius: 8, padding: '5px 12px', fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer' }}>Export CSV</button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
