import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EventEntry, type PressEntry, type Work } from '../db/db'
import { demoField, type DemoField } from '../lib/mode'
import { useNarrow } from '../lib/useNarrow'

// The demo tour (started from the ? button) follows one work through the app, to show how entering something once
// makes it appear everywhere it matters. The last two steps are done, not read.
// Elements opt in with data-tour="…" or data-tour-title="<their title>".

interface Step {
  path: string
  target: string // CSS selector
  title: string
  text: string
  doneWhen?: { route?: RegExp; event?: string } // a hands-on step: moves on by itself when done
  doLabel?: string
}

// The work each demo's tour follows.
const THREAD: Record<DemoField, string> = {
  musician: 'Low Tide',
  painter: 'Salt Flats I',
  illustrator: 'The Fox Who Kept the Moon',
  writer: 'The Summer House',
}

const byTitle = (t: string) => `[data-tour-title="${t.replace(/"/g, '\\"')}"]`

// On a narrow screen the desk is a fixed list, so the last step shows instead of asking for a drag.
function buildSteps(w: Work, e: EventEntry | undefined, p: PressEntry | undefined, deskFixed: boolean): Step[] {
  const steps: Array<Step | null> = [
    { path: '/studio', target: byTitle(w.title), title: 'Start with a work', text: `Everything in Working Artist connects back to your works. Open ${w.title}.`, doneWhen: { route: /^\/studio\/\d+$/ }, doLabel: 'Click it' },
    e ? { path: `/studio/${w.id}`, target: '[data-tour="work-shown"]', title: 'Where it has been', text: `${w.title} was shown at ${e.title}. Link a work and an event once, and both show up everywhere else.` } : null,
    e ? { path: '/projects/events', target: byTitle(e.title), title: 'The event knows too', text: `${e.title} lists ${w.title} among the works shown, so nothing is entered twice.` } : null,
    { path: '/career', target: byTitle(e?.title ?? w.title), title: 'On your timeline', text: e ? `${e.title} and ${w.title} take their place on your timeline by date. Nothing to arrange.` : `${w.title} takes its place on your timeline by date.` },
    e?.location ? { path: '/career/map', target: byTitle(e.location), title: 'And on the map', text: `${e.location} is on your map because ${e.title} happened there.` } : null,
    p ? { path: '/career/recognition', target: byTitle(p.title), title: 'Press that follows the work', text: `${p.title} is linked to ${w.title}. Add a clipping and it opens right here.` } : null,
    { path: '/projects', target: '[data-tour="desk-tasks"]', title: 'Now you', text: 'Back on your desk: tick off one of this week’s tasks.', doneWhen: { event: 'wa:task-done' }, doLabel: 'Tick one' },
    deskFixed
      ? { path: '/projects', target: '[data-tour="desk-project"]', title: 'Make it yours', text: 'Press the eye on any card to hide it. Your colour lives under Account › Appearance. On a larger screen you can drag the cards into your own order.' }
      : { path: '/projects', target: '[data-tour="desk-project"]', title: 'Arrange your desk', text: 'Drag this card somewhere else. Hover any card and press the eye to hide it. Your colour lives under Account › Appearance.', doneWhen: { event: 'wa:card-moved' }, doLabel: 'Drag it' },
  ]
  return steps.filter((s): s is Step => s !== null)
}

// ── tour state, shared across pages ─────────────────────────────────────────

const STEP_KEY = 'wa-tour-step'
const read = (store: Storage, k: string) => { try { return store.getItem(k) } catch { return null } }
const write = (store: Storage, k: string, v: string | null) => { try { if (v == null) store.removeItem(k); else store.setItem(k, v) } catch { /* private mode */ } }

let current: number | null = (() => { const v = read(sessionStorage, STEP_KEY); return v == null ? null : Number(v) })()
const listeners = new Set<() => void>()
function set(step: number | null) {
  current = step
  write(sessionStorage, STEP_KEY, step == null ? null : String(step))
  listeners.forEach(l => l())
}
const useStep = () => useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb) }, () => current)

export const startTour = () => set(0)
function endTour() { set(null) }

// ── the tour ─────────────────────────────────────────────────────────────────

const btn: React.CSSProperties = { minHeight: 36, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }
const DIM = 'rgba(17,17,17,.55)'
const TIP_W = 340
const PAD = 8

export function GuidedTour() {
  const step = useStep()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [tipH, setTipH] = useState(200)
  const tipRef = useRef<HTMLDivElement>(null)
  const deskFixed = useNarrow('(max-width: 900px)')
  const phone = useNarrow()

  const data = useLiveQuery(async () => {
    if (!demoField) return null
    const w = await db.works.filter(x => x.title === THREAD[demoField!]).first()
    if (!w?.id) return null
    const events = (await db.eventEntries.toArray()).filter(x => (x.workIds ?? []).includes(w.id!)).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    const press = await db.pressEntries.filter(x => x.workId === w.id && x.category !== 'award').first()
    return { w, e: events[0], p: press }
  }, [])
  const steps = data ? buildSteps(data.w, data.e, data.p, deskFixed) : []
  const s = step == null ? null : steps[step]

  function next() {
    if (step == null) return
    if (step >= steps.length - 1) endTour()
    else set(step + 1)
  }

  // Go to the step's page, then find what it points at.
  useEffect(() => {
    if (!s) return
    if (pathname !== s.path) {
      // A hands-on step that is done by changing page moves on by itself.
      if (s.doneWhen?.route?.test(pathname)) { next(); return }
      navigate(s.path); return
    }
    setRect(null)
    let alive = true
    let tries = 0
    let el: Element | null = null
    const measure = () => { if (alive && el) setRect(el.getBoundingClientRect()) }
    const find = () => {
      if (!alive) return
      el = document.querySelector(s.target)
      if (!el) { if (tries++ < 40) setTimeout(find, 60); return }
      const r = el.getBoundingClientRect()
      if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' })
      setTimeout(measure, 380)
    }
    find()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { alive = false; window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step, pathname, s?.target])

  // Hands-on steps that are done with an action on the page.
  useEffect(() => {
    const ev = s?.doneWhen?.event
    if (!ev) return
    const onDone = () => setTimeout(next, 400)
    window.addEventListener(ev, onDone)
    return () => window.removeEventListener(ev, onDone)
  }, [step, s?.doneWhen?.event])

  useLayoutEffect(() => { if (tipRef.current) setTipH(tipRef.current.offsetHeight) })

  if (!demoField) return null
  if (!s) {
    return (
      <button onClick={startTour} aria-label="Start the tour"
        style={{ ...btn, position: 'fixed', right: 16, bottom: phone ? 80 : 88, zIndex: 70, background: '#111111', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,.18)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(phone ? { width: 44, height: 44, padding: 0 } : {}) }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--accent)', color: '#111111', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>?</span>
        {!phone && 'Tour'}
      </button>
    )
  }

  // Place the tip beside the highlighted part: below, above, right, left, or else in the corner.
  const vw = window.innerWidth, vh = window.innerHeight
  const w = Math.min(TIP_W, vw - 32)
  let pos: React.CSSProperties = { right: 16, bottom: 24 }
  if (rect) {
    const left = Math.min(Math.max(rect.left, 16), vw - w - 16)
    if (rect.bottom + PAD + 14 + tipH < vh - 8) pos = { top: rect.bottom + PAD + 14, left }
    else if (rect.top - PAD - 14 - tipH > 8) pos = { top: rect.top - PAD - 14 - tipH, left }
    else if (rect.right + PAD + 14 + w < vw - 8) pos = { left: rect.right + PAD + 14, top: Math.min(Math.max(rect.top, 16), vh - tipH - 16) }
    else if (rect.left - PAD - 14 - w > 8) pos = { left: rect.left - PAD - 14 - w, top: Math.min(Math.max(rect.top, 16), vh - tipH - 16) }
  }
  const last = step === steps.length - 1
  const hands = !!s.doneWhen

  // While the tour runs the page is blocked, except the highlighted part on a hands-on step.
  const hole = hands && rect ? { l: rect.left - PAD, t: rect.top - PAD, r: rect.right + PAD, b: rect.bottom + PAD } : null
  const blockers: React.CSSProperties[] = hole
    ? [
        { left: 0, top: 0, width: '100%', height: Math.max(0, hole.t) },
        { left: 0, top: hole.b, width: '100%', bottom: 0 },
        { left: 0, top: hole.t, width: Math.max(0, hole.l), height: hole.b - hole.t },
        { left: hole.r, top: hole.t, right: 0, height: hole.b - hole.t },
      ]
    : [{ inset: 0 }]

  return (
    <>
      {blockers.map((b, i) => <div key={i} aria-hidden="true" style={{ position: 'fixed', zIndex: 80, ...b, background: rect ? 'transparent' : DIM }} />)}
      {rect && (
        <div aria-hidden="true" style={{ position: 'fixed', zIndex: 81, pointerEvents: 'none', left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, borderRadius: 18, boxShadow: `0 0 0 9999px ${DIM}`, outline: '2px solid var(--accent)', transition: 'all .25s ease' }} />
      )}
      <div ref={tipRef} role="dialog" aria-label={`Tour, step ${step! + 1} of ${steps.length}: ${s.title}`}
        style={{ position: 'fixed', zIndex: 82, ...pos, width: w, background: '#111111', color: '#FFFFFF', borderRadius: 18, padding: '18px 20px 16px', boxShadow: '0 16px 48px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 10px', borderRadius: 999, background: 'var(--accent)', color: '#111111', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {step! + 1} of {steps.length}
            </span>
            {hands && <span style={{ fontSize: 11, color: '#D6D6D6' }}>Your turn</span>}
          </span>
          <button onClick={endTour} style={{ ...btn, minHeight: 28, padding: '0 6px', background: 'none', color: '#B3B3B3', fontWeight: 400 }}>End tour</button>
        </div>
        <p style={{ margin: 0, fontFamily: 'Recoleta, serif', fontSize: 21, lineHeight: 1.2 }}>{s.title}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: '#D6D6D6' }}>{s.text}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 16 }}>
          {step! > 0 && <button onClick={() => set(step! - 1)} style={{ ...btn, background: '#2A2A2A', color: '#FFFFFF' }}>Back</button>}
          {hands
            ? <button onClick={next} style={{ ...btn, background: 'none', color: '#B3B3B3', fontWeight: 400 }}>{last ? 'Finish' : 'Skip'}</button>
            : <button onClick={next} style={{ ...btn, background: 'var(--accent)', color: '#111111' }}>{last ? 'Done' : 'Next'}</button>}
        </div>
      </div>
    </>
  )
}
