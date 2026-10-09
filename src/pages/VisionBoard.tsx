import { useState, useRef, useCallback, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Board, type BoardItem } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

// ── types ─────────────────────────────────────────────────────────────────────

type Mode = 'select' | 'arrow'
interface DragState { itemId: number; startX: number; startY: number; origX: number; origY: number }
interface ArrowData { fromId: number; toId: number }

// ── constants ─────────────────────────────────────────────────────────────────

const PRESETS = [
  '#F5E642', '#FFFFFF', '#F5F5F5', '#111111',
  '#E8C4B4', '#B8E0A4', '#78AECB', '#B898D8',
  '#F0B0B0', '#C8F0C0',
]

const DEFAULTS: Record<string, { w: number; h: number }> = {
  title: { w: 280, h: 90 },
  quote: { w: 260, h: 116 },
  text:  { w: 180, h: 72 },
  note:  { w: 200, h: 110 },
  tag:   { w: 130, h: 44 },
  image: { w: 200, h: 160 },
}

const TEXT_STYLES: Array<{ type: BoardItem['itemType']; label: string; size: string }> = [
  { type: 'title', label: 'Title',  size: '28px' },
  { type: 'quote', label: 'Quote',  size: '18px' },
  { type: 'text',  label: 'Text',   size: '13px' },
  { type: 'note',  label: 'Note',   size: '11px' },
  { type: 'tag',   label: 'Tag',    size: '10px' },
]

// ── helpers ───────────────────────────────────────────────────────────────────

function center(i: BoardItem) { return { x: i.x + i.w / 2, y: i.y + i.h / 2 } }

function isDark(hex: string | undefined) {
  if (!hex) return false
  const c = hex.replace('#', '')
  if (c.length !== 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) < 128
}

function fileToBase64(file: File): Promise<string> {
  return new Promise(resolve => {
    const r = new FileReader()
    r.onload = e => resolve(e.target!.result as string)
    r.readAsDataURL(file)
  })
}

function scatter(cx: number, cy: number, w: number, h: number) {
  return {
    x: cx - w / 2 + (Math.random() - 0.5) * 60,
    y: cy - h / 2 + (Math.random() - 0.5) * 40,
  }
}

// ── ColorPicker ───────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 8px' }}>Color</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
        {PRESETS.map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{
              width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', outline: 'none', flexShrink: 0,
              border: value === c ? '2.5px solid #111111' : c === '#FFFFFF' || c === '#F5F5F5' ? '1.5px solid #DDDDDD' : 'none',
            }} />
        ))}
        {/* Custom color: input sits on top, visually hidden behind the "+" dot */}
        <div style={{ position: 'relative', width: 20, height: 20, flexShrink: 0 }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px dashed #CCCCCC', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <span style={{ fontSize: 9, color: '#AAAAAA', lineHeight: 1 }}>+</span>
          </div>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', border: 'none', padding: 0 }} />
        </div>
      </div>
    </div>
  )
}

// ── EditPopup ─────────────────────────────────────────────────────────────────

function EditPopup({
  capturedItem, liveItem, canvasEl, onClose,
}: {
  capturedItem: BoardItem
  liveItem: BoardItem
  canvasEl: HTMLDivElement | null
  onClose: () => void
}) {
  const isImage = capturedItem.itemType === 'image'
  const isTextItem = !isImage && capturedItem.itemType !== 'arrow'

  const [text, setText]           = useState(capturedItem.content)
  const [color, setColor]         = useState(capturedItem.color ?? '#FFFFFF')
  const [editedType, setEditedType] = useState(capturedItem.itemType)

  const currentStyle = TEXT_STYLES.find(s => s.type === editedType)
  const isQuoteStyle = editedType === 'quote'

  // position below item, clamped inside canvas
  const W = 272
  const approxH = isImage ? 140 : 290
  const cW = canvasEl?.clientWidth ?? 800
  const cH = canvasEl?.clientHeight ?? 600
  let left = liveItem.x
  let top = liveItem.y + liveItem.h + 10
  if (left + W > cW - 8) left = Math.max(8, cW - W - 8)
  if (top + approxH > cH - 8) top = Math.max(8, liveItem.y - approxH - 10)
  if (left < 8) left = 8
  if (top < 8) top = 8

  async function save() {
    const upd: Partial<BoardItem> = { color }
    if (isTextItem) { upd.content = text.trim() || capturedItem.content; upd.itemType = editedType }
    await db.boardItems.update(capturedItem.id!, upd)
    onClose()
  }

  async function del() {
    if (capturedItem.id == null) return
    const connected = await db.boardItems
      .where('boardId').equals(capturedItem.boardId)
      .filter(i => i.itemType === 'arrow')
      .toArray()
    for (const a of connected) {
      try {
        const d = JSON.parse(a.content) as ArrowData
        if (d.fromId === capturedItem.id || d.toId === capturedItem.id) await db.boardItems.delete(a.id!)
      } catch { /* ignore */ }
    }
    await db.boardItems.delete(capturedItem.id!)
    onClose()
  }

  return (
    <div
      onMouseDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', left, top, zIndex: 200,
        width: W, background: '#FFFFFF',
        borderRadius: 14, padding: '16px 16px 12px',
        boxShadow: '0 8px 36px rgba(0,0,0,.18)',
        border: '1px solid #EBEBEB',
      }}>
      {/* Style picker (text items only) */}
      {isTextItem && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {TEXT_STYLES.map(s => (
            <button key={s.type} onClick={() => setEditedType(s.type)}
              style={{
                flex: 1, padding: '5px 0', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: editedType === s.type ? '#F5E642' : '#F5F5F5',
                color: editedType === s.type ? '#111111' : '#888888',
                fontSize: 10, fontWeight: editedType === s.type ? 600 : 400,
              }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Text editor */}
      {isTextItem && (
        isQuoteStyle || editedType === 'title' ? (
          <textarea autoFocus value={text} onChange={e => setText(e.target.value)} rows={editedType === 'title' ? 2 : 3}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '8px 10px', fontSize: currentStyle?.size ?? 13, outline: 'none', resize: 'none', marginBottom: 12, boxSizing: 'border-box', fontFamily: editedType === 'title' || isQuoteStyle ? 'Recoleta, serif' : 'inherit' }} />
        ) : (
          <input autoFocus value={text} onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void save(); if (e.key === 'Escape') onClose() }}
            style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '8px 10px', fontSize: currentStyle?.size ?? 13, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }} />
        )
      )}

      <div style={{ marginBottom: 14 }}>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => void del()}
          style={{ background: 'none', border: '1px solid #EEEEEE', borderRadius: 8, padding: '5px 10px', fontSize: 10, color: '#CCCCCC', cursor: 'pointer' }}>
          Delete
        </button>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => void save()}
            style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>
            {isImage ? 'Done' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── BoardCanvas ───────────────────────────────────────────────────────────────

function BoardCanvas({ board, onBack }: { board: Board; onBack: () => void }) {
  const allItems = useLiveQuery(
    () => db.boardItems.where('boardId').equals(board.id!).toArray(),
    [board.id],
  ) ?? []

  const items = allItems.filter(i => i.itemType !== 'arrow')
  const arrows = allItems.filter(i => i.itemType === 'arrow')

  const [mode, setMode]             = useState<Mode>('select')
  const [arrowSrc, setArrowSrc]     = useState<number | null>(null)
  const [adding, setAdding]         = useState<null | 'text' | 'note' | 'quote' | 'tag'>(null)
  const [addText, setAddText]       = useState('')
  const [addColor, setAddColor]     = useState('#FFFFFF')
  const [drag, setDrag]             = useState<DragState | null>(null)
  const [editingId, setEditingId]   = useState<number | null>(null)
  const [dropOver, setDropOver]     = useState(false)
  const [addingImage, setAddingImage]       = useState(false)
  const [imageDropActive, setImageDropActive] = useState(false)

  const canvasRef           = useRef<HTMLDivElement>(null)
  const movedRef            = useRef(false)
  const fileRef             = useRef<HTMLInputElement>(null)
  const dragCountRef        = useRef(0)
  const overlayDragCountRef = useRef(0)
  const markerId    = `ah-${board.id}`

  const editingItem     = editingId != null ? allItems.find(i => i.id === editingId) : undefined
  const capturedRef     = useRef<BoardItem | null>(null)
  if (editingItem && capturedRef.current?.id !== editingId) capturedRef.current = { ...editingItem }

  // ── add text item ──────────────────────────────────────────────────────────
  async function addItem(type: BoardItem['itemType'], content: string, color: string) {
    if (!content.trim()) return
    const { w, h } = DEFAULTS[type] ?? { w: 180, h: 72 }
    const el = canvasRef.current
    const pos = scatter(el ? el.clientWidth / 2 : 300, el ? el.clientHeight / 2 : 200, w, h)
    await db.boardItems.add({ boardId: board.id!, itemType: type, content: content.trim(), ...pos, w, h, color, createdAt: Date.now() })
    setAddText(''); setAdding(null)
  }

  // ── add images ─────────────────────────────────────────────────────────────
  async function addImages(files: FileList | null, dropX?: number, dropY?: number) {
    if (!files?.length) return
    const el = canvasRef.current
    const { w, h } = DEFAULTS.image
    const cx = dropX ?? (el ? el.clientWidth / 2 - w / 2 : 200)
    const cy = dropY ?? (el ? el.clientHeight / 2 - h / 2 : 100)
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const imageData = await fileToBase64(file)
      await db.boardItems.add({
        boardId: board.id!, itemType: 'image', content: file.name, imageData,
        x: cx + (Math.random() - 0.5) * 30, y: cy + (Math.random() - 0.5) * 20,
        w, h, createdAt: Date.now(),
      })
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── arrow click ─────────────────────────────────────────────────────────────
  async function handleArrowClick(itemId: number) {
    if (arrowSrc === null) {
      setArrowSrc(itemId)
    } else if (arrowSrc !== itemId) {
      await db.boardItems.add({
        boardId: board.id!, itemType: 'arrow',
        content: JSON.stringify({ fromId: arrowSrc, toId: itemId }),
        x: 0, y: 0, w: 0, h: 0, createdAt: Date.now(),
      })
      setArrowSrc(null); setMode('select')
    }
  }

  // ── drag handlers ──────────────────────────────────────────────────────────
  const onItemMouseDown = useCallback((e: React.MouseEvent, item: BoardItem) => {
    if (!item.id || e.button !== 0) return
    e.preventDefault(); e.stopPropagation()
    movedRef.current = false
    setDrag({ itemId: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y })
  }, [])

  const onCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY
    if (!movedRef.current && Math.hypot(dx, dy) > 4) movedRef.current = true
    if (movedRef.current) void db.boardItems.update(drag.itemId, { x: drag.origX + dx, y: drag.origY + dy })
  }, [drag])

  const onCanvasMouseUp = useCallback(() => {
    if (drag && !movedRef.current) {
      const item = allItems.find(i => i.id === drag.itemId)
      if (item) {
        if (mode === 'arrow') void handleArrowClick(drag.itemId)
        else { capturedRef.current = { ...item }; setEditingId(drag.itemId) }
      }
    }
    setDrag(null)
  }, [drag, mode, allItems])

  // background click: close popup, cancel arrow selection
  const onCanvasBgMouseDown = useCallback(() => {
    setEditingId(null)
    if (mode === 'arrow' && arrowSrc !== null) setArrowSrc(null)
  }, [mode, arrowSrc])

  // ── image drop ─────────────────────────────────────────────────────────────
  // Use a counter so nested child elements don't flicker the drop zone
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current++
    setDropOver(true)
  }, [])
  const onDragOver = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  const onDragLeave = useCallback(() => {
    dragCountRef.current--
    if (dragCountRef.current <= 0) { dragCountRef.current = 0; setDropOver(false) }
  }, [])
  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    dragCountRef.current = 0; setDropOver(false)
    const el = canvasRef.current; if (!el) return
    const rect = el.getBoundingClientRect()
    const { w, h } = DEFAULTS.image
    const files = e.dataTransfer.files
    if (!files.length) return
    await addImages(files, e.clientX - rect.left - w / 2, e.clientY - rect.top - h / 2)
  }, [board.id])

  // Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setEditingId(null); setMode('select'); setArrowSrc(null); setAdding(null); setAddingImage(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── arrow rendering ────────────────────────────────────────────────────────
  function renderArrow(a: BoardItem) {
    let d: ArrowData
    try { d = JSON.parse(a.content) } catch { return null }
    const from = items.find(i => i.id === d.fromId)
    const to   = items.find(i => i.id === d.toId)
    if (!from || !to) return null
    const fc = center(from), tc = center(to)
    return (
      <g key={a.id}>
        {/* wide invisible hit area for deletion */}
        <line x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
          stroke="transparent" strokeWidth={14} style={{ cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); void db.boardItems.delete(a.id!) }} />
        <line x1={fc.x} y1={fc.y} x2={tc.x} y2={tc.y}
          stroke="#888888" strokeWidth={1.5} markerEnd={`url(#${markerId})`}
          style={{ pointerEvents: 'none' }} />
      </g>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer', padding: 0 }}>← Boards</button>
        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: '#111111' }}>{board.name}</span>
        {/* Toolbar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 1, background: '#FFFFFF', borderRadius: 999, padding: '4px 6px', boxShadow: '0 2px 12px rgba(0,0,0,.10)' }}>
          {(['text', 'note', 'quote', 'tag'] as const).map(t => (
            <button key={t} onClick={() => { setMode('select'); setAdding(p => p === t ? null : t) }}
              style={{ padding: '5px 11px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500,
                background: adding === t ? '#F5F5F5' : 'none', color: adding === t ? '#444' : '#888',
                textTransform: 'capitalize' }}>
              {t}
            </button>
          ))}
          <div style={{ width: 1, height: 14, background: '#EEEEEE', margin: '0 3px' }} />
          <button onClick={() => { setAdding(null); setMode('select'); setAddingImage(true) }}
            style={{ padding: '5px 11px', borderRadius: 999, border: 'none', background: addingImage ? '#F5F5F5' : 'none', fontSize: 10, fontWeight: 500, color: addingImage ? '#444' : '#888', cursor: 'pointer' }}>
            Image
          </button>
          <button onClick={() => { setAdding(null); setEditingId(null); setMode(m => m === 'arrow' ? 'select' : 'arrow'); setArrowSrc(null) }}
            style={{ padding: '5px 11px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 500,
              background: mode === 'arrow' ? '#F5E642' : 'none', color: mode === 'arrow' ? '#111' : '#888' }}>
            Arrow
          </button>
        </div>
      </div>

      {/* Arrow hint */}
      {mode === 'arrow' && (
        <div style={{ background: '#F5E642', borderRadius: 8, padding: '6px 14px', marginBottom: 8, fontSize: 11, color: '#111', textAlign: 'center' }}>
          {arrowSrc === null ? 'Click the source element — then click the target' : 'Now click the target element'}
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '12px 14px', marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              {adding === 'quote' ? (
                <textarea autoFocus value={addText} onChange={e => setAddText(e.target.value)} placeholder='"Quote…"' rows={2}
                  style={{ width: '100%', borderRadius: 8, border: '1px solid #EEE', background: '#F5F5F5', padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
              ) : (
                <input autoFocus value={addText} onChange={e => setAddText(e.target.value)}
                  placeholder={adding === 'note' ? 'Note…' : adding === 'tag' ? 'Tag…' : 'Text…'}
                  onKeyDown={e => { if (e.key === 'Enter') void addItem(adding, addText, addColor); if (e.key === 'Escape') setAdding(null) }}
                  style={{ width: '100%', borderRadius: 8, border: '1px solid #EEE', background: '#F5F5F5', padding: '8px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              )}
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {PRESETS.slice(0, 6).map(c => (
                <button key={c} onClick={() => setAddColor(c)}
                  style={{ width: 18, height: 18, borderRadius: '50%', background: c, cursor: 'pointer', outline: 'none',
                    border: addColor === c ? '2px solid #111' : c === '#FFFFFF' || c === '#F5F5F5' ? '1.5px solid #DDD' : 'none' }} />
              ))}
            </div>
            <button onClick={() => void addItem(adding, addText, addColor)}
              style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
            <button onClick={() => setAdding(null)}
              style={{ background: 'none', border: 'none', fontSize: 14, color: '#AAA', cursor: 'pointer' }}>×</button>
          </div>
        </div>
      )}

      {/* Canvas */}
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { void addImages(e.target.files); setAddingImage(false) }} />

      <div ref={canvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseUp={onCanvasMouseUp}
        onMouseLeave={() => setDrag(null)}
        onMouseDown={onCanvasBgMouseDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          flex: 1, position: 'relative', overflow: 'visible',
          background: dropOver ? '#EFF7FF' : '#FAFAFA',
          borderRadius: 20, border: dropOver ? '2px dashed #78AECB' : '1px solid #EEEEEE',
          cursor: drag ? 'grabbing' : mode === 'arrow' ? 'crosshair' : 'default',
          transition: 'background 0.1s, border 0.1s',
        }}>

        {/* Dot grid — clipped inside the rounded rect via clipPath */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, borderRadius: 20, pointerEvents: 'none', overflow: 'hidden', opacity: 0.5 }}>
          <defs>
            <pattern id={`dots-${board.id}`} x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1" fill="#CCCCCC" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#dots-${board.id})`} />
        </svg>

        {/* Arrows SVG */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 1 }}>
          <defs>
            <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5"
              markerWidth="5" markerHeight="5" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#888888" />
            </marker>
          </defs>
          <g style={{ pointerEvents: 'all' }}>{arrows.map(a => renderArrow(a))}</g>
        </svg>

        {/* Empty state */}
        {items.length === 0 && !dropOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, pointerEvents: 'none' }}>
            <p style={{ fontSize: 11, color: '#CCCCCC', margin: 0 }}>Add items from the toolbar</p>
            <p style={{ fontSize: 11, color: '#CCCCCC', margin: 0, opacity: 0.7 }}>or drop images here</p>
          </div>
        )}
        {dropOver && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 50 }}>
            <p style={{ fontSize: 13, color: '#78AECB', fontWeight: 500, margin: 0 }}>Drop to add image</p>
          </div>
        )}

        {/* Items */}
        {items.map(item => {
          const isImg  = item.itemType === 'image'
          const isTag  = item.itemType === 'tag'
          const isQ    = item.itemType === 'quote'
          const bg     = item.color ?? '#FFFFFF'
          const tc     = isDark(bg) ? '#FFFFFF' : '#111111'
          const isSrc  = arrowSrc === item.id
          const isEdit = editingId === item.id

          return (
            <div key={item.id}
              onMouseDown={e => onItemMouseDown(e, item)}
              style={{
                position: 'absolute', left: item.x, top: item.y,
                width: item.w, height: isImg ? item.h : undefined,
                background: isImg ? 'transparent' : bg,
                borderRadius: isTag ? 999 : isQ ? 20 : 14,
                border: !isImg && (bg === '#FFFFFF' || bg === '#F5F5F5') ? '1px solid #EEEEEE' : 'none',
                boxShadow: isSrc
                  ? '0 0 0 2.5px #F5E642, 0 4px 18px rgba(0,0,0,.12)'
                  : isEdit
                  ? '0 0 0 2px #78AECB, 0 4px 16px rgba(0,0,0,.12)'
                  : '0 2px 12px rgba(0,0,0,.08)',
                cursor: drag?.itemId === item.id ? 'grabbing' : 'grab',
                userSelect: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: isImg ? 'visible' : 'hidden',
                zIndex: 2,
              }}>
              {isImg ? (
                item.imageData
                  ? <img src={item.imageData} alt={item.content} draggable={false}
                      style={{ width: item.w, height: item.h, objectFit: 'cover', borderRadius: 14, display: 'block', boxShadow: '0 2px 12px rgba(0,0,0,.10)' }} />
                  : <div style={{ width: item.w, height: item.h, background: '#F0F0F0', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 10, color: '#AAAAAA' }}>Image</span>
                    </div>
              ) : isTag ? (
                <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: tc, padding: '0 18px', textAlign: 'center' }}>
                  {item.content}
                </span>
              ) : item.itemType === 'title' ? (
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 26, fontWeight: 400, lineHeight: 1.15, margin: 0, color: tc, textAlign: 'center', padding: '14px 20px', wordBreak: 'break-word' }}>
                  {item.content}
                </p>
              ) : isQ ? (
                <p style={{ fontFamily: 'Recoleta, serif', fontSize: 17, lineHeight: 1.35, margin: 0, color: tc, textAlign: 'center', padding: '20px 22px', wordBreak: 'break-word' }}>
                  {item.content}
                </p>
              ) : item.itemType === 'note' ? (
                <p style={{ fontSize: 11, lineHeight: 1.6, margin: 0, color: tc, opacity: 0.75, textAlign: 'center', padding: '12px 14px', wordBreak: 'break-word' }}>
                  {item.content}
                </p>
              ) : (
                <p style={{ fontSize: 13, lineHeight: 1.6, margin: 0, color: tc, textAlign: 'center', padding: '12px 14px', wordBreak: 'break-word' }}>
                  {item.content}
                </p>
              )}
            </div>
          )
        })}

        {/* Edit popup — rendered inside canvas so overflow:visible keeps it unclipped */}
        {editingId != null && editingItem && capturedRef.current && (
          <EditPopup
            capturedItem={capturedRef.current}
            liveItem={editingItem}
            canvasEl={canvasRef.current}
            onClose={() => setEditingId(null)} />
        )}

        {/* Image drop overlay */}
        {addingImage && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onDragEnter={e => { e.preventDefault(); e.stopPropagation(); overlayDragCountRef.current++; setImageDropActive(true) }}
            onDragOver={e => { e.preventDefault(); e.stopPropagation() }}
            onDragLeave={e => { e.stopPropagation(); overlayDragCountRef.current--; if (overlayDragCountRef.current <= 0) { overlayDragCountRef.current = 0; setImageDropActive(false) } }}
            onDrop={async e => {
              e.preventDefault(); e.stopPropagation()
              overlayDragCountRef.current = 0; setImageDropActive(false); setAddingImage(false)
              await addImages(e.dataTransfer.files)
            }}
            style={{
              position: 'absolute', inset: 0, zIndex: 300,
              background: 'rgba(250,250,250,0.94)',
              borderRadius: 20,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
            }}>
            <div style={{
              width: 300,
              border: `2px dashed ${imageDropActive ? '#78AECB' : '#CCCCCC'}`,
              borderRadius: 20, padding: '36px 28px', textAlign: 'center',
              background: imageDropActive ? '#EFF7FF' : '#FFFFFF',
              boxShadow: '0 4px 20px rgba(0,0,0,.08)',
              transition: 'background 0.1s, border-color 0.1s',
              pointerEvents: 'none',
            }}>
              <p style={{ fontFamily: 'Recoleta, serif', fontSize: 18, margin: '0 0 6px', color: '#111111' }}>
                Drop image here
              </p>
              <p style={{ fontSize: 12, color: '#AAAAAA', margin: '0 0 20px' }}>JPEG · PNG · GIF · WEBP</p>
              <button onClick={() => fileRef.current?.click()}
                style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 11, color: '#666666', cursor: 'pointer', pointerEvents: 'auto' }}>
                or choose a file
              </button>
            </div>
            <button onClick={() => setAddingImage(false)}
              style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── BoardList ─────────────────────────────────────────────────────────────────

function BoardList({ onSelect }: { onSelect: (b: Board) => void }) {
  const dept = useActiveDept()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const boards = useLiveQuery(
    () => dept?.id == null ? [] : db.boards.where('departmentId').equals(dept.id).toArray(),
    [dept?.id],
  ) ?? []

  async function createBoard() {
    if (!newName.trim()) return
    const id = await db.boards.add({ departmentId: dept?.id, name: newName.trim(), boardType: 'Vision board', createdAt: Date.now() })
    setNewName(''); setAdding(false)
    const board = await db.boards.get(id)
    if (board) onSelect(board)
  }

  return (
    <Shell>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 10 }}>
        {/* Sidebar */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: '0 0 10px', padding: '0 8px' }}>Boards</p>
          {boards.map(b => (
            <button key={b.id} onClick={() => onSelect(b)}
              style={{ padding: '9px 10px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: '#111111' }}>{b.name}</div>
              <div style={{ fontSize: 9, color: '#AAAAAA', marginTop: 1 }}>{b.boardType ?? 'Board'}</div>
            </button>
          ))}
          {adding ? (
            <div style={{ padding: '8px 10px' }}>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Board name"
                onKeyDown={e => { if (e.key === 'Enter') void createBoard(); if (e.key === 'Escape') setAdding(false) }}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #EEE', background: '#F5F5F5', padding: '7px 10px', fontSize: 12, outline: 'none', marginBottom: 6, boxSizing: 'border-box' }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => void createBoard()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Create</button>
                <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAA', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              style={{ padding: '9px 10px', borderRadius: 10, border: '1px dashed #DDD', background: 'none', cursor: 'pointer', color: '#CCC', fontSize: 11 }}>
              + New board
            </button>
          )}
        </div>

        {/* Main grid */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          {boards.length === 0 ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: '#111', marginBottom: 8 }}>Vision boards</p>
              <p style={{ fontSize: 13, color: '#AAA', marginBottom: 24 }}>A freeform space for references, quotes and ideas.</p>
              <button onClick={() => setAdding(true)} style={{ background: '#F5E642', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Create your first board</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, width: '100%' }}>
              {boards.map(b => (
                <div key={b.id} onClick={() => onSelect(b)}
                  style={{ background: '#F5F5F5', borderRadius: 14, padding: '22px 20px', cursor: 'pointer', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <p style={{ fontFamily: 'Recoleta, serif', fontSize: 14, margin: 0, color: '#111' }}>{b.name}</p>
                  <p style={{ fontSize: 10, color: '#AAA', margin: '4px 0 0' }}>{b.boardType ?? 'Board'}</p>
                </div>
              ))}
              <div onClick={() => setAdding(true)}
                style={{ border: '1px dashed #DDD', borderRadius: 14, padding: '22px 20px', cursor: 'pointer', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: '#CCC' }}>+ New board</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

// ── export ────────────────────────────────────────────────────────────────────

export function VisionBoard() {
  const [activeBoard, setActiveBoard] = useState<Board | null>(null)

  if (activeBoard) {
    return (
      <Shell>
        <BoardCanvas board={activeBoard} onBack={() => setActiveBoard(null)} />
      </Shell>
    )
  }

  return <BoardList onSelect={setActiveBoard} />
}
