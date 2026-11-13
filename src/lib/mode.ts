import { SUPABASE_REF } from './supabase'

// Which studio this tab shows, decided once when the page loads:
// an open demo (/demo/<field>), the signed-in person's own studio, or nothing (signed out).
// Signing in or out reloads the page, so this never changes while the app runs.

export const DEMO_FIELDS = ['musician', 'painter', 'illustrator', 'writer', 'fineart', 'filmmaker', 'photographer', 'illustrator-painter', 'photographer-musician'] as const
export type DemoField = typeof DEMO_FIELDS[number]

// How each demo is named in a sentence: "A sample fine art studio".
export const DEMO_NAME: Record<DemoField, string> = {
  musician: 'musician', painter: 'painter', illustrator: 'illustrator', writer: 'writer', fineart: 'fine art', filmmaker: 'filmmaker',
  photographer: 'photographer', 'illustrator-painter': 'illustrator and painter', 'photographer-musician': 'photographer and musician',
}
const DEMO_KEY = 'wa-demo'

const isField = (v: unknown): v is DemoField => DEMO_FIELDS.includes(v as DemoField)

function readDemo(): DemoField | null {
  const m = location.pathname.match(/^\/demo\/([a-z-]+)\/?$/)
  const fromPath = m && isField(m[1]) ? m[1] : null
  try {
    if (fromPath) sessionStorage.setItem(DEMO_KEY, fromPath)
    const stored = sessionStorage.getItem(DEMO_KEY)
    return fromPath ?? (isField(stored) ? stored : null)
  } catch {
    return fromPath
  }
}

const TOKEN_KEY = `sb-${SUPABASE_REF}-auth-token`
const ACCOUNT_KEY = 'wa-account'

type Account = { id: string; email?: string }
const readAccountFrom = (raw: string | null, pick: (v: { user?: Account } & Account) => Account | undefined) => {
  const account = raw ? pick(JSON.parse(raw) as { user?: Account } & Account) : undefined
  return typeof account?.id === 'string' ? account : null
}

// Who is signed in. Supabase's session says so first, and it is remembered here too: the studio lives in
// this browser and needs no server, so a session that lapses or fails to renew must not end it.
// Only Sign out does that.
function readAccount(): Account | null {
  try {
    const session = readAccountFrom(localStorage.getItem(TOKEN_KEY), v => v.user)
    if (session) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ id: session.id, email: session.email }))
      return session
    }
    return readAccountFrom(localStorage.getItem(ACCOUNT_KEY), v => v)
  } catch {
    return null
  }
}

export function forgetAccount() {
  try {
    localStorage.removeItem(ACCOUNT_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch { /* private mode */ }
}

export const demoField = readDemo()
const account = demoField ? null : readAccount()
export const userId = account?.id ?? null
export const accountEmail = account?.email ?? ''

// The browser database for this studio. Each account and each demo has its own,
// so they never mix on a shared computer.
export const studioDbName = demoField ? `WorkingArtistDemo-${demoField}`
  : userId ? `WorkingArtist-${userId}`
  : 'WorkingArtist-signed-out'

export function exitDemo() {
  try { sessionStorage.removeItem(DEMO_KEY) } catch { /* private mode */ }
  location.href = '/'
}
