import { useEffect, useRef, useState } from 'react'
import type { Activity } from '../db/db'
import { setLens, setPicked, usePractice } from '../lib/practice'

// The practice in the top left, after the studio name. In Separate mode it opens the other practices.
export function PracticeName() {
  const { acts, multi, mode, current, name } = usePractice()
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
  if (mode !== 'separate') return <span style={{ ...italic, marginLeft: '0.3em' }}>{name(shown)}</span>

  return (
    <span ref={ref} style={{ position: 'relative', marginLeft: '0.3em' }}>
      <button onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open} aria-label={`${name(shown)}, switch practice`}
        style={{ ...italic, background: 'none', border: 'none', padding: 0, cursor: 'pointer', borderBottom: '1px solid var(--wa-line-strong)' }}>
        {name(shown)}
      </button>
      {open && (
        <span role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: -12, zIndex: 70, minWidth: 180, display: 'flex', flexDirection: 'column', padding: 6, borderRadius: 14, background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', boxShadow: '0 10px 30px rgba(0,0,0,.12)' }}>
          {acts.map(a => (
            <button key={a} role="menuitemradio" aria-checked={a === shown} onClick={() => { setPicked(a); setOpen(false) }}
              style={{ ...italic, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 40, padding: '0 10px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: a === shown ? 'var(--wa-fill)' : 'none', color: a === shown ? 'var(--wa-ink)' : 'var(--wa-text-2)' }}>
              {name(a)}
              {a === shown && <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' }} />}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

// Together mode: a filter in the left column of a page that has one. Pages without a left column show everything.
// `plain` leaves out the card, for a column that is already one panel.
export function PracticeFilter({ narrow, plain = false }: { narrow: boolean; plain?: boolean }) {
  const { acts, multi, mode, current, name } = usePractice({ filter: true })
  if (!multi || mode !== 'together') return null
  const item = (label: string, value: Activity | null) => {
    const on = current === value
    return (
      <button key={label} role="radio" aria-checked={on} onClick={() => setLens(value)}
        style={{ display: 'block', flexShrink: 0, width: narrow ? 'auto' : '100%', padding: plain && !narrow ? '4px 8px' : '8px 10px', borderRadius: 8, border: 'none', background: on ? 'var(--wa-fill)' : 'none', color: on ? 'var(--wa-ink)' : 'var(--wa-text)', fontSize: plain ? 11 : 12, fontWeight: on ? 600 : 400, textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }}>
        {label}
      </button>
    )
  }
  return (
    <div role="radiogroup" aria-label="Practice" style={plain ? undefined : { background: 'var(--wa-surface)', borderRadius: 20, padding: narrow ? 10 : '18px 16px' }}>
      {!narrow && <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: plain ? '0.14em' : '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: plain ? '0 0 6px' : 0, padding: plain ? 0 : '0 8px 8px' }}>Practice</p>}
      <div style={narrow ? { display: 'flex', gap: 2, overflowX: 'auto' } : { display: 'flex', flexDirection: 'column', gap: 2 }}>
        {item('All', null)}
        {acts.map(a => item(name(a), a))}
      </div>
    </div>
  )
}

// For things that can belong to several practices at once. One always stays chosen. Only with several practices.
export function PracticePicker({ value, onChange, style }: { value: Activity[]; onChange: (a: Activity[]) => void; style?: React.CSSProperties }) {
  const { acts, multi, name } = usePractice()
  if (!multi) return null
  return (
    <div role="group" aria-label="Practices" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, ...style }}>
      {acts.map(a => {
        const on = value.includes(a)
        return (
          <button key={a} type="button" aria-pressed={on} onClick={() => { if (!on) onChange([...value, a]); else if (value.length > 1) onChange(value.filter(x => x !== a)) }}
            style={{ padding: '4px 11px', borderRadius: 999, border: on ? '1px solid transparent' : '1px solid var(--wa-line)', background: on ? 'var(--accent)' : 'transparent', color: on ? '#111111' : 'var(--wa-text)', fontSize: 12, fontWeight: on ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit' }}>
            {name(a)}
          </button>
        )
      })}
    </div>
  )
}

// The practice a work, project, event, submission or press item belongs to. Only with several practices.
export function PracticeSelect({ value, onChange, style, labelled }: { value: Activity; onChange: (a: Activity) => void; style?: React.CSSProperties; labelled?: boolean }) {
  const { acts, multi, name } = usePractice()
  if (!multi) return null
  const select = (
    <select aria-label="Practice" value={value} onChange={e => onChange(e.target.value as Activity)} style={style}>
      {acts.map(a => <option key={a} value={a}>{name(a)}</option>)}
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
