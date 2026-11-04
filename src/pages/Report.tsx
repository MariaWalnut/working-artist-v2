import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type PressEntry } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { useNarrow } from '../lib/useNarrow'
import { Shell } from '../components/layout/Shell'
import { CareerFrame } from '../components/CareerTabs'
import { formatAnyDate } from '../lib/eventDates'
import { careerTips, TIP_GROUPS, type TipData } from '../lib/tips'

// A report on the whole studio, worked out on this computer from what is already in it.

const HIDDEN_KEY = 'wa-tips-hidden'
const FINISHED = ['Won', 'Accepted', 'Rejected', 'Closed']
const COMING_UP = 6

function readHidden(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[] } catch { return [] }
}

const isAward = (p: PressEntry) => p.category === 'award' || p.type === 'Shortlist'
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const heading: React.CSSProperties = { fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 22, color: 'var(--wa-ink)', margin: '0 0 8px' }
const small: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)' }
const quiet: React.CSSProperties = { flexShrink: 0, padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }

// A table that turns into stacked rows on a phone. The first cell is the name and opens the item.
function Table({ head, rows, widths, narrow }: { head: string[]; rows: Array<{ key: number; to: string; cells: string[] }>; widths: string; narrow: boolean }) {
  const navigate = useNavigate()
  return (
    <div style={{ marginBottom: 26 }}>
      {!narrow && (
        <div style={{ display: 'grid', gridTemplateColumns: widths, gap: 16, padding: '0 0 6px', borderBottom: '1px solid var(--wa-line)' }}>
          {head.map(h => <span key={h} style={small}>{h}</span>)}
        </div>
      )}
      {rows.map(r => (
        <button key={r.key} onClick={() => navigate(r.to)} style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : widths, gap: narrow ? 2 : 16, width: '100%', padding: '11px 0', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          {r.cells.map((c, i) => narrow && !c ? null : (
            <span key={i} style={{ fontSize: i === 0 ? 14 : 12, fontWeight: i === 0 ? 500 : 400, lineHeight: 1.4, color: i === 0 ? 'var(--wa-ink)' : 'var(--wa-text)' }}>{narrow && i > 0 ? `${head[i]}: ${c}` : c}</span>
          ))}
        </button>
      ))}
    </div>
  )
}

export function Report() {
  const dept = useActiveDept()
  const deptId = dept?.id
  const narrow = useNarrow()
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(readHidden)
  const [showHidden, setShowHidden] = useState(false)
  const data = useLiveQuery(async () => {
    if (deptId == null) return null
    const [works, projects, opportunities, events, contacts, todos, press] = await Promise.all([
      db.works.where('departmentId').equals(deptId).toArray(),
      db.projects.where('departmentId').equals(deptId).toArray(),
      db.opportunities.where('departmentId').equals(deptId).toArray(),
      db.eventEntries.where('departmentId').equals(deptId).toArray(),
      db.contacts.where('departmentId').equals(deptId).toArray(),
      db.todos.where('departmentId').equals(deptId).toArray(),
      db.pressEntries.where('departmentId').equals(deptId).toArray(),
    ])
    return { works, projects, opportunities, events, contacts, todos, press } satisfies TipData & { press: PressEntry[] }
  }, [deptId])

  const remember = (next: string[]) => {
    setHidden(next)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  if (!data) return <Shell><div /></Shell>
  const { works, projects, opportunities, events, todos, press } = data

  const books = works.filter(w => w.kind === 'Book').sort((a, b) => (b.publishedDate ?? String(b.year ?? '')).localeCompare(a.publishedDate ?? String(a.year ?? '')))
  const sold = works.flatMap(w => (w.rights ?? []).filter(r => r.status === 'sold'))
  const awards = press.filter(isAward).length
  const live = projects.filter(p => p.status !== 'Completed' && p.status !== 'Cancelled' && p.status !== 'One day')

  const stats = [
    { label: books.length ? 'Books' : 'Works', value: books.length || works.length },
    { label: 'Rights sold', value: sold.length },
    { label: 'Awards and lists', value: awards },
    { label: 'Press', value: press.length - awards },
  ]

  const bookRows = books.map(w => {
    const mine = press.filter(p => p.workId === w.id)
    const prizes = mine.filter(isAward).length
    return {
      key: w.id!, to: `/studio/${w.id}`,
      cells: [
        w.title,
        formatAnyDate(w.publishedDate) || String(w.year ?? ''),
        [prizes ? plural(prizes, 'award or list', 'awards and lists') : '', mine.length > prizes ? `${mine.length - prizes} press` : ''].filter(Boolean).join(', ') || 'None recorded',
        (w.rights ?? []).filter(r => r.status === 'sold').map(r => r.language).join(', ') || 'None recorded',
      ],
    }
  })

  const projectRows = live.map(p => {
    const open = todos.filter(t => t.projectId === p.id && !t.done).length
    const sent = opportunities.filter(o => o.projectIds?.includes(p.id!))
    return {
      key: p.id!, to: `/projects/${p.id}`,
      cells: [p.title, p.status ?? '', plural(open, 'open task'), sent.map(o => [o.organisation || o.title, o.status].join(': ')).join(', ') || 'Not linked to a submission'],
    }
  })

  const today = new Date().toLocaleDateString('en-CA')
  const thisMonth = today.slice(0, 7)
  const ahead = [
    ...opportunities.filter(o => o.deadline && o.deadline >= today && !FINISHED.includes(o.status)).map(o => ({ key: `o${o.id}`, date: o.deadline!, title: o.title, kind: 'Deadline', to: `/opportunities?o=${o.id}` })),
    ...events.filter(e => e.date && e.date >= (e.date.length <= 7 ? thisMonth : today)).map(e => ({ key: `e${e.id}`, date: e.date!, title: e.title, kind: e.type ?? 'Event', to: '/projects/events' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, COMING_UP)

  const tips = careerTips(data)
  const hiddenCount = tips.filter(t => hidden.includes(t.key)).length
  const shown = showHidden ? tips : tips.filter(t => !hidden.includes(t.key))

  return (
    <Shell>
      <CareerFrame active="report">
        <div style={{ padding: narrow ? '18px 16px 22px' : '22px 24px 26px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'repeat(2, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))', gap: 10, marginBottom: 30 }}>
            {stats.map(s => (
              <div key={s.label} style={{ background: 'var(--wa-fill-2)', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 32, lineHeight: 1.1, color: 'var(--wa-ink)', margin: '0 0 2px' }}>{s.value}</p>
                <p style={{ ...small, margin: 0 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {bookRows.length > 0 && <>
            <h2 style={heading}>Books</h2>
            <Table head={['Book', 'Published', 'Recognition', 'Rights sold']} rows={bookRows} widths="minmax(0, 1.5fr) minmax(0, .7fr) minmax(0, 1fr) minmax(0, 1fr)" narrow={narrow} />
          </>}

          {projectRows.length > 0 && <>
            <h2 style={heading}>Projects</h2>
            <Table head={['Project', 'Status', 'Tasks', 'Submissions']} rows={projectRows} widths="minmax(0, 1.5fr) minmax(0, .7fr) minmax(0, 1fr) minmax(0, 1fr)" narrow={narrow} />
          </>}

          <h2 style={heading}>Tips</h2>
          {shown.length === 0 && <p style={{ margin: '0 0 26px', fontSize: 12, color: 'var(--wa-muted)' }}>No tips right now.</p>}
          {TIP_GROUPS.map(group => {
            const rows = shown.filter(t => t.group === group)
            if (rows.length === 0) return null
            return (
              <section key={group} style={{ marginBottom: 16 }}>
                <p style={{ ...small, margin: '10px 0 2px' }}>{group}</p>
                {rows.map(t => {
                  const off = hidden.includes(t.key)
                  return (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '9px 0', borderBottom: '1px solid var(--wa-line)' }}>
                      <button onClick={() => navigate(t.to)} style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', fontSize: 13, lineHeight: 1.45, color: off ? 'var(--wa-muted)' : 'var(--wa-ink)', cursor: 'pointer', fontFamily: 'inherit', textWrap: 'pretty' }}>{t.text}</button>
                      <button onClick={() => remember(off ? hidden.filter(k => k !== t.key) : [...hidden, t.key])} style={quiet}>{off ? 'Show' : 'Hide'}</button>
                    </div>
                  )
                })}
              </section>
            )
          })}
          {hiddenCount > 0 && <button onClick={() => setShowHidden(v => !v)} style={{ ...quiet, marginBottom: 16 }}>{showHidden ? 'Leave hidden tips out' : `${hiddenCount} hidden`}</button>}

          {ahead.length > 0 && <>
            <h2 style={{ ...heading, marginTop: 16 }}>Coming up</h2>
            {ahead.map(a => (
              <button key={a.key} onClick={() => navigate(a.to)} style={{ display: 'flex', alignItems: 'baseline', gap: 14, width: '100%', padding: '9px 0', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
                <span style={{ flexShrink: 0, width: narrow ? 88 : 120, fontSize: 12, color: 'var(--wa-text-2)' }}>{formatAnyDate(a.date)}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--wa-ink)' }}>{a.title}</span>
                <span style={{ flexShrink: 0, fontSize: 11, color: 'var(--wa-muted)' }}>{a.kind}</span>
              </button>
            ))}
          </>}
        </div>
      </CareerFrame>
    </Shell>
  )
}
