import { setTheme, useTheme, type ThemePref } from '../lib/theme'

const OPTIONS: Array<{ value: ThemePref; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function ThemePicker() {
  const theme = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
      <span style={{ fontSize: 13, color: 'var(--wa-text)' }}>Mode</span>
      <div role="radiogroup" aria-label="Mode" style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'var(--wa-fill)' }}>
        {OPTIONS.map(o => {
          const on = theme === o.value
          return (
            <button key={o.value} role="radio" aria-checked={on} onClick={() => setTheme(o.value)}
              style={{ minHeight: 32, padding: '0 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 600 : 400,
                background: on ? 'var(--wa-surface)' : 'transparent', color: on ? 'var(--wa-ink)' : 'var(--wa-text-2)', boxShadow: on ? '0 1px 3px rgba(0,0,0,.12)' : 'none' }}>
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
