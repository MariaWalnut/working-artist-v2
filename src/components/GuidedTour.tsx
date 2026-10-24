import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { demoField, userId } from '../lib/mode'

// A guided tour through the app: each step points at one part of a page, and Next moves on,
// switching page when the next step lives elsewhere. Elements opt in with data-tour="…".

interface Step { path: string; target: string; title: string; text: string }

const STEPS: Step[] = [
  { path: '/projects', target: 'desk', title: 'Your desk', text: 'Your projects, tasks and dates, together. This is where each day starts.' },
  { path: '/projects', target: 'desk-project', title: 'Projects', text: 'Each card shows the next step and how far along it is. Click a card to open the project.' },
  { path: '/projects', target: 'desk-tasks', title: 'Tasks', text: 'What is due this week, from every project. Tick one off when it is done.' },
  { path: '/projects', target: 'desk-comingup', title: 'Coming up', text: 'Your next events and deadlines. Urgent ones show in your colour.' },
  { path: '/projects', target: 'desk-project', title: 'Make it yours', text: 'Drag cards to move them and drag the side handle to resize. Hover a card and press the eye to hide it; hidden boxes wait above the desk.' },
  { path: '/projects', target: 'desk-toolbar', title: 'Add more', text: 'Add projects, tasks, lists, notes, quotes and images to the desk.' },
  { path: '/projects/events', target: 'events-list', title: 'Events', text: 'Readings, shows, fairs and markets. Link the works you showed and set goals for the ones ahead.' },
  { path: '/opportunities', target: 'subs-list', title: 'Submissions', text: 'Every open call, grant and residency, with its deadline and status. Sent ones stop counting down.' },
  { path: '/opportunities', target: 'subs-import', title: 'Import', text: 'Bring in a list of calls from a spreadsheet, so nothing has to be typed twice.' },
  { path: '/manifest', target: 'manifest-board', title: 'Manifest', text: 'A free board for where you are heading: pictures, quotes, goals and references.' },
  { path: '/manifest', target: 'manifest-arrow', title: 'Connect ideas', text: 'Press Arrow, then click two items to join them with a line.' },
  { path: '/studio', target: 'works-list', title: 'Works', text: 'Everything you have made, from artworks to books and releases. Open a book to see its contract and foreign rights.' },
  { path: '/career', target: 'career', title: 'Career', text: 'A timeline, a map of where your work has been, and your press and awards, all drawn from what you entered.' },
  { path: '/account', target: 'appearance', title: 'Your colour', text: 'Choose the accent colour for the whole app. That is the tour; enjoy your studio.' },
]

// ── tour state, shared across pages ─────────────────────────────────────────

const STEP_KEY = 'wa-tour-step'
const doneKey = () => `wa-tour-done-${demoField ? `demo-${demoField}` : userId ?? 'local'}`
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
function endTour() { write(localStorage, doneKey(), '1'); set(null) }

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
  const s = step == null ? null : STEPS[step]

  // Demos start the tour by themselves the first time.
  useEffect(() => {
    if (demoField && current == null && read(localStorage, doneKey()) !== '1') set(0)
  }, [])

  // Go to the step's page, then find what it points at.
  useEffect(() => {
    if (!s) return
    if (pathname !== s.path) { navigate(s.path); return }
    setRect(null)
    let alive = true
    let tries = 0
    let el: Element | null = null
    const measure = () => { if (alive && el) setRect(el.getBoundingClientRect()) }
    const find = () => {
      if (!alive) return
      el = document.querySelector(`[data-tour="${s.target}"]`)
      if (!el) { if (tries++ < 40) setTimeout(find, 60); return }
      const r = el.getBoundingClientRect()
      if (r.top < 80 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ block: r.height > window.innerHeight * 0.6 ? 'start' : 'center', behavior: 'smooth' })
      setTimeout(measure, 380)
    }
    find()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { alive = false; window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [step, pathname])

  useLayoutEffect(() => { if (tipRef.current) setTipH(tipRef.current.offsetHeight) })

  if (!s) {
    return demoField ? (
      <button onClick={startTour} aria-label="Start the tour"
        style={{ ...btn, position: 'fixed', right: 16, bottom: 88, zIndex: 70, background: '#111111', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--accent)', color: '#111111', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>?</span>
        Tour
      </button>
    ) : null
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
  const last = step === STEPS.length - 1

  return (
    <>
      {/* Blocks the page while the tour runs; the dimming comes from the spotlight's shadow. */}
      <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 80, background: rect ? 'transparent' : DIM }} />
      {rect && (
        <div aria-hidden="true" style={{ position: 'fixed', zIndex: 81, pointerEvents: 'none', left: rect.left - PAD, top: rect.top - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2, borderRadius: 18, boxShadow: `0 0 0 9999px ${DIM}`, outline: '2px solid var(--accent)', transition: 'all .25s ease' }} />
      )}
      <div ref={tipRef} role="dialog" aria-label={`Tour, step ${step! + 1} of ${STEPS.length}: ${s.title}`}
        style={{ position: 'fixed', zIndex: 82, ...pos, width: w, background: '#111111', color: '#FFFFFF', borderRadius: 18, padding: '18px 20px 16px', boxShadow: '0 16px 48px rgba(0,0,0,.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 10px', borderRadius: 999, background: 'var(--accent)', color: '#111111', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {step! + 1} of {STEPS.length}
          </span>
          <button onClick={endTour} style={{ ...btn, minHeight: 28, padding: '0 6px', background: 'none', color: '#B3B3B3', fontWeight: 400 }}>End tour</button>
        </div>
        <p style={{ margin: 0, fontFamily: 'Recoleta, serif', fontSize: 21, lineHeight: 1.2 }}>{s.title}</p>
        <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: '#D6D6D6' }}>{s.text}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          {step! > 0 && <button onClick={() => set(step! - 1)} style={{ ...btn, background: '#2A2A2A', color: '#FFFFFF' }}>Back</button>}
          <button onClick={() => (last ? endTour() : set(step! + 1))} style={{ ...btn, background: 'var(--accent)', color: '#111111' }}>{last ? 'Done' : 'Next'}</button>
        </div>
      </div>
    </>
  )
}
