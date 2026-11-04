import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'
import { CareerFrame } from '../components/CareerTabs'
import { careerTips, TIP_GROUPS } from '../lib/tips'

const HIDDEN_KEY = 'wa-tips-hidden'

function readHidden(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[] } catch { return [] }
}

const quiet: React.CSSProperties = { flexShrink: 0, padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }

export function Tips() {
  const dept = useActiveDept()
  const deptId = dept?.id
  const navigate = useNavigate()
  const [hidden, setHidden] = useState(readHidden)
  const [showHidden, setShowHidden] = useState(false)
  const data = useLiveQuery(async () => {
    if (deptId == null) return null
    const of = <T,>(table: { where(i: string): { equals(v: number): { toArray(): Promise<T[]> } } }) => table.where('departmentId').equals(deptId).toArray()
    const [works, projects, opportunities, events, contacts, todos] = await Promise.all([
      of(db.works), of(db.projects), of(db.opportunities), of(db.eventEntries), of(db.contacts), of(db.todos),
    ])
    return { works, projects, opportunities, events, contacts, todos } as Parameters<typeof careerTips>[0]
  }, [deptId])

  const remember = (next: string[]) => {
    setHidden(next)
    try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(next)) } catch { /* private mode */ }
  }

  const tips = data ? careerTips(data) : []
  const hiddenCount = tips.filter(t => hidden.includes(t.key)).length
  const shown = showHidden ? tips : tips.filter(t => !hidden.includes(t.key))

  return (
    <Shell>
      <CareerFrame active="tips">
        <div style={{ padding: '6px 24px 22px' }}>
          {data && shown.length === 0 && <p style={{ textAlign: 'center', padding: '48px 0', margin: 0, fontSize: 11, color: 'var(--wa-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>No tips right now</p>}
          {TIP_GROUPS.map(group => {
            const rows = shown.filter(t => t.group === group)
            if (rows.length === 0) return null
            return (
              <section key={group} style={{ marginTop: 18 }}>
                <h2 style={{ margin: '0 0 4px', fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 18, color: 'var(--wa-ink)' }}>{group}</h2>
                {rows.map(t => {
                  const off = hidden.includes(t.key)
                  return (
                    <div key={t.key} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--wa-line)' }}>
                      <button onClick={() => navigate(t.to)} style={{ flex: 1, minWidth: 0, padding: 0, border: 'none', background: 'none', textAlign: 'left', fontSize: 13, lineHeight: 1.45, color: off ? 'var(--wa-muted)' : 'var(--wa-ink)', cursor: 'pointer', fontFamily: 'inherit', textWrap: 'pretty' }}>{t.text}</button>
                      <button onClick={() => remember(off ? hidden.filter(k => k !== t.key) : [...hidden, t.key])} style={quiet}>{off ? 'Show' : 'Hide'}</button>
                    </div>
                  )
                })}
              </section>
            )
          })}
          {hiddenCount > 0 && <button onClick={() => setShowHidden(v => !v)} style={{ ...quiet, marginTop: 16 }}>{showHidden ? 'Leave hidden tips out' : `${hiddenCount} hidden`}</button>}
        </div>
      </CareerFrame>
    </Shell>
  )
}
