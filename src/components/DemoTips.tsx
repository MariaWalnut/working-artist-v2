import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { demoField } from '../lib/mode'

// Short how-to notes for demo visitors, shown once per page and brought back with the Tips button.

interface Tip { title: string; text: string }

const TIPS: Array<{ match: (path: string) => boolean; key: string; tips: Tip[] }> = [
  {
    key: 'desk', match: p => p === '/projects',
    tips: [
      { title: 'Your desk', text: 'Projects, tasks and what is coming up, together. Click a project card to open it.' },
      { title: 'Arrange it', text: 'Drag cards to move them around. Drag the handle on a card’s side to make it wider.' },
      { title: 'Hide what you don’t need', text: 'Hover a card and press the eye to hide it. Hidden boxes wait under Hidden boxes, above the desk.' },
      { title: 'Add more', text: 'The + at the bottom adds projects, tasks, lists, notes, quotes and images.' },
      { title: 'Your colour', text: 'Choose the accent colour under Account › Appearance. It changes the whole app.' },
    ],
  },
  {
    key: 'events', match: p => p === '/projects/events',
    tips: [
      { title: 'Events', text: 'Readings, shows, fairs and markets. Add one with + Add, link the works you showed and set goals for the ones ahead.' },
    ],
  },
  {
    key: 'submissions', match: p => p === '/opportunities',
    tips: [
      { title: 'Submissions', text: 'Every open call, grant and residency with its deadline. Change the status as it moves along; sent ones stop counting down.' },
      { title: 'Bring a list in', text: 'Import adds calls from a spreadsheet file, so nothing has to be typed twice.' },
    ],
  },
  {
    key: 'manifest', match: p => p === '/manifest',
    tips: [
      { title: 'Manifest', text: 'A free board for where you are heading. Add text, notes, quotes and images from the toolbar.' },
      { title: 'Connect things', text: 'Press Arrow, then click two items to draw a line between them. Click a line to remove it.' },
    ],
  },
  {
    key: 'career', match: p => p.startsWith('/career'),
    tips: [
      { title: 'Career', text: 'Drawn from what you entered: a timeline, a map of where your work has been, and your press and awards.' },
    ],
  },
  {
    key: 'works', match: p => p === '/studio' || p.startsWith('/studio/'),
    tips: [
      { title: 'Works', text: 'Everything you have made, from artworks to books and releases. Open a book to see its contract and foreign rights.' },
    ],
  },
]

const seenKey = (key: string) => `wa-tips-${demoField}-${key}`
const readSeen = (key: string) => { try { return localStorage.getItem(seenKey(key)) === '1' } catch { return false } }
const writeSeen = (key: string) => { try { localStorage.setItem(seenKey(key), '1') } catch { /* private mode */ } }

const btn: React.CSSProperties = { minHeight: 36, padding: '0 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }

export function DemoTips() {
  const { pathname } = useLocation()
  const page = TIPS.find(t => t.match(pathname))
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    setStep(0)
    setOpen(!!page && !readSeen(page.key))
  }, [page?.key])

  if (!demoField || !page) return null

  function close() {
    writeSeen(page!.key)
    setOpen(false)
  }

  const tip = page.tips[step]
  const last = step === page.tips.length - 1
  const place: React.CSSProperties = { position: 'fixed', right: 16, bottom: 88, zIndex: 70 }

  if (!open) {
    return (
      <button onClick={() => { setStep(0); setOpen(true) }} aria-label="Show tips for this page"
        style={{ ...place, ...btn, background: '#111111', color: '#FFFFFF', boxShadow: '0 4px 16px rgba(0,0,0,.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--accent)', color: '#111111', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>?</span>
        Tips
      </button>
    )
  }

  return (
    <div role="dialog" aria-label={`Tip: ${tip.title}`}
      style={{ ...place, width: 320, maxWidth: 'calc(100vw - 32px)', background: '#111111', color: '#FFFFFF', borderRadius: 18, padding: '18px 20px 16px', boxShadow: '0 16px 48px rgba(0,0,0,.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', minHeight: 24, padding: '0 10px', borderRadius: 999, background: 'var(--accent)', color: '#111111', fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {page.tips.length > 1 ? `Tip ${step + 1} of ${page.tips.length}` : 'Tip'}
        </span>
        <button onClick={close} style={{ ...btn, minHeight: 28, padding: '0 6px', background: 'none', color: '#B3B3B3', fontWeight: 400 }}>Skip</button>
      </div>
      <p style={{ margin: 0, fontFamily: 'Recoleta, serif', fontSize: 20, lineHeight: 1.2 }}>{tip.title}</p>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: '#D6D6D6' }}>{tip.text}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        {step > 0 && <button onClick={() => setStep(s => s - 1)} style={{ ...btn, background: '#2A2A2A', color: '#FFFFFF' }}>Back</button>}
        <button onClick={() => (last ? close() : setStep(s => s + 1))} style={{ ...btn, background: 'var(--accent)', color: '#111111' }}>{last ? 'Done' : 'Next'}</button>
      </div>
    </div>
  )
}
