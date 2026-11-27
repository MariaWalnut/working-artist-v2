import { useEffect } from 'react'
import type { WordmarkFont } from '../db/db'
import { WORDMARK_FONTS } from '../lib/invoice'

const ALL_FONTS = `https://fonts.googleapis.com/css2?${WORDMARK_FONTS.map(f => `family=${f.css}`).join('&')}&display=swap`

// Loads the four faces once, so the choices show in their own letters.
function useWordmarkFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-wordmark-fonts]')) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = ALL_FONTS
    link.dataset.wordmarkFonts = ''
    document.head.appendChild(link)
  }, [])
}

// The name that stands in for a logo, and the face it's set in.
export function WordmarkPicker({ name, font, placeholder, onName, onFont }: {
  name: string
  font?: WordmarkFont
  placeholder: string
  onName: (v: string) => void
  onFont: (f: WordmarkFont) => void
}) {
  useWordmarkFonts()
  const shown = name.trim() || placeholder
  const current = font ?? WORDMARK_FONTS[0].key
  return (
    <div>
      <input value={name} onChange={e => onName(e.target.value)} placeholder={placeholder} aria-label="Name in place of a logo"
        style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '8px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit', marginBottom: 8 }} />
      <div role="radiogroup" aria-label="Font" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
        {WORDMARK_FONTS.map(f => {
          const on = current === f.key
          return (
            <button key={f.key} role="radio" aria-checked={on} onClick={() => onFont(f.key)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, minWidth: 0, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                background: '#ffffff', border: 'none', boxShadow: on ? '0 0 0 3px var(--accent)' : 'inset 0 0 0 1px var(--wa-line)' }}>
              <span style={{ fontFamily: f.family, fontWeight: f.weight, fontSize: Math.round(f.size * 0.7), color: '#231F20', lineHeight: 1.2, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shown}</span>
              <span style={{ fontFamily: 'var(--font-sans)', fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#595959' }}>{f.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
