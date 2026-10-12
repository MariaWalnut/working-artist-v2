import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'

const DAILY = [
  'Rest is part of the work.',
  'New week. New work.',
  'One thing at a time.',
  "You're in it.",
  'Keep the momentum.',
  'Finish strong.',
  'The studio is always open.',
]

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function Today() {
  const navigate = useNavigate()
  const dept = useActiveDept()
  const wordmark = dept?.name?.trim() || 'Working Artist'
  const phrase = DAILY[new Date().getDay()]
  const hasCover = !!dept?.coverImage

  const coverInputRef = useRef<HTMLInputElement>(null)
  const [showCoverBtn, setShowCoverBtn] = useState(false)

  async function handleCoverFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !dept?.id) return
    const reader = new FileReader()
    reader.onload = async () => {
      await db.departments.update(dept.id!, { coverImage: reader.result as string })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const fg = hasCover ? '#FFFFFF' : '#111111'

  return (
    <div
      className="min-h-svh"
      style={{ position: 'relative', overflow: 'hidden', background: hasCover ? '#111' : '#F5E642' }}
      onMouseEnter={() => setShowCoverBtn(true)}
      onMouseLeave={() => setShowCoverBtn(false)}
    >
      {/* ─── cover photo layers ─── */}
      {hasCover && (
        <>
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${dept!.coverImage})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }} />
          {/* focused scrim: dark only in the top-left corner where text lives */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 65% 55% at 0% 0%, rgba(0,0,0,0.58) 0%, transparent 100%)',
          }} />
          {/* subtle edge vignette */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 130% 110% at 50% 50%, transparent 45%, rgba(0,0,0,0.28) 100%)',
          }} />
        </>
      )}

      {/* ─── hidden file input ─── */}
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void handleCoverFile(e)} />

      {/* ─── change cover — top right, hover only ─── */}
      <div style={{ position: 'absolute', top: 26, right: 32, zIndex: 2 }}>
        <button
          onClick={e => { e.stopPropagation(); coverInputRef.current?.click() }}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: hasCover ? 'rgba(255,255,255,.12)' : 'rgba(17,17,17,.08)',
            border: 'none', borderRadius: 22, padding: '7px 14px', cursor: 'pointer',
            opacity: showCoverBtn ? 1 : 0, transition: 'opacity 0.18s',
          }}
        >
          <svg width="13" height="11" viewBox="0 0 13 11" fill="none">
            <path d="M4.5 1L3.5 3H1C.45 3 0 3.45 0 4V10C0 10.55.45 11 1 11H12C12.55 11 13 10.55 13 10V4C13 3.45 12.55 3 12 3H9.5L8.5 1H4.5Z" stroke={fg} strokeWidth="1" strokeLinejoin="round" />
            <circle cx="6.5" cy="7" r="2.2" stroke={fg} strokeWidth="1" />
          </svg>
          <span style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: fg }}>
            {hasCover ? 'Change cover' : 'Add cover'}
          </span>
        </button>
      </div>

      {/* ─── content — top left ─── */}
      <div
        style={{ position: 'relative', zIndex: 1, padding: '28px 36px', cursor: 'pointer' }}
        onClick={() => navigate('/projects')}
        title="Enter studio"
      >
        <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: fg, opacity: 0.4, marginBottom: 18 }}>
          {todayLabel()}
        </div>
        <h1 style={{
          fontFamily: 'Recoleta, serif', fontWeight: 400,
          fontSize: 'clamp(44px, 6vw, 80px)', lineHeight: 1.0,
          letterSpacing: '-0.02em', color: fg, margin: '0 0 12px',
          textShadow: hasCover ? '0 2px 16px rgba(0,0,0,0.35)' : 'none',
        }}>
          {wordmark}
        </h1>
        <p style={{
          fontFamily: 'Recoleta, serif', fontSize: 16, color: fg,
          opacity: 0.5, margin: 0,
          textShadow: hasCover ? '0 1px 8px rgba(0,0,0,0.35)' : 'none',
        }}>
          {phrase}
        </p>
      </div>
    </div>
  )
}
