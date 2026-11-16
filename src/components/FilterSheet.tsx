import type { ReactNode } from 'react'

// On a phone a page's filters sit behind one button and open as a sheet from the bottom.

export function FilterButton({ count, summary, onClick }: { count: number; summary?: string; onClick: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
      <button onClick={onClick} aria-haspopup="dialog"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0, padding: '9px 14px', borderRadius: 999, border: 'none', background: 'var(--wa-surface)', color: 'var(--wa-ink)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true"><path d="M1 1h12M3.5 5h7M6 9h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
        Filter{count > 0 && <span style={{ fontSize: 10, color: 'var(--wa-muted)' }}>{count}</span>}
      </button>
      {count > 0 && summary && (
        <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, color: 'var(--wa-text-2)' }}>{summary}</span>
      )}
    </div>
  )
}

export function FilterSheet({ label, onClose, onClear, children }: { label: string; onClose: () => void; onClear?: () => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={label} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,17,17,.45)', display: 'flex', alignItems: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxHeight: '85vh', overflowY: 'auto', background: 'var(--wa-page)', borderRadius: '20px 20px 0 0', padding: '20px 16px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 4px' }}>
          <span style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: 'var(--wa-ink)' }}>Filter</span>
          <button onClick={onClose} style={{ padding: '9px 18px', borderRadius: 999, border: 'none', background: 'var(--wa-ink)', color: 'var(--wa-page)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Done</button>
        </div>
        {children}
        {onClear && (
          <button onClick={onClear} style={{ alignSelf: 'flex-start', padding: '8px 4px', border: 'none', background: 'none', fontSize: 12, color: 'var(--wa-text-2)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Clear filters</button>
        )}
      </div>
    </div>
  )
}

export function SheetGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: '14px 10px 10px' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', padding: '0 10px 6px', margin: 0 }}>{title}</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>{children}</div>
    </div>
  )
}
