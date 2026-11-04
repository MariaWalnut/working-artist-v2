import type { ReactNode } from 'react'

// The parts every list page shares, so they look alike and + Add is always in the same place:
// filters in a left column, one white frame, title on its left and + Add at its top right.

export const pageGrid = (narrow: boolean): React.CSSProperties => ({ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : '220px minmax(0, 1fr)', gap: 10, alignItems: 'start' })
export const pageFrame: React.CSSProperties = { background: 'var(--wa-surface)', borderRadius: 20, overflow: 'hidden', minWidth: 0 }

export function AddButton({ onClick, label = '+ Add' }: { onClick: () => void; label?: string }) {
  return <button onClick={onClick} style={{ flexShrink: 0, background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 11, fontWeight: 600, color: '#111111', cursor: 'pointer', fontFamily: 'inherit' }}>{label}</button>
}

export function FrameTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, minWidth: 0 }}>
      <span style={{ fontFamily: 'Recoleta, serif', fontSize: 18, color: 'var(--wa-ink)' }}>{children}</span>
      {count != null && <span style={{ fontSize: 11, color: 'var(--wa-muted)' }}>{count}</span>}
    </span>
  )
}

// A card of filters. On a phone it becomes a row that scrolls sideways.
export function SidePanel({ title, narrow, children }: { title: string; narrow: boolean; children: ReactNode }) {
  if (narrow) return <div role="group" aria-label={title} style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: 10, display: 'flex', gap: 2, overflowX: 'auto' }}>{children}</div>
  return (
    <div role="group" aria-label={title} style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', padding: '0 8px 8px', margin: 0 }}>{title}</p>
      {children}
    </div>
  )
}

export function SideItem({ label, count, dot, active, narrow, onClick }: { label: string; count?: number; dot?: string; active: boolean; narrow: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, width: narrow ? 'auto' : '100%', padding: '8px 10px', borderRadius: 8, border: 'none', background: active ? 'var(--wa-fill)' : 'none', color: active ? 'var(--wa-ink)' : 'var(--wa-text)', fontSize: 12, fontWeight: active ? 600 : 400, textAlign: 'left', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: dot }} />}
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {count != null && <span style={{ marginLeft: 'auto', paddingLeft: 6, fontSize: 10, color: 'var(--wa-muted)', fontWeight: 400 }}>{count}</span>}
    </button>
  )
}
