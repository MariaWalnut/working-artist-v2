import { useEffect, useRef, useState } from 'react'

export interface PickItem { id: number; label: string; sub?: string }

// A small search panel that opens under an + Add button: type, pick a match, or create a new one.
// Sits inside a position: relative wrapper. Closes on Escape or a click outside.
export function PickPopover({ items, placeholder, newLabel, onPick, onCreate, onClose, limit, inline = false }: {
  items: PickItem[]
  placeholder: string
  newLabel?: (text: string) => string
  onPick: (id: number) => void
  onCreate?: (text: string) => void
  onClose: () => void
  limit?: number
  inline?: boolean // sits in the page instead of floating over it
}) {
  const [q, setQ] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const text = q.trim()
  const plain = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  const needle = plain(text)
  const matches = items.filter(i => !needle || plain(`${i.label} ${i.sub ?? ''}`).includes(needle)).slice(0, limit)
  const canCreate = !!onCreate && !!text && !items.some(i => plain(i.label) === needle)

  useEffect(() => {
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) onClose() }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [onClose])

  function enter() {
    if (matches[0]) onPick(matches[0].id)
    else if (canCreate) onCreate!(text)
  }

  const row: React.CSSProperties = { display: 'block', width: '100%', padding: '8px 10px', border: 'none', borderRadius: 8, background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div ref={box} style={{ ...(inline ? { width: '100%' } : { position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 30, width: 'min(300px, calc(100vw - 72px))', boxShadow: '0 12px 36px rgba(0,0,0,.14)' }), background: 'var(--wa-surface)', border: '1px solid var(--wa-line)', borderRadius: 12, padding: 8, boxSizing: 'border-box' }}>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        onKeyDown={e => {
          if (e.key === 'Escape') { e.stopPropagation(); onClose() }
          if (e.key === 'Enter') { e.preventDefault(); enter() }
        }}
        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: 'none', background: 'var(--wa-fill)', padding: '8px 10px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit', marginBottom: 4 }} />
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {matches.map(i => (
          <button key={i.id} type="button" onClick={() => onPick(i.id)} style={row}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--wa-ink)' }}>{i.label}</span>
            {i.sub && <span style={{ display: 'block', fontSize: 11, color: 'var(--wa-muted)', marginTop: 1 }}>{i.sub}</span>}
          </button>
        ))}
        {canCreate && <button type="button" onClick={() => onCreate!(text)} style={{ ...row, fontSize: 13, color: 'var(--wa-ink)' }}>{newLabel?.(text)}</button>}
        {matches.length === 0 && !canCreate && <p style={{ margin: 0, padding: '8px 10px', fontSize: 12, color: 'var(--wa-muted)' }}>Nothing to add</p>}
      </div>
    </div>
  )
}
