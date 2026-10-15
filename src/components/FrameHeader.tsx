import type { ReactNode } from 'react'

// The header row inside a white frame, as on Events and Works: a Recoleta title (or titles as tabs) on the left,
// actions on the right.
export function FrameHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '14px 20px 12px', borderBottom: '1px solid #F0F0F0' }}>
      {children}
      {right && <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>{right}</div>}
    </div>
  )
}

export function FrameTabs<K extends string | number>({ tabs, active, onSelect, label }: {
  tabs: Array<{ key: K; label: string; count?: number }>
  active?: K
  onSelect: (key: K) => void
  label: string
}) {
  return (
    <div role="tablist" aria-label={label} style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 14, rowGap: 4 }}>
      {tabs.map(t => (
        <button key={t.key} role="tab" aria-selected={active === t.key} onClick={() => onSelect(t.key)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'Recoleta, serif', fontSize: 16, color: active === t.key ? '#111111' : '#C8C8C8' }}>
          {t.label}
          {t.count != null && <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: '#CCCCCC', fontWeight: 500, marginLeft: 6 }}>{t.count}</span>}
        </button>
      ))}
    </div>
  )
}
