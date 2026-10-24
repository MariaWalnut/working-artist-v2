import { useState, type ReactNode } from 'react'

// A one-line hint shown where something becomes relevant; dismissing it hides it for good.
export function Hint({ id, children, style }: { id: string; children: ReactNode; style?: React.CSSProperties }) {
  const key = `wa-hint-${id}`
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === '1' } catch { return false } })
  if (hidden) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 12, background: '#F5F5F5', fontSize: 12, lineHeight: 1.5, color: '#333333', ...style }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, marginTop: 6, flexShrink: 0, borderRadius: 999, background: 'var(--accent)', boxShadow: '0 0 0 1px rgba(0,0,0,.15)' }} />
      <span style={{ flex: 1 }}>{children}</span>
      <button aria-label="Dismiss hint" onClick={() => { setHidden(true); try { localStorage.setItem(key, '1') } catch { /* private mode */ } }}
        style={{ flexShrink: 0, width: 22, height: 22, marginTop: -1, border: 'none', borderRadius: 999, background: 'none', color: '#6E6E6E', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
    </div>
  )
}
