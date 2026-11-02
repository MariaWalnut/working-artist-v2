// Supabase Edge Function: someone joins the waiting list on the welcome page.
//
// Saves them in `invite_requests`, then (when RESEND_API_KEY is set) emails
// Maria about it and sends the person a short confirmation. Without the key it only saves,
// so the form keeps working before email is set up.
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY     required for email
//   INVITE_FROM        optional, default "Working Artist <hello@workingartist.app>" (domain must be verified in Resend)
//   INVITE_NOTIFY_TO   optional, where new requests are announced
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const DISCIPLINES = ['Music', 'Painting', 'Fine art', 'Illustration', 'Writing', 'Film', 'Other']
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

async function send(key: string, mail: { from: string; to: string; subject: string; text: string; html: string; reply_to?: string }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail),
  })
  if (!r.ok) console.error('resend', r.status, await r.text())
  return r.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const email = String(body.email ?? '').trim()
    const discipline = String(body.discipline ?? '')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) return json({ error: 'Please enter your email address.' }, 400)
    if (!DISCIPLINES.includes(discipline)) return json({ error: 'Please choose what you make.' }, 400)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error } = await admin.from('invite_requests').insert({ email, discipline })
    if (error?.code === '23505') return json({ status: 'already' })
    if (error) return json({ error: 'Something went wrong. Please try again.' }, 500)

    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) return json({ status: 'saved', mailed: false })

    const from = Deno.env.get('INVITE_FROM') ?? 'Working Artist <hello@workingartist.app>'
    const notifyTo = Deno.env.get('INVITE_NOTIFY_TO') ?? 'maria@studiomariawalnut.com'
    const { count } = await admin.from('invite_requests').select('id', { count: 'exact', head: true })

    const notified = await send(key, {
      from, to: notifyTo, reply_to: email,
      subject: `Waiting list: ${discipline}`,
      text: `${email} joined the Working Artist waiting list.\nWhat they make: ${discipline}\n\nOn the list so far: ${count ?? '?'}`,
      html: `<p><strong>${esc(email)}</strong> joined the Working Artist waiting list.</p><p>What they make: ${esc(discipline)}</p><p style="color:#666">On the list so far: ${count ?? '?'}</p>`,
    })

    // A burst of sign-ups is more likely abuse than artists: hold the confirmation mails then.
    const since = new Date(Date.now() - 3600e3).toISOString()
    const { count: lastHour } = await admin.from('invite_requests').select('id', { count: 'exact', head: true }).gte('created_at', since)
    const thanked = (lastHour ?? 0) <= 20 && await send(key, {
      from, to: email,
      subject: 'You’re on the Working Artist waiting list',
      text: `Thank you for joining the Working Artist waiting list.\n\nWorking Artist is still being made, together with a small group of artists. We’ll let you know when it opens.\n\nIn the meantime you can try the sample studios: https://www.workingartist.app/welcome#demos\n\nWorking Artist, a Studio Nozes project`,
      html: `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.6;color:#111"><p>Thank you for joining the Working Artist waiting list.</p><p>Working Artist is still being made, together with a small group of artists. We’ll let you know when it opens.</p><p>In the meantime you can try the <a href="https://www.workingartist.app/welcome#demos" style="color:#111">sample studios</a>.</p><p style="color:#555">Working Artist, a Studio Nozes project</p></div>`,
    })

    return json({ status: 'saved', mailed: notified, thanked })
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
