import { useEffect, useState } from 'react'
import type { PressEntry } from '../db/db'

export const isPdf = (data?: string) => !!data && data.startsWith('data:application/pdf')

export function ClippingViewer({ entry, onClose }: { entry: PressEntry; onClose: () => void }) {
  const data = entry.clipping ?? ''
  const pdf = isPdf(data)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Browsers refuse to show PDF data URLs in a frame, so the PDF is handed over as a blob URL.
  useEffect(() => {
    if (!pdf) return
    let url: string | null = null
    let cancelled = false
    void fetch(data).then(r => r.blob()).then(b => {
      if (cancelled) return
      url = URL.createObjectURL(b)
      setPdfUrl(url)
    })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [data, pdf])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const btn: React.CSSProperties = { background: '#FFFFFF', border: 'none', borderRadius: 999, padding: '9px 16px', fontSize: 11, color: '#444444', cursor: 'pointer', textDecoration: 'none', boxShadow: '0 2px 10px rgba(0,0,0,.08)', fontFamily: 'inherit' }
  const frame: React.CSSProperties = { borderRadius: 10, boxShadow: '0 24px 70px rgba(0,0,0,.20)', background: '#FFFFFF' }

  return (
    <div role="dialog" aria-modal="true" aria-label={entry.title} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(245,245,245,.55)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: '100%' }}>
        <div style={{ textAlign: 'center', maxWidth: 640 }}>
          <div style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: '#111111', textWrap: 'balance' }}>{entry.title}</div>
          {(entry.outlet || entry.date) && <div style={{ fontSize: 11, color: '#777777', marginTop: 4 }}>{[entry.outlet, entry.date].filter(Boolean).join(' · ')}</div>}
        </div>
        {pdf
          ? <iframe src={pdfUrl ?? undefined} title={entry.title} style={{ ...frame, width: 'min(900px, 92vw)', height: '72vh', border: 'none' }} />
          : <img src={data} alt={entry.title} style={{ ...frame, display: 'block', maxWidth: 'min(1100px, 92vw)', maxHeight: '72vh', objectFit: 'contain' }} />}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <a href={pdfUrl ?? data} download={entry.clippingName ?? 'clipping'} style={btn}>Download</a>
          {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer" style={btn}>Open article ↗</a>}
          <button onClick={onClose} style={btn}>Close</button>
        </div>
      </div>
    </div>
  )
}
