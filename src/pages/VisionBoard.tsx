import { useState, useRef, useCallback } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Board, type BoardItem } from '../db/db'
import { useActiveDept } from '../lib/useDept'
import { Shell } from '../components/layout/Shell'

const ITEM_COLORS = ['#F5E642', '#FFFFFF', '#111111', '#F5F5F5', '#E8C4B4', '#B8E0A4', '#A8C8E0', '#B898D8']

type DragState = { itemId: number; startX: number; startY: number; origX: number; origY: number }

function BoardCanvas({ board, onBack }: { board: Board; onBack: () => void }) {
  const items = useLiveQuery(() => db.boardItems.where('boardId').equals(board.id!).toArray(), [board.id]) ?? []
  const [adding, setAdding] = useState<null | 'text' | 'note' | 'quote' | 'tag'>(null)
  const [addContent, setAddContent] = useState('')
  const [addColor, setAddColor] = useState('#FFFFFF')
  const [drag, setDrag] = useState<DragState | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  async function addItem(type: BoardItem['itemType'], content: string, color: string) {
    if (!content.trim()) return
    const defaults: Record<string, { w: number; h: number }> = {
      quote: { w: 252, h: 100 }, note: { w: 200, h: 110 }, text: { w: 180, h: 60 }, tag: { w: 120, h: 44 },
    }
    const { w, h } = defaults[type] ?? { w: 180, h: 60 }
    await db.boardItems.add({ boardId: board.id!, itemType: type, content: content.trim(), x: 60 + Math.random() * 200, y: 60 + Math.random() * 200, w, h, color, createdAt: Date.now() })
    setAddContent('')
    setAdding(null)
  }

  const onMouseDown = useCallback((e: React.MouseEvent, item: BoardItem) => {
    if (!item.id) return
    e.preventDefault()
    setDrag({ itemId: item.id, startX: e.clientX, startY: e.clientY, origX: item.x, origY: item.y })
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    db.boardItems.update(drag.itemId, { x: drag.origX + dx, y: drag.origY + dy })
  }, [drag])

  const onMouseUp = useCallback(() => setDrag(null), [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)', minHeight: 500 }}>
      {/* Canvas header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer', padding: 0 }}>← Boards</button>
        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 16, marginLeft: 12, color: '#111111' }}>{board.name}</span>
        {/* Toolbar */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2, background: '#FFFFFF', borderRadius: 999, padding: '4px 6px', boxShadow: '0 2px 12px rgba(0,0,0,.10)' }}>
          {([['text', 'Text'], ['quote', 'Quote'], ['note', 'Note'], ['tag', 'Tag']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setAdding(adding === t ? null : t)}
              style={{ padding: '5px 11px', borderRadius: 999, border: 'none', background: adding === t ? '#F5F5F5' : 'none', fontSize: 10, fontWeight: 500, color: adding === t ? '#444444' : '#888888', cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Add item form */}
      {adding && (
        <div style={{ background: '#FFFFFF', borderRadius: 14, padding: '14px 16px', marginBottom: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            {adding === 'quote' ? (
              <textarea value={addContent} onChange={e => setAddContent(e.target.value)} placeholder='"Quote or thought…"' rows={2}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '8px 12px', fontSize: 13, outline: 'none', resize: 'none' }} />
            ) : (
              <input autoFocus value={addContent} onChange={e => setAddContent(e.target.value)} placeholder={adding === 'note' ? 'Note…' : adding === 'tag' ? 'Concept tag…' : 'Text…'}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '8px 12px', fontSize: 13, outline: 'none' }}
                onKeyDown={e => { if (e.key === 'Enter') void addItem(adding, addContent, addColor) }} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {ITEM_COLORS.slice(0, 5).map(c => (
              <button key={c} onClick={() => setAddColor(c)} style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: addColor === c ? '2px solid #111111' : '1.5px solid #EEEEEE', cursor: 'pointer' }} />
            ))}
          </div>
          <button onClick={() => void addItem(adding, addContent, addColor)} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Add</button>
          <button onClick={() => setAdding(null)} style={{ background: 'none', border: 'none', fontSize: 12, color: '#AAAAAA', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Canvas */}
      <div ref={canvasRef} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        style={{ flex: 1, background: '#FAFAFA', borderRadius: 20, position: 'relative', overflow: 'hidden', border: '1px solid #EEEEEE', cursor: drag ? 'grabbing' : 'default' }}>
        {/* Dot grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }}>
          <defs>
            <pattern id="grid-dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1" fill="#CCCCCC" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-dots)" />
        </svg>

        {items.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <p style={{ fontSize: 11, color: '#CCCCCC', letterSpacing: '0.08em' }}>Use the toolbar to add items</p>
          </div>
        )}

        {items.map(item => {
          const isQuote = item.itemType === 'quote'
          const isTag = item.itemType === 'tag'
          const isNote = item.itemType === 'note'
          const textColor = item.color === '#111111' ? '#FFFFFF' : '#111111'

          return (
            <div key={item.id} onMouseDown={e => onMouseDown(e, item)}
              style={{
                position: 'absolute', left: item.x, top: item.y, width: item.w,
                background: isNote ? '#FFFDE7' : item.color,
                borderRadius: isTag ? 999 : isQuote ? 20 : 14,
                padding: isTag ? '10px 18px' : isQuote ? '22px 24px' : '14px 16px',
                boxShadow: '0 2px 12px rgba(0,0,0,.08)',
                border: item.color === '#FFFFFF' ? '1px solid #EEEEEE' : isNote ? '1px solid #F5E642' : 'none',
                cursor: drag?.itemId === item.id ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}>
              {isQuote ? (
                <>
                  <p style={{ fontFamily: 'Recoleta, serif', fontSize: 18, lineHeight: 1.35, margin: 0, color: textColor }}>{item.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button onClick={() => db.boardItems.delete(item.id!)} style={{ background: 'none', border: 'none', fontSize: 10, color: '#CCCCCC', cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                </>
              ) : isTag ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: textColor }}>{item.content}</span>
                  <button onClick={() => db.boardItems.delete(item.id!)} style={{ background: 'none', border: 'none', fontSize: 10, color: textColor === '#FFFFFF' ? 'rgba(255,255,255,.5)' : '#CCCCCC', cursor: 'pointer', padding: 0, marginLeft: 4 }}>×</button>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 11, lineHeight: 1.6, color: '#555555', margin: 0 }}>{item.content}</p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                    <button onClick={() => db.boardItems.delete(item.id!)} style={{ background: 'none', border: 'none', fontSize: 10, color: '#CCCCCC', cursor: 'pointer', padding: 0 }}>×</button>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BoardList({ onSelect }: { onSelect: (b: Board) => void }) {
  const dept = useActiveDept()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const boards = useLiveQuery(() => dept?.id == null ? [] : db.boards.where('departmentId').equals(dept.id).toArray(), [dept?.id]) ?? []

  async function createBoard() {
    if (!newName.trim()) return
    const id = await db.boards.add({ departmentId: dept?.id, name: newName.trim(), createdAt: Date.now() })
    setNewName('')
    setAdding(false)
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
            <button key={b.id} onClick={() => onSelect(b)} style={{ padding: '9px 10px', borderRadius: 10, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: '#111111' }}>{b.name}</div>
              <div style={{ fontSize: 9, color: '#AAAAAA', marginTop: 1 }}>{b.boardType ?? 'Board'}</div>
            </button>
          ))}
          {adding ? (
            <div style={{ padding: '8px 10px' }}>
              <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Board name"
                onKeyDown={e => { if (e.key === 'Enter') void createBoard(); if (e.key === 'Escape') setAdding(false) }}
                style={{ width: '100%', borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 10px', fontSize: 12, outline: 'none', marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => void createBoard()} style={{ background: '#F5E642', border: 'none', borderRadius: 6, padding: '5px 10px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Create</button>
                <button onClick={() => setAdding(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#AAAAAA', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} style={{ padding: '9px 10px', borderRadius: 10, border: '1px dashed #DDDDDD', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#CCCCCC', fontSize: 11 }}>
              + New board
            </button>
          )}
        </div>

        {/* Main */}
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '28px 32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
          {boards.length === 0 ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: '#111111', marginBottom: 8 }}>Vision boards</p>
              <p style={{ fontSize: 13, color: '#AAAAAA', marginBottom: 24 }}>A freeform space for references, quotes and ideas.</p>
              <button onClick={() => setAdding(true)} style={{ background: '#F5E642', border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>Create your first board</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, width: '100%' }}>
              {boards.map(b => (
                <div key={b.id} onClick={() => onSelect(b)} style={{ background: '#F5F5F5', borderRadius: 14, padding: '22px 20px', cursor: 'pointer', minHeight: 120, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <p style={{ fontFamily: 'Recoleta, serif', fontSize: 14, margin: 0, color: '#111111' }}>{b.name}</p>
                  <p style={{ fontSize: 10, color: '#AAAAAA', margin: '4px 0 0' }}>{b.boardType ?? 'Board'}</p>
                </div>
              ))}
              <div onClick={() => setAdding(true)} style={{ background: 'transparent', border: '1px dashed #DDDDDD', borderRadius: 14, padding: '22px 20px', cursor: 'pointer', minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, color: '#CCCCCC' }}>+ New board</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Shell>
  )
}

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
