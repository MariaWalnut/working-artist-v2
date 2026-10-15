import { SUPABASE_REF } from './supabase'

// Which studio this tab shows, decided once when the page loads:
// an open demo (/demo/<field>), the signed-in person's own studio, or nothing (signed out).
// Signing in or out reloads the page, so this never changes while the app runs.

export const DEMO_FIELDS = ['musician', 'painter', 'illustrator', 'writer'] as const
export type DemoField = typeof DEMO_FIELDS[number]
const DEMO_KEY = 'wa-demo'

const isField = (v: unknown): v is DemoField => DEMO_FIELDS.includes(v as DemoField)

function readDemo(): DemoField | null {
  const m = location.pathname.match(/^\/demo\/([a-z]+)\/?$/)
  const fromPath = m && isField(m[1]) ? m[1] : null
  try {
    if (fromPath) sessionStorage.setItem(DEMO_KEY, fromPath)
    const stored = sessionStorage.getItem(DEMO_KEY)
    return fromPath ?? (isField(stored) ? stored : null)
  } catch {
    return fromPath
  }
}

// The signed-in user's id, read from the session Supabase keeps in localStorage.
function readUserId(): string | null {
  try {
    const raw = localStorage.getItem(`sb-${SUPABASE_REF}-auth-token`)
    const id = raw ? (JSON.parse(raw) as { user?: { id?: unknown } }).user?.id : null
    return typeof id === 'string' ? id : null
  } catch {
    return null
  }
}

export const demoField = readDemo()
export const userId = demoField ? null : readUserId()

// The browser database for this studio. Each account and each demo has its own,
// so they never mix on a shared computer.
export const studioDbName = demoField ? `WorkingArtistDemo-${demoField}`
  : userId ? `WorkingArtist-${userId}`
  : 'WorkingArtist-signed-out'

// The studio saved in this browser before accounts existed.
export const LEGACY_DB = 'WorkingArtistV2'

export function exitDemo() {
  try { sessionStorage.removeItem(DEMO_KEY) } catch { /* private mode */ }
  location.href = '/'
}
