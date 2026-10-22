import type { ReactNode } from 'react'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const fieldLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#767676', margin: '0 0 6px' }

function daysIn(y: string, m: string) { return new Date(Number(y), Number(m), 0).getDate() }

// Year is required for a date; month and day are optional and narrow it down.
export function DateFields({ label, value, onChange, inp, action, showDay = true }: {
  label: string
  value: string
  onChange: (v: string) => void
  inp: React.CSSProperties
  action?: ReactNode
  showDay?: boolean
}) {
  const [y, m, d] = value ? value.split('-') : []
  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: thisYear + 4 - 1950 }, (_, i) => thisYear + 3 - i)
  const dayCount = y && m ? daysIn(y, m) : 31

  function set(ny?: string, nm?: string, nd?: string) {
    if (!ny) return onChange('')
    if (!nm) return onChange(ny)
    if (nd && Number(nd) > daysIn(ny, nm)) nd = undefined
    onChange(nd ? `${ny}-${nm}-${nd}` : `${ny}-${nm}`)
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <p style={fieldLabel}>{label}</p>
        {action}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {showDay && (
          <select aria-label={`${label} day`} value={d ?? ''} disabled={!m} onChange={e => set(y, m, e.target.value || undefined)}
            style={{ ...inp, flex: 0.8, color: d ? '#111111' : '#6E6E6E', opacity: m ? 1 : 0.6 }}>
            <option value="">Day…</option>
            {Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, '0')).map(v => <option key={v} value={v}>{Number(v)}</option>)}
          </select>
        )}
        <select aria-label={`${label} month`} value={m ?? ''} onChange={e => set(y || String(thisYear), e.target.value || undefined, d)}
          style={{ ...inp, flex: 1.2, color: m ? '#111111' : '#6E6E6E' }}>
          <option value="">Month…</option>
          {MONTHS.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
        </select>
        <select aria-label={`${label} year`} value={y ?? ''} onChange={e => set(e.target.value || undefined, m, d)}
          style={{ ...inp, flex: 1, color: y ? '#111111' : '#6E6E6E' }}>
          <option value="">Year…</option>
          {years.map(v => <option key={v} value={String(v)}>{v}</option>)}
        </select>
      </div>
    </div>
  )
}

