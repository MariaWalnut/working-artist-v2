import { useState } from 'react'
import { db, type Department } from '../db/db'
import { ACCENTS, DEFAULT_ACCENT, isHex, readableAccent } from '../lib/accent'

const RING = '0 0 0 3px #FFFFFF, 0 0 0 5px #111111'
const EDGE = 'inset 0 0 0 1px rgba(0,0,0,0.08)'
const RAINBOW = 'conic-gradient(#FF4D4D, #FFB000, #F5E642, #5BD86A, #3FC7F0, #5B6CFF, #C25BFF, #FF4D9A, #FF4D4D)'

const option: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 64, padding: '8px 4px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, color: '#111111' }

export function AccentPicker({ dept }: { dept?: Department }) {
  const current = isHex(dept?.accent) ? dept!.accent! : DEFAULT_ACCENT
  const preset = ACCENTS.find(a => a.hex.toLowerCase() === current.toLowerCase())
  const [tooDark, setTooDark] = useState(false)

  async function choose(hex: string) {
    if (!dept?.id) return
    if (!readableAccent(hex)) { setTooDark(true); return }
    setTooDark(false)
    await db.departments.update(dept.id, { accent: hex })
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#6E6E6E', lineHeight: 1.5, margin: '0 0 16px' }}>
        Used across all of Working Artist: the menu, buttons, highlights and the cards you colour.
      </p>
      <div role="radiogroup" aria-label="Accent colour" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {ACCENTS.map(a => {
          const on = preset?.key === a.key
          return (
            <button key={a.key} type="button" role="radio" aria-checked={on} onClick={() => void choose(a.hex)} style={option}>
              <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 999, background: a.hex, boxShadow: on ? RING : EDGE }} />
              {a.name}
            </button>
          )
        })}
        <label style={{ ...option, cursor: 'pointer' }}>
          <span style={{ position: 'relative', width: 44, height: 44, borderRadius: 999, background: RAINBOW, boxShadow: preset ? EDGE : RING, overflow: 'hidden' }}>
            {!preset && <span aria-hidden="true" style={{ position: 'absolute', inset: 9, borderRadius: 999, background: current, boxShadow: '0 0 0 2px #FFFFFF' }} />}
            <input type="color" value={current} aria-label="Custom accent colour"
              onChange={e => void choose(e.target.value)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none', padding: 0 }} />
          </span>
          Custom
        </label>
      </div>
      {tooDark && <p role="alert" style={{ fontSize: 12, color: '#A86400', margin: '12px 0 0' }}>Pick a lighter colour, so text on it stays readable.</p>}
    </div>
  )
}
