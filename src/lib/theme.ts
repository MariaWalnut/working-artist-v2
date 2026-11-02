import { useSyncExternalStore } from 'react'

// Light, dark or follow the device. Kept per device, like the toolbar state, not per studio.
export type ThemePref = 'light' | 'dark' | 'system'

const KEY = 'wa-theme'
const dark = window.matchMedia('(prefers-color-scheme: dark)')
const listeners = new Set<() => void>()

function read(): ThemePref {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system' } catch { return 'system' }
}

let pref = read()

function apply() {
  const resolved = pref === 'system' ? (dark.matches ? 'dark' : 'light') : pref
  document.documentElement.dataset.theme = resolved
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#121212' : '#F5F5F5')
}

export function setTheme(next: ThemePref) {
  pref = next
  try { if (next === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, next) } catch { /* private mode */ }
  apply()
  listeners.forEach(l => l())
}

export const useTheme = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => pref)

apply()
dark.addEventListener('change', () => { if (pref === 'system') apply() })
