import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A crop as fractions of the original picture, so it can be opened again and changed.
export interface CropRect { x: number; y: number; w: number; h: number }

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se'
interface Drag { mode: Mode; sx: number; sy: number; start: CropRect }

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 }
const MIN = 0.05
const MAX_SIDE = 2000
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const btn: React.CSSProperties = { minHeight: 36, padding: '0 16px', borderRadius: 999, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }
const handle: React.CSSProperties = { position: 'absolute', width: 16, height: 16, background: '#FFFFFF', border: '1.5px solid #111111', borderRadius: 3, touchAction: 'none' }

export function CropDialog({ src, initial, onApply, onClose }: {
  src: string
  initial?: CropRect
  onApply: (dataUrl: string, rect: CropRect, ratio: number) => void
  onClose: () => void
}) {
  const [rect, setRect] = useState<CropRect>(initial ?? FULL)
  const [error, setError] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const drag = useRef<Drag | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  function onDown(e: React.PointerEvent, mode: Mode) {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: rect }
  }

  function onMove(e: React.PointerEvent) {
    const d = drag.current
    const box = boxRef.current?.getBoundingClientRect()
    if (!d || !box) return
    const dx = (e.clientX - d.sx) / box.width
    const dy = (e.clientY - d.sy) / box.height
    const s = d.start
    if (d.mode === 'move') {
      setRect({ ...s, x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h) })
      return
    }
    let { x, y, w, h } = s
    if (d.mode.includes('w')) { x = clamp(s.x + dx, 0, s.x + s.w - MIN); w = s.w + s.x - x }
    if (d.mode.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x)
    if (d.mode.includes('n')) { y = clamp(s.y + dy, 0, s.y + s.h - MIN); h = s.h + s.y - y }
    if (d.mode.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y)
    setRect({ x, y, w, h })
  }

  async function apply() {
    try {
      const img = await load(src)
      const sw = rect.w * img.naturalWidth, sh = rect.h * img.naturalHeight
      const k = Math.min(1, MAX_SIDE / Math.max(sw, sh))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(sw * k)
      canvas.height = Math.round(sh * k)
      canvas.getContext('2d')!.drawImage(img, rect.x * img.naturalWidth, rect.y * img.naturalHeight, sw, sh, 0, 0, canvas.width, canvas.height)
      const keepsAlpha = /^data:image\/(png|gif|webp)/.test(src)
      onApply(canvas.toDataURL(keepsAlpha ? 'image/png' : 'image/jpeg', 0.9), rect, sh / sw)
    } catch {
      setError('This picture comes from another website, so it can’t be cropped here. Replace it with a file from your computer first.')
    }
  }

  const area = { left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.w * 100}%`, height: `${rect.h * 100}%` }
  const corner = (mode: Mode, pos: React.CSSProperties) => (
    <div aria-hidden="true" onPointerDown={e => onDown(e, mode)}
      style={{ ...handle, ...pos, cursor: mode === 'nw' || mode === 'se' ? 'nwse-resize' : 'nesw-resize' }} />
  )

  return createPortal(
    <div role="dialog" aria-label="Crop picture" onPointerDown={e => e.stopPropagation()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(17,17,17,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: 20, maxWidth: '100%', boxSizing: 'border-box', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <p style={{ margin: '0 0 14px', fontFamily: 'Recoleta, serif', fontSize: 22, color: '#111111' }}>Crop</p>
        {/* The shade is clipped to the picture; the handles sit above it so they stay whole at the edges. */}
        <div ref={boxRef} onPointerMove={onMove} onPointerUp={() => { drag.current = null }}
          style={{ position: 'relative', lineHeight: 0, userSelect: 'none', margin: '8px auto', width: 'fit-content' }}>
          <img src={src} alt="" draggable={false}
            style={{ display: 'block', maxWidth: 'min(84vw, 860px)', maxHeight: '64vh', pointerEvents: 'none' }} />
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', ...area, boxShadow: '0 0 0 9999px rgba(0,0,0,.5)', outline: '2px solid #FFFFFF' }} />
          </div>
          <div onPointerDown={e => onDown(e, 'move')} style={{ position: 'absolute', ...area, cursor: 'move', touchAction: 'none' }}>
            {corner('nw', { left: -8, top: -8 })}
            {corner('ne', { right: -8, top: -8 })}
            {corner('sw', { left: -8, bottom: -8 })}
            {corner('se', { right: -8, bottom: -8 })}
          </div>
        </div>
        {error && <p role="alert" style={{ margin: '12px 0 0', maxWidth: 420, fontSize: 13, lineHeight: 1.5, color: '#C53030' }}>{error}</p>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => setRect(FULL)} style={{ ...btn, background: '#F5F5F5', color: '#444444' }}>Reset</button>
          <span style={{ flex: 1 }} />
          <button onClick={onClose} style={{ ...btn, background: 'none', color: '#666666', fontWeight: 400 }}>Cancel</button>
          <button onClick={() => void apply()} style={{ ...btn, background: 'var(--accent)', color: '#111111' }}>Apply</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
