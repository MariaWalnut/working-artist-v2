import { createClient } from '@supabase/supabase-js'

// Accounts live in the same Supabase project as v1 (separate storage, see lib/cloud.ts).
// The publishable key is the public browser key; data is protected by storage policies.
export const SUPABASE_REF = 'ibururqeyzgvddbtrgad'
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? `https://${SUPABASE_REF}.supabase.co`
const key = (import.meta.env.VITE_SUPABASE_KEY as string | undefined) ?? 'sb_publishable_uIEfLevKCGUUi5eQKJAseA_jmgMl3GN'

// Invite and password-reset emails land back here with a `type` in the address.
// Read it before the client consumes and clears the hash.
function readAuthLinkType(): string | null {
  try {
    return new URLSearchParams(location.hash.replace(/^#/, '')).get('type') ?? new URLSearchParams(location.search).get('type')
  } catch {
    return null
  }
}
export const authLinkType = readAuthLinkType()
export const needsPassword = authLinkType === 'invite' || authLinkType === 'recovery'

export const supabase = createClient(url, key)
