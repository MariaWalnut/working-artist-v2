import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../db/db'
import { PRACTICE_NAME, setLens, setPicked, usePractice } from '../lib/practice'

// The practice in the top left, after the studio name. In Separate mode it opens the other practices.
export function PracticeName() {
  const { acts, multi, mode, current } = usePractice()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  const shown = multi ? (mode === 'separate' ? current : null) : acts[0] !== 'other' ? acts[0] : null
  if (!shown) return null
  const italic: React.CSSProperties = { fontFamily: 'Recoleta, serif', fontStyle: 'italic', fontWeight: 400, fontSize: 18, color: 'var(--wa-ink)' }
  if (mode !== 'separate') return <span style={{ ...italic, marginLeft: '0.3em' }}>{PRACTICE_NAME[shown]}</span>

  return (
    <span ref={ref} style={{ position: 'relative', marginLeft: '0.3em' }}>
      <button onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`${PRACTICE_NAME[shown]}, switch practice`}
        style={{ ...italic, background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderBottom: '1px solid var(--wa-line-strong)' }}>
        {PRACTICE_NAME[shown]}
      </button>
      {open && (
        <span role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: -12, zIndex: 70, minWidth: 180, display: 'flex', flexDirection: 'column', padding: 6, borderRadius: 14, background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', boxShadow: '0 10px 30px rgba(0,0,0,.12)' }}>
          {acts.map(a => (
            <button key={a} role="menuitemradio" aria-checked={a === shown} onClick={() => { setPicked(a); setOpen(false) }}
              style={{ ...italic, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 40, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: a === shown ? 'var(--wa-fill)' : 'none', color: a === shown ? 'var(--wa-ink)' : 'var(--wa-text-2)' }}>
              {PRACTICE_NAME[a]}
              {a === shown && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

// Together mode: look at one practice at a time on Works, Events and Career.
export function PracticeFilter() {
  const { acts, current } = usePractice({ filter: true })
  const chip = (label: string, on: boolean, value: Activity | null) => (
    <button key={label} role="radio" aria-checked={on} onClick={() => setLens(value)}
      style={{ minHeight: 32, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, whiteSpace: 'nowrap', fontWeight: on ? 600 : 400,
        background: on ? 'var(--wa-surface)' : 'transparent', color: on ? 'var(--wa-ink)' : 'var(--wa-text-2)', boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>
      {label}
    </button>
  )
  return (
    <div role="radiogroup" aria-label="Practice" style={{ display: 'flex', maxWidth: '100%', overflowX: 'auto', marginBottom: 16 }}>
      <div style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'var(--wa-fill)' }}>
        {chip('All', current == null, null)}
        {acts.map(a => chip(PRACTICE_NAME[a], current === a, a))}
      </div>
    </div>
  )
}

// The practice a work, project, event, submission or press item belongs to. Only with several practices.
export function PracticeSelect({ value, onChange, style, labelled }: { value: Activity; onChange: (a: Activity) => void; style?: React.CSSProperties; labelled?: boolean }) {
  const { acts, multi } = usePractice()
  if (!multi) return null
  const select = (
    <select aria-label="Practice" value={value} onChange={e => onChange(e.target.value as Activity)} style={style}>
      {acts.map(a => <option key={a} value={a}>{PRACTICE_NAME[a]}</option>)}
    </select>
  )
  if (!labelled) return select
  return (
    <label>
      <span style={{ fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>Practice</span>
      {select}
    </label>
  )
}
