import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import { useActiveDept } from '../lib/useDept'

const DAILY = [
  'Rest is part of the work.',    // Sunday
  'New week. New work.',          // Monday
  'One thing at a time.',         // Tuesday
  'You\'re in it.',               // Wednesday
  'Keep the momentum.',           // Thursday
  'Finish strong.',               // Friday
  'The studio is always open.',   // Saturday
]

const MOODS = [
  { key: 'flow',   label: 'Flow',   color: '#F5E642' },
  { key: 'good',   label: 'Good',   color: '#B8E0A4' },
  { key: 'hard',   label: 'Hard',   color: '#E8C4B4' },
  { key: 'social', label: 'Social', color: '#78AECB' },
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

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayLog = useLiveQuery(
    () => dept?.id == null ? undefined : db.dayLogs.where({ departmentId: dept.id, date: todayStr }).first(),
    [dept?.id, todayStr],
  )

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

  async function logMood(key: string) {
    if (!dept?.id) return
    const base = { departmentId: dept.id, date: todayStr, mood: key, dayType: key }
    if (todayLog?.id) {
      await db.dayLogs.update(todayLog.id, base)
    } else {
      await db.dayLogs.add(base)
    }
  }

  // colour tokens that flip with the cover state
  const fg    = hasCover ? '#FFFFFF' : '#111111'
  const fgRgb = hasCover ? '255,255,255' : '17,17,17'

  return (
    <div
      className="flex min-h-svh flex-col"
      style={{ position: 'relative', overflow: 'hidden', background: hasCover ? '#111' : '#F5E642', padding: '26px 32px' }}
      onMouseEnter={() => setShowCoverBtn(true)}
      onMouseLeave={() => setShowCoverBtn(false)}
    >
      {/* ─── cover photo layers ─── */}
      {hasCover && (
        <>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${dept!.coverImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 120% 100% at 50% 50%, transparent 30%, rgba(0,0,0,0.6) 100%)' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 170, background: 'linear-gradient(to bottom, rgba(0,0,0,.45), transparent)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: 'linear-gradient(to top, rgba(0,0,0,.5), transparent)' }} />
        </>
      )}

      {/* ─── hidden file input ─── */}
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => void handleCoverFile(e)} />

      {/* ─── top row: date + change-cover button ─── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: fg, opacity: 0.45 }}>
          {todayLabel()}
        </div>
        <button
          onClick={() => coverInputRef.current?.click()}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            background: hasCover ? 'rgba(255,255,255,.12)' : 'rgba(17,17,17,.08)',
            border: 'none', borderRadius: 22, padding: '7px 14px', cursor: 'pointer',
            opacity: showCoverBtn ? 1 : 0,
            transition: 'opacity 0.18s',
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

      {/* ─── name + phrase — lower third ─── */}
      <div
        style={{ flex: 1, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 64, gap: 14, cursor: 'pointer' }}
        onClick={() => navigate('/projects')}
        title="Enter studio"
      >
        {hasCover && (
          <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.22em', textTransform: 'uppercase', color: '#FFFFFF', opacity: 0.35 }}>
            Working Artist
          </div>
        )}
        <h1 style={{ fontFamily: 'Recoleta, serif', fontWeight: 400, fontSize: 'clamp(48px, 7.5vw, 88px)', lineHeight: 0.95, letterSpacing: '-0.02em', color: fg, textAlign: 'center', margin: 0 }}>
          {wordmark}
        </h1>
        <p style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: fg, opacity: 0.48, margin: 0, textAlign: 'center' }}>
          {phrase}
        </p>
      </div>

      {/* ─── mood picker ─── */}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontSize: 9.5, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: fg, opacity: 0.35 }}>
          Today
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {MOODS.map(m => {
            const selected = todayLog?.mood === m.key || todayLog?.dayType === m.key
            return (
              <div key={m.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, cursor: 'pointer' }} onClick={() => void logMood(m.key)}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: m.color,
                  outline: selected ? `2px solid ${fg}` : 'none',
                  outlineOffset: 2,
                  boxShadow: hasCover
                    ? '0 0 0 1px rgba(255,255,255,0.18)'
                    : (m.color === '#F5E642' ? '0 0 0 1.5px rgba(0,0,0,0.18)' : 'none'),
                  transition: 'transform 0.12s',
                }} />
                <div style={{ fontSize: 8.5, fontWeight: 500, color: fg, opacity: selected ? 0.75 : 0.38, letterSpacing: '0.04em' }}>
                  {m.label}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
