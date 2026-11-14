import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type BoardItem } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { useNarrow } from '../lib/useNarrow'
import { Shell } from '../components/layout/Shell'
import { AddButton, FrameTitle } from '../components/PageFrame'
import { RecognitionList, RightsList } from '../components/CareerLists'
import { TimelineView } from './Career'
import { WorldMapPanel } from './WorldMap'

// Career on one page: boxes that can be moved, resized, removed and added back, like the desk.
// Each studio keeps its own arrangement, in a board of type 'career'. A box stores its column in x,
// its width in columns in w, its height in px in h, and its place in the stacking order in y.

type BoxType = 'timeline' | 'map' | 'recognition' | 'rights'

const BOXES: Record<BoxType, { title: string; full?: string; x: number; y: number; w: number; h: number }> = {
  timeline: { title: 'Timeline', full: '/career/timeline', x: 0, y: 0, w: 4, h: 384 },
  map: { title: 'Map', full: '/career/map', x: 0, y: 1, w: 2, h: 408 },
  recognition: { title: 'Recognition', full: '/career/recognition', x: 2, y: 1, w: 1, h: 408 },
  rights: { title: 'Rights sold', x: 3, y: 1, w: 1, h: 408 },
}
const ORDER = Object.keys(BOXES) as BoxType[]

const COLS = 4
const GAP = 12
const GRID = 24
const HEAD = 46
const MIN_H = 168

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const snap = (n: number) => Math.round(n / GRID) * GRID

// Boxes never overlap: in each column they stack in order, one GAP apart. Returns each box's top.
function pack(boxes: Array<{ id: number; col: number; span: number; key: number; h: number }>) {
  const bottom = Array<number>(COLS).fill(-GAP)
  const tops = new Map<number, number>()
  for (const b of [...boxes].sort((a, c) => a.key - c.key || a.col - c.col || a.id - c.id)) {
    const top = Math.max(...bottom.slice(b.col, b.col + b.span)) + GAP
    for (let c = b.col; c < b.col + b.span; c++) bottom[c] = top + b.h
    tops.set(b.id, top)
  }
  return tops
}

interface Geo { left: number; top: number; width: number; height: number }
interface Drag extends Geo { id: number; mode: 'move' | 'resize'; sx: number; sy: number; moved: boolean }

function content(t: BoxType): ReactNode {
  if (t === 'timeline') return <TimelineView compact />
  if (t === 'map') return <WorldMapPanel compact />
  if (t === 'recognition') return <RecognitionList />
  return <RightsList />
}

export function CareerBoard() {
  const dept = useActiveDept()
  const deptId = dept?.id
  const navigate = useNavigate()
  const narrow = useNarrow('(max-width: 900px)')

  const board = useLiveQuery(
    async () => deptId == null ? undefined : (await db.boards.where('departmentId').equals(deptId).filter(b => b.boardType === 'career').first()) ?? null,
    [deptId],
  )
  const boardId = board?.id
  const items = useLiveQuery(async () => boardId == null ? undefined : await db.boardItems.where('boardId').equals(boardId).toArray(), [boardId])

  // First visit: every box, in its usual place.
  useEffect(() => {
    if (board !== null || deptId == null) return
    void db.transaction('rw', db.boards, db.boardItems, async () => {
      if (await db.boards.where('departmentId').equals(deptId).filter(b => b.boardType === 'career').first()) return
      const id = await db.boards.add({ departmentId: deptId, name: 'Career', boardType: 'career', createdAt: Date.now() }) as number
      const now = Date.now()
      await db.boardItems.bulkAdd(ORDER.map(t => ({ boardId: id, itemType: t, content: '', x: BOXES[t].x, y: BOXES[t].y, w: BOXES[t].w, h: BOXES[t].h, createdAt: now })))
    })
  }, [board, deptId])

  const boxes = (items ?? []).filter(i => (ORDER as string[]).includes(i.itemType))
  const missing = ORDER.filter(t => !boxes.some(i => i.itemType === t))

  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const canvasRef = useCallback((el: HTMLDivElement | null) => {
    observer.current?.disconnect()
    if (!el) return
    setWidth(el.clientWidth)
    observer.current = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.current.observe(el)
  }, [])

  const colW = Math.max(100, (width - (COLS - 1) * GAP) / COLS)
  const colLeft = (c: number) => c * (colW + GAP)
  const spanWidth = (n: number) => n * colW + (n - 1) * GAP
  const colAt = (left: number, span: number) => clamp(Math.round(left / (colW + GAP)), 0, COLS - span)
  const spanFor = (w: number, col: number) => clamp(Math.round((w + GAP) / (colW + GAP)), 1, COLS - col)

  const dragRef = useRef<Drag | null>(null)
  const [live, setLive] = useState<(Geo & { id: number; mode: 'move' | 'resize' }) | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)

  const rest = pack(boxes.map(i => ({ id: i.id!, col: i.x, span: i.w, key: i.y, h: i.h })))
  const dropTops = (id: number, left: number, top: number, height: number) =>
    pack(boxes.map(i => i.id === id
      ? { id, col: colAt(left, i.w), span: i.w, key: top, h: height }
      : { id: i.id!, col: i.x, span: i.w, key: rest.get(i.id!) ?? 0, h: i.h }))
  const liveBox = live ? boxes.find(i => i.id === live.id) : undefined
  // While a box is being resized, the others make room for its new size as it changes.
  const resizeTops = (id: number, width: number, height: number) =>
    pack(boxes.map(i => i.id === id
      ? { id, col: i.x, span: spanFor(width, i.x), key: rest.get(id) ?? 0, h: Math.max(MIN_H, snap(height)) }
      : { id: i.id!, col: i.x, span: i.w, key: rest.get(i.id!) ?? 0, h: i.h }))
  const tops = !live || !liveBox ? rest
    : live.mode === 'move' ? dropTops(live.id, live.left, live.top, live.height)
    : resizeTops(live.id, live.width, live.height)
  const canvasH = Math.max(320, ...boxes.map(i => (tops.get(i.id!) ?? 0) + (live && live.id === i.id && live.mode === 'resize' ? live.height : i.h))) + GAP

  function start(e: React.PointerEvent<HTMLElement>, item: BoardItem, mode: 'move' | 'resize') {
    if (narrow || e.button !== 0 || item.id == null) return
    if (mode === 'move' && (e.target as HTMLElement).closest('button,a,input')) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { id: item.id, mode, sx: e.clientX, sy: e.clientY, moved: false, left: colLeft(item.x), top: tops.get(item.id) ?? 0, width: spanWidth(item.w), height: item.h }
  }

  function geometry(d: Drag, e: React.PointerEvent): Geo & { id: number; mode: 'move' | 'resize' } {
    const dx = e.clientX - d.sx
    const dy = e.clientY - d.sy
    return d.mode === 'move'
      ? { id: d.id, mode: d.mode, left: clamp(d.left + dx, 0, Math.max(0, width - d.width)), top: Math.max(0, d.top + dy), width: d.width, height: d.height }
      : { id: d.id, mode: d.mode, left: d.left, top: d.top, width: clamp(d.width + dx, colW, width - d.left), height: Math.max(MIN_H, d.height + dy) }
  }

  function move(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
    d.moved = true
    setLive(geometry(d, e))
  }

  async function end(e: React.PointerEvent, item: BoardItem) {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !d.moved) { setLive(null); return }
    const g = geometry(d, e)
    if (d.mode === 'move') {
      // Every box is saved at its packed top, so the order on the page is the order kept.
      const final = dropTops(d.id, g.left, g.top, d.height)
      await db.transaction('rw', db.boardItems, async () => {
        for (const i of boxes) {
          const y = final.get(i.id!) ?? i.y
          if (i.id === d.id) await db.boardItems.update(d.id, { x: colAt(g.left, item.w), y })
          else if (y !== i.y) await db.boardItems.update(i.id!, { y })
        }
      })
    } else {
      await db.boardItems.update(d.id, { w: spanFor(g.width, item.x), h: Math.max(MIN_H, snap(g.height)) })
    }
    setLive(null)
  }

  async function add(t: BoxType) {
    if (boardId == null) return
    setAdding(false)
    const w = BOXES[t].w
    const bottom = Math.max(0, ...boxes.map(i => (rest.get(i.id!) ?? 0) + i.h))
    await db.boardItems.add({ boardId, itemType: t, content: '', x: 0, y: bottom + GAP, w, h: BOXES[t].h, createdAt: Date.now() })
  }

  const preview = live && liveBox ? (live.mode === 'move'
    ? { left: colLeft(colAt(live.left, liveBox.w)), top: tops.get(liveBox.id!) ?? 0, width: spanWidth(liveBox.w), height: live.height }
    : { left: live.left, top: tops.get(liveBox.id!) ?? live.top, width: spanWidth(spanFor(live.width, liveBox.x)), height: Math.max(MIN_H, snap(live.height)) }) : null

  const smallBtn: React.CSSProperties = { padding: 0, border: 'none', background: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }

  function renderBox(item: BoardItem) {
    const t = item.itemType as BoxType
    const def = BOXES[t]
    const mine = live?.id === item.id ? live : null
    const style: React.CSSProperties = narrow
      ? { position: 'relative', height: t === 'timeline' || t === 'map' ? clamp(item.h, 320, 520) : undefined, maxHeight: 520 }
      : {
          position: 'absolute', left: mine ? mine.left : colLeft(item.x), top: mine ? mine.top : tops.get(item.id!) ?? 0,
          width: mine ? mine.width : spanWidth(item.w), height: mine ? mine.height : item.h, zIndex: mine ? 30 : 1,
          transition: mine ? 'none' : 'top .18s ease, left .18s ease, width .18s ease, height .18s ease',
        }
    return (
      <div key={item.id} data-career-box={t} style={{ ...style, display: 'flex', flexDirection: 'column', background: 'var(--wa-surface)', borderRadius: 20, overflow: 'hidden', boxShadow: mine ? '0 14px 36px rgba(0,0,0,.16)' : 'none' }}
        onPointerEnter={() => setHovered(item.id!)} onPointerLeave={() => setHovered(h => (h === item.id ? null : h))}>
        <div onPointerDown={e => start(e, item, 'move')} onPointerMove={move} onPointerUp={e => void end(e, item)} onPointerCancel={() => { dragRef.current = null; setLive(null) }}
          style={{ height: HEAD, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', borderBottom: '1px solid var(--wa-line)', cursor: narrow ? 'default' : mine ? 'grabbing' : 'grab', touchAction: 'none', userSelect: 'none' }}>
          <span style={{ fontFamily: 'Recoleta, serif', fontSize: 16, color: 'var(--wa-ink)' }}>{def.title}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {def.full && <button onClick={() => navigate(def.full!)} aria-label={`Full view of ${def.title}`} title="Full view" style={{ ...smallBtn, display: 'flex', padding: 2 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" fill="none" stroke="var(--wa-text-2)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 1.5h4v4M12.5 1.5L8 6M5.5 12.5h-4v-4M1.5 12.5L6 8" />
              </svg>
            </button>}
            {(hovered === item.id || narrow) && !mine && (
              <button aria-label={`Remove ${def.title}`} title="Remove" onClick={() => void db.boardItems.delete(item.id!)} style={{ ...smallBtn, fontSize: 16, lineHeight: 1 }}>×</button>
            )}
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: t === 'map' ? 'hidden' : 'auto' }}>{content(t)}</div>
        {!narrow && (hovered === item.id || mine?.mode === 'resize') && (
          <div aria-hidden="true" onPointerDown={e => start(e, item, 'resize')} onPointerMove={move} onPointerUp={e => void end(e, item)}
            style={{ position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, cursor: 'nwse-resize', touchAction: 'none', zIndex: 3, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: 5, boxSizing: 'border-box' }}>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M9 1L1 9M9 5L5 9" stroke="var(--wa-text-2)" strokeWidth="1.4" strokeLinecap="round" /></svg>
          </div>
        )}
      </div>
    )
  }

  const ordered = [...boxes].sort((a, b) => (rest.get(a.id!) ?? 0) - (rest.get(b.id!) ?? 0) || a.x - b.x)

  return (
    <Shell>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12, minHeight: 36 }}>
        <FrameTitle>Career</FrameTitle>
        <button onClick={() => navigate('/career/profile')} style={smallBtn}>Profile</button>
        {missing.length > 0 && (
          <span style={{ marginLeft: 'auto', position: 'relative' }}>
            <AddButton onClick={() => setAdding(a => !a)} />
            {adding && (
              <div style={{ position: 'absolute', right: 0, top: 40, zIndex: 50, minWidth: 180, background: 'var(--wa-surface)', borderRadius: 14, boxShadow: '0 14px 44px rgba(0,0,0,.16)', padding: 6 }}>
                {missing.map(t => (
                  <button key={t} onClick={() => void add(t)}
                    style={{ display: 'block', width: '100%', padding: '9px 12px', border: 'none', borderRadius: 8, background: 'none', textAlign: 'left', fontSize: 13, color: 'var(--wa-ink)', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {BOXES[t].title}
                  </button>
                ))}
              </div>
            )}
          </span>
        )}
      </div>

      {narrow ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{ordered.map(renderBox)}</div>
      ) : (
        <div ref={canvasRef} style={{ position: 'relative', height: canvasH }}>
          {preview && (
            <div aria-hidden="true" style={{ position: 'absolute', ...preview, borderRadius: 20, border: '1.5px dashed var(--wa-text-2)', pointerEvents: 'none' }} />
          )}
          {width > 0 && boxes.map(renderBox)}
        </div>
      )}
      {items !== undefined && boxes.length === 0 && (
        <p style={{ margin: '40px 0', textAlign: 'center', fontSize: 13, color: 'var(--wa-text-2)' }}>Add a box to start.</p>
      )}
    </Shell>
  )
}
