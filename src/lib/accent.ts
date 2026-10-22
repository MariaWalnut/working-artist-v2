// The studio's accent colour: used across the app for highlights, buttons and accent cards.

export const ACCENTS = [
  { key: 'sun', name: 'Sun', hex: '#F5E642' },
  { key: 'earth', name: 'Earth', hex: '#E6C29A' },
  { key: 'moon', name: 'Moon', hex: '#A8CAFF' },
] as const

export const DEFAULT_ACCENT = ACCENTS[0].hex

export const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)

// Relative luminance, 0 (black) to 1 (white).
export function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const lin = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

// Text on the accent is always near-black, so the accent must stay light enough to read it.
export const readableAccent = (hex: string) => luminance(hex) >= 0.4

export function applyAccent(hex?: string) {
  document.documentElement.style.setProperty('--accent', isHex(hex) && readableAccent(hex) ? hex : DEFAULT_ACCENT)
}
