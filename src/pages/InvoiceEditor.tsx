import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, INVOICE_BLOCKS, type Invoice, type InvoiceBlock, type InvoiceDesign, type InvoiceLine, type InvoiceTemplate } from '../db/db'
import { Shell } from '../components/layout/Shell'
import { FrameHeader, FrameTabs } from '../components/FrameHeader'
import { pageFrame } from '../components/PageFrame'
import { parseAmount } from '../components/ContractCard'
import { CURRENCIES, addBtn, fieldLabel, inp, newId, quiet, saveBtn, today } from '../components/PaymentForm'
import { InvoiceStatusChip } from '../components/InvoiceStatusChip'
import { WordmarkPicker } from '../components/WordmarkPicker'
import { useNarrow } from '../lib/useNarrow'
import {
  BLOCK_NAME, LAYOUTS, addDays, deleteInvoice, designOf, fmt, invoiceDescription, invoiceHtml, invoiceStatus, invoiceTotals,
  nextInvoiceNo, printHtml, syncInvoicePayment,
} from '../lib/invoice'

const SWATCHES = ['#231F20', '#E8D44D', '#F0655A', '#3B6E8F', '#6B8F71', '#8A5A9E']
const group: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '18px 0 8px' }

type Draft = Omit<Invoice, 'lines'> & { lines: Array<InvoiceLine & { qtyText?: string; priceText?: string }> }

function Segmented<K extends string>({ value, options, onChange, label }: { value: K; options: Array<[K, string]>; onChange: (k: K) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} style={{ display: 'inline-flex', padding: 2, borderRadius: 8, background: 'var(--wa-fill)' }}>
      {options.map(([k, l]) => (
        <button key={k} role="radio" aria-checked={value === k} onClick={() => onChange(k)}
          style={{ padding: '5px 12px', border: 'none', borderRadius: 6, background: value === k ? 'var(--wa-surface)' : 'none', fontSize: 11, fontWeight: value === k ? 600 : 400, color: value === k ? 'var(--wa-ink)' : 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }}>
          {l}
        </button>
      ))}
    </div>
  )
}

// The invoice as it will print, scaled to the width it's given.
function Preview({ html, onEdit }: { html: string; onEdit?: () => void }) {
  const [hover, setHover] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!box.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(box.current)
    return () => ro.disconnect()
  }, [])
  const scale = Math.min(1, w / 794)
  return (
    <div ref={box} style={{ width: '100%' }}>
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ position: 'relative', width: 794 * scale, height: 1123 * scale, overflow: 'hidden', borderRadius: 6, boxShadow: hover && onEdit ? '0 0 0 3px var(--accent)' : '0 1px 3px rgba(0,0,0,.12)', background: '#fff', margin: '0 auto', transition: 'box-shadow .15s' }}>
        <iframe title="Invoice preview" srcDoc={html} style={{ width: 794, height: 1123, border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', background: '#fff', pointerEvents: 'none' }} />
        {onEdit && (
          <button onClick={onEdit} aria-label="Edit design" style={{ position: 'absolute', inset: 0, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
            <span style={{ position: 'absolute', top: 12, right: 12, padding: '6px 12px', borderRadius: 999, background: 'var(--accent)', color: '#111111', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-sans)', opacity: hover ? 1 : 0, transition: 'opacity .15s', boxShadow: '0 1px 4px rgba(0,0,0,.2)' }}>Edit design</span>
          </button>
        )}
      </div>
    </div>
  )
}

// The invoice page, at /finance/invoices/:id (new, or a number). ?from=<work id or "other">:<payment id> starts from a payment.
export function InvoiceEditor() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  return (
    <Shell>
      <InvoiceEditorPanel invoiceId={id ?? 'new'} from={params.get('from')} work={params.get('work')} onClose={() => navigate('/finance')} />
    </Shell>
  )
}

// The same editor over the Finance list, so an invoice can be changed without leaving it.
export function InvoicePopup(props: { invoiceId: string; from?: string | null; onClose: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Invoice" style={{ position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(17,17,17,.55)', overflowY: 'auto', padding: '24px 12px' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', background: 'var(--wa-page)', borderRadius: 20, padding: 16 }}>
        <InvoiceEditorPanel {...props} popup />
      </div>
    </div>,
    document.body,
  )
}

function InvoiceEditorPanel({ invoiceId, from: fromParam, work: workParam, onClose, popup = false }: {
  invoiceId: string
  from?: string | null
  work?: string | null
  onClose: () => void
  popup?: boolean
}) {
  const navigate = useNavigate()
  const [id, setId] = useState(invoiceId)
  const [askClose, setAskClose] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)
  const narrow = useNarrow('(max-width: 960px)')
  const depts = useLiveQuery(() => db.departments.toArray())
  const dept = depts === undefined ? undefined : depts[0] ?? null
  const works = useLiveQuery(() => db.works.toArray()) ?? []
  const contacts = useLiveQuery(() => db.contacts.toArray()) ?? []
  const [draft, setDraft] = useState<Draft | null>(null)
  const [tab, setTab] = useState<'details' | 'design'>('details')
  const [dirty, setDirty] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [savedNote, setSavedNote] = useState('')
  const [wordmarkDraft, setWordmarkDraft] = useState<string | null>(null) // typed but not yet saved to settings

  // Load the invoice, or start a new one from the studio's defaults (or from a Money card payment).
  useEffect(() => {
    if (draft || dept === undefined) return
    let cancelled = false
    void (async () => {
      if (id && id !== 'new') {
        const inv = await db.invoices.get(Number(id))
        if (!cancelled) inv ? setDraft(inv) : onClose()
        return
      }
      const s = dept?.invoiceSettings ?? {}
      const issued = today()
      const fresh: Draft = {
        departmentId: dept?.id, number: await nextInvoiceNo(), issued, due: addDays(issued, s.termsDays ?? 14),
        lines: [{ id: newId(), description: '', qty: 1, price: 0 }], currency: s.currency ?? '€', vatRate: s.vatRate, taxNote: s.taxNote, notes: s.notes,
        createdAt: Date.now(), updatedAt: Date.now(),
      }
      // From a payment: ?from=<workId or "other">:<paymentId>
      const from = fromParam
      if (from) {
        const [where, pid] = from.split(':')
        const work = where === 'other' ? undefined : works.find(w => w.id === Number(where)) ?? await db.works.get(Number(where))
        const p = (work ? work.payments : dept?.otherPayments)?.find(x => x.id === pid)
        if (p) {
          const [name, ...addr] = (p.payer ?? '').split('\n')
          Object.assign(fresh, {
            number: p.invoiceNo || fresh.number, issued: p.invoiced ?? issued, due: addDays(p.invoiced ?? issued, s.termsDays ?? 14),
            clientName: name?.trim(), clientAddress: addr.join('\n'), workId: work?.id, rightId: p.rightId, paymentId: p.id,
            currency: work ? work.contract?.currency ?? work.currency ?? '€' : p.currency ?? fresh.currency,
            lines: [{ id: newId(), description: work ? invoiceDescription(work, p) : p.label, qty: 1, price: p.amount ?? 0 }],
            sent: p.invoiced, paid: p.received,
          })
        }
      }
      if (workParam && fresh.workId == null) {
        const w = await db.works.get(Number(workParam))
        if (w) Object.assign(fresh, { workId: w.id, currency: w.contract?.currency ?? w.currency ?? fresh.currency, lines: [{ id: newId(), description: w.title, qty: 1, price: 0 }] })
      }
      if (!cancelled) { setDraft(fresh); setDirty(!!from) }
    })()
    return () => { cancelled = true }
  }, [id, dept, draft, fromParam, workParam, onClose, works])

  const design = useMemo(() => (draft ? designOf(draft, dept) : LAYOUTS[0].design), [draft, dept])
  const html = useMemo(() => (draft ? invoiceHtml(draft, dept, design) : ''), [draft, dept, design])

  if (!draft) return null

  const update = (patch: Partial<Draft>) => { setDraft(d => (d ? { ...d, ...patch } : d)); setDirty(true); setSavedNote('') }
  const setLine = (lid: string, patch: Partial<Draft['lines'][number]>) => update({ lines: draft.lines.map(l => (l.id === lid ? { ...l, ...patch } : l)) })
  const setDesign = (patch: Partial<InvoiceDesign>) => update({ design: { ...design, ...patch } })
  const work = draft.workId != null ? works.find(w => w.id === draft.workId) : undefined
  const { net, tax, total } = invoiceTotals(draft)
  const status = invoiceStatus(draft)
  const templates = dept?.invoiceSettings?.templates ?? []
  // Opens the Design tab; on a phone the form sits above the preview, so it scrolls up to it.
  const openDesign = () => { setTab('design'); if (narrow) formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }
  const nameGuess = dept?.invoiceFrom?.split('\n')[0]?.trim() || dept?.name || 'Your name'
  const wordmark = wordmarkDraft ?? dept?.invoiceSettings?.wordmark ?? ''
  const setWordmark = (v: string) => { setWordmarkDraft(v); void saveSettings({ wordmark: v.trim() || undefined }) }

  function clean(d: Draft): Invoice {
    return { ...d, lines: d.lines.map(({ qtyText: _q, priceText: _p, ...l }) => l), updatedAt: Date.now() }
  }

  async function save(patch: Partial<Draft> = {}) {
    const next = clean({ ...draft!, ...patch })
    const newId = await db.invoices.put(next) as number
    const paymentId = await syncInvoicePayment({ ...next, id: newId })
    await db.invoices.update(newId, { paymentId })
    setDraft({ ...next, id: newId, paymentId })
    setDirty(false)
    setAskClose(false)
    setSavedNote('Saved')
    if (id === 'new') {
      setId(String(newId))
      if (!popup) navigate(`/finance/invoices/${newId}`, { replace: true })
    }
    return newId
  }

  async function remove() {
    if (draft?.id != null) await deleteInvoice({ ...clean(draft), id: draft.id })
    onClose()
  }

  async function saveSettings(patch: Partial<NonNullable<typeof dept>['invoiceSettings']>) {
    if (dept?.id == null) return
    await db.departments.update(dept.id, { invoiceSettings: { ...(dept.invoiceSettings ?? {}), ...patch } })
  }

  async function saveTemplate() {
    const name = templateName.trim()
    if (!name) return
    const t: InvoiceTemplate = { id: newId(), name, design }
    await saveSettings({ templates: [...templates, t] })
    setTemplateName('')
    setSavedNote(`Saved as ${name}`)
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= design.blocks.length || from === to) return
    const blocks = [...design.blocks]
    const [b] = blocks.splice(from, 1)
    blocks.splice(to, 0, b)
    setDesign({ blocks })
  }
  const toggle = (b: InvoiceBlock) => {
    const hidden = new Set(design.hidden ?? [])
    if (hidden.has(b)) hidden.delete(b); else hidden.add(b)
    setDesign({ hidden: [...hidden] })
  }

  const details = (
    <div style={{ padding: '6px 20px 20px' }}>
      <p style={group}>Client</p>
      {contacts.length > 0 && (
        <select value={draft.contactId ?? ''} aria-label="From Contacts" style={{ ...inp, marginBottom: 8 }}
          onChange={e => {
            const c = contacts.find(x => x.id === Number(e.target.value))
            update(c ? { contactId: c.id, clientName: c.organisation || c.name, clientAddress: [c.organisation ? `Attn. ${c.name}` : '', c.address ?? ''].filter(Boolean).join('\n'), clientEmail: c.email } : { contactId: undefined })
          }}>
          <option value="">From Contacts…</option>
          {[...contacts].sort((a, b) => a.name.localeCompare(b.name)).map(c => <option key={c.id} value={c.id}>{[c.name, c.organisation].filter(Boolean).join(' · ')}</option>)}
        </select>
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        <input value={draft.clientName ?? ''} onChange={e => update({ clientName: e.target.value })} placeholder="Name or company" aria-label="Client name" style={inp} />
        <textarea value={draft.clientAddress ?? ''} onChange={e => update({ clientAddress: e.target.value })} rows={3} placeholder={'Street and number\nPostcode, city\nCountry'} aria-label="Client address" style={{ ...inp, resize: 'vertical' }} />
        <input value={draft.clientEmail ?? ''} onChange={e => update({ clientEmail: e.target.value })} placeholder="Email" aria-label="Client email" style={inp} />
      </div>

      <p style={group}>Invoice</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <label><span style={fieldLabel}>Number</span><input value={draft.number} onChange={e => update({ number: e.target.value })} style={inp} /></label>
        <label><span style={fieldLabel}>Currency</span>
          <select value={draft.currency} onChange={e => update({ currency: e.target.value })} style={inp}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
        </label>
        <label><span style={fieldLabel}>Date</span><input type="date" value={draft.issued} onChange={e => update({ issued: e.target.value })} style={inp} /></label>
        <label><span style={fieldLabel}>Due</span><input type="date" value={draft.due ?? ''} onChange={e => update({ due: e.target.value || undefined })} style={inp} /></label>
        <label style={{ gridColumn: '1 / -1' }}><span style={fieldLabel}>For</span>
          <select value={draft.workId ?? ''} onChange={e => update({ workId: e.target.value ? Number(e.target.value) : undefined, rightId: undefined })} style={inp}>
            <option value="">Not for a work</option>
            {[...works].filter(w => !w.inProgress).sort((a, b) => a.title.localeCompare(b.title)).map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
          </select>
        </label>
        {work?.rights?.length ? (
          <label style={{ gridColumn: '1 / -1' }}><span style={fieldLabel}>Edition or licence</span>
            <select value={draft.rightId ?? ''} onChange={e => update({ rightId: e.target.value || undefined })} style={inp}>
              <option value="">{work.title}</option>
              {work.rights.map(r => <option key={r.id} value={r.id}>{[r.language, r.publisher].filter(Boolean).join(' · ')}</option>)}
            </select>
          </label>
        ) : null}
      </div>

      <p style={group}>Lines</p>
      {draft.lines.map((l, i) => (
        <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 52px 84px 18px', gap: 6, alignItems: 'start', marginBottom: 6 }}>
          <textarea value={l.description} onChange={e => setLine(l.id, { description: e.target.value })} rows={1} placeholder={i === 0 ? 'Illustration licence, 3 images' : 'Description'} aria-label="Description" style={{ ...inp, resize: 'vertical' }} />
          <input value={l.qtyText ?? String(l.qty)} onChange={e => setLine(l.id, { qtyText: e.target.value, qty: parseAmount(e.target.value) ?? 0 })} inputMode="decimal" aria-label="Quantity" style={{ ...inp, textAlign: 'right' }} />
          <input value={l.priceText ?? (l.price ? String(l.price) : '')} onChange={e => setLine(l.id, { priceText: e.target.value, price: parseAmount(e.target.value) ?? 0 })} inputMode="decimal" placeholder="Price" aria-label="Price" style={{ ...inp, textAlign: 'right' }} />
          <button onClick={() => update({ lines: draft.lines.filter(x => x.id !== l.id) })} disabled={draft.lines.length === 1} aria-label="Remove line" style={{ ...quiet, fontSize: 14, paddingTop: 6, opacity: draft.lines.length === 1 ? 0.3 : 1 }}>×</button>
        </div>
      ))}
      <button onClick={() => update({ lines: [...draft.lines, { id: newId(), description: '', qty: 1, price: 0 }] })} style={addBtn}>+ Line</button>

      <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(0, 1fr)', gap: 8, marginTop: 14 }}>
        <label><span style={fieldLabel}>VAT %</span>
          <input value={draft.vatRate ?? ''} onChange={e => update({ vatRate: parseAmount(e.target.value) })} inputMode="decimal" placeholder="0" style={inp} /></label>
        <label><span style={fieldLabel}>Tax note</span>
          <input value={draft.taxNote ?? ''} onChange={e => update({ taxNote: e.target.value || undefined })} placeholder="Reverse charge" style={inp} /></label>
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: 'var(--wa-text-2)', textAlign: 'right', lineHeight: 1.8 }}>
        {draft.vatRate ? <>Net {fmt(net, draft.currency)} · VAT {fmt(tax, draft.currency)}<br /></> : null}
        <span style={{ color: 'var(--wa-ink)', fontWeight: 600 }}>Total {fmt(total, draft.currency)}</span>
      </div>

      <p style={group}>Notes</p>
      <textarea value={draft.notes ?? ''} onChange={e => update({ notes: e.target.value || undefined })} rows={2} placeholder="Thank you. Please pay within 14 days." aria-label="Notes" style={{ ...inp, resize: 'vertical' }} />

      <p style={group}>Status</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <label><span style={fieldLabel}>Sent</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={draft.sent ?? ''} onChange={e => update({ sent: e.target.value || undefined })} style={inp} />
            {!draft.sent && <button onClick={() => update({ sent: today() })} style={{ ...quiet, fontSize: 10 }}>Today</button>}
          </div>
        </label>
        <label><span style={fieldLabel}>Paid</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="date" value={draft.paid ?? ''} onChange={e => update({ paid: e.target.value || undefined })} style={inp} />
            {!draft.paid && <button onClick={() => update({ paid: today() })} style={{ ...quiet, fontSize: 10 }}>Today</button>}
          </div>
        </label>
      </div>

      {draft.id != null && (
        <div style={{ marginTop: 22 }}>
          {confirmDelete
            ? <span style={{ display: 'flex', gap: 12 }}><button onClick={() => void remove()} style={{ ...quiet, color: '#C53030' }}>Delete invoice</button><button onClick={() => setConfirmDelete(false)} style={quiet}>Keep</button></span>
            : <button onClick={() => setConfirmDelete(true)} style={quiet}>Delete</button>}
        </div>
      )}
    </div>
  )

  const designPanel = (
    <div style={{ padding: '6px 20px 20px' }}>
      <p style={group}>Layout</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {LAYOUTS.map(l => (
          <button key={l.key} onClick={() => update({ design: { ...l.design } })} aria-pressed={design.layout === l.key}
            style={{ ...addBtn, padding: '6px 12px', fontSize: 11, background: design.layout === l.key ? 'var(--wa-fill)' : 'none', color: design.layout === l.key ? 'var(--wa-ink)' : 'var(--wa-text-2)', fontWeight: design.layout === l.key ? 600 : 400 }}>
            {l.name}
          </button>
        ))}
      </div>
      {templates.length > 0 && <>
        <p style={group}>Your templates</p>
        {templates.map(t => (
          <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
            <button onClick={() => update({ design: { ...t.design } })} style={{ ...quiet, fontSize: 12, color: 'var(--wa-ink)', flex: 1, textAlign: 'left' }}>{t.name}</button>
            <button onClick={() => void saveSettings({ design: t.design })} style={{ ...quiet, fontSize: 10 }}>Make default</button>
            <button onClick={() => void saveSettings({ templates: templates.filter(x => x.id !== t.id) })} aria-label={`Delete ${t.name}`} style={{ ...quiet, fontSize: 13 }}>×</button>
          </div>
        ))}
      </>}

      <p style={group}>Type</p>
      <Segmented label="Type" value={design.font} options={[['sans', 'Sans'], ['serif', 'Serif']]} onChange={font => setDesign({ font })} />

      <p style={group}>Colour</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {SWATCHES.map(c => (
          <button key={c} onClick={() => setDesign({ accent: c })} aria-label={`Colour ${c}`} aria-pressed={design.accent.toLowerCase() === c.toLowerCase()}
            style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', boxShadow: design.accent.toLowerCase() === c.toLowerCase() ? '0 0 0 2px var(--wa-surface), 0 0 0 4px var(--wa-ink)' : 'inset 0 0 0 1px var(--wa-line-strong)' }} />
        ))}
        <label style={{ position: 'relative', width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--wa-line-strong)', background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)', cursor: 'pointer' }} title="Any colour">
          <input type="color" value={design.accent} onChange={e => setDesign({ accent: e.target.value })} aria-label="Any colour" style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
        </label>
      </div>

      <p style={group}>Logo</p>
      <Segmented label="Logo" value={design.logo} options={[['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]} onChange={logo => setDesign({ logo })} />
      {!dept?.invoiceSettings?.logo && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 11, color: 'var(--wa-text-2)', margin: '0 0 8px' }}>
            No logo. Set your name in a typeface instead, or <button onClick={() => navigate('/account')} style={{ ...quiet, fontSize: 11, color: 'var(--wa-ink)', textDecoration: 'underline' }}>upload one in Account</button>.
          </p>
          <WordmarkPicker name={wordmark} font={dept?.invoiceSettings?.wordmarkFont} placeholder={nameGuess}
            onName={v => setWordmark(v)}
            onFont={f => void saveSettings({ wordmarkFont: f, wordmark: wordmark.trim() || nameGuess })} />
        </div>
      )}

      <p style={group}>Sections</p>
      <p style={{ fontSize: 11, color: 'var(--wa-text-2)', margin: '-2px 0 8px' }}>Drag to reorder. Untick to leave out.</p>
      {design.blocks.map((b, i) => {
        const shown = !(design.hidden ?? []).includes(b)
        return (
          <div key={b} draggable onDragStart={() => setDragging(i)} onDragEnd={() => setDragging(null)}
            onDragOver={e => { e.preventDefault(); if (dragging != null && dragging !== i) { move(dragging, i); setDragging(i) } }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', marginBottom: 4, borderRadius: 8, background: dragging === i ? 'var(--wa-fill-2)' : 'var(--wa-fill)', cursor: 'grab', opacity: shown ? 1 : 0.55 }}>
            <span aria-hidden style={{ color: 'var(--wa-muted)', fontSize: 12, letterSpacing: -2 }}>⋮⋮</span>
            <input type="checkbox" checked={shown} onChange={() => toggle(b)} aria-label={`Show ${BLOCK_NAME[b]}`} />
            <span style={{ flex: 1, fontSize: 12, color: 'var(--wa-ink)' }}>{BLOCK_NAME[b]}</span>
            <button onClick={() => move(i, i - 1)} disabled={i === 0} aria-label="Move up" style={{ ...quiet, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
            <button onClick={() => move(i, i + 1)} disabled={i === design.blocks.length - 1} aria-label="Move down" style={{ ...quiet, opacity: i === design.blocks.length - 1 ? 0.3 : 1 }}>↓</button>
          </div>
        )
      })}
      {design.blocks.length < INVOICE_BLOCKS.length && (
        <button onClick={() => setDesign({ blocks: [...design.blocks, ...INVOICE_BLOCKS.filter(b => !design.blocks.includes(b))] })} style={addBtn}>Bring back missing sections</button>
      )}

      <p style={group}>Save this design</p>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name" aria-label="Template name" style={inp}
          onKeyDown={e => { if (e.key === 'Enter') void saveTemplate() }} />
        <button onClick={() => void saveTemplate()} disabled={!templateName.trim()} style={{ ...saveBtn, opacity: templateName.trim() ? 1 : 0.5, whiteSpace: 'nowrap' }}>Save template</button>
      </div>
      <button onClick={() => { void saveSettings({ design }); setSavedNote('Default for new invoices') }} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)', marginTop: 10, textDecoration: 'underline' }}>Use for new invoices</button>
    </div>
  )

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
        {popup
          ? <button onClick={() => (dirty ? setAskClose(true) : onClose())} aria-label="Close" style={{ ...quiet, fontSize: 20, lineHeight: 1, color: 'var(--wa-text-2)', padding: '0 4px' }}>×</button>
          : <button onClick={onClose} style={{ ...quiet, fontSize: 12, color: 'var(--wa-text-2)' }}>← Finance</button>}
        <span style={{ fontFamily: 'Recoleta, serif', fontSize: 20, color: 'var(--wa-ink)' }}>Invoice {draft.number}</span>
        <InvoiceStatusChip status={status} />
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {askClose ? <>
            <span style={{ fontSize: 11, color: 'var(--wa-ink)' }}>Not saved.</span>
            <button onClick={onClose} style={{ ...quiet, fontSize: 11, color: '#C53030' }}>Close anyway</button>
            <button onClick={() => setAskClose(false)} style={{ ...quiet, fontSize: 11 }}>Keep editing</button>
          </> : savedNote && !dirty && <span style={{ fontSize: 11, color: 'var(--wa-text-2)' }}>{savedNote}</span>}
          {popup && id !== 'new' && !dirty && <button onClick={() => navigate(`/finance/invoices/${id}`)} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)' }}>Full page</button>}
          <button onClick={() => printHtml(html)} style={{ ...addBtn, padding: '7px 12px', fontSize: 11 }}>Print or save PDF</button>
          <button onClick={() => void save()} disabled={!dirty && draft.id != null} style={{ ...saveBtn, padding: '8px 16px', fontSize: 11, opacity: !dirty && draft.id != null ? 0.5 : 1 }}>Save</button>
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr)' : 'minmax(0, 420px) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <div ref={formRef} style={pageFrame}>
          <FrameHeader>
            <FrameTabs label="Invoice" active={tab} onSelect={setTab} tabs={[{ key: 'details', label: 'Details' }, { key: 'design', label: 'Design' }]} />
          </FrameHeader>
          {tab === 'details' ? details : designPanel}
        </div>
        <div style={{ ...pageFrame, padding: narrow ? 12 : 20, position: narrow ? 'static' : 'sticky', top: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)' }}>Design</span>
            <Segmented label="Layout" value={design.layout} options={LAYOUTS.map(l => [l.key, l.name] as [InvoiceDesign['layout'], string])}
              onChange={k => update({ design: { ...LAYOUTS.find(l => l.key === k)!.design, logo: design.logo, blocks: design.blocks, hidden: design.hidden } })} />
            <span style={{ display: 'flex', gap: 5 }}>
              {SWATCHES.map(c => (
                <button key={c} onClick={() => setDesign({ accent: c })} aria-label={`Colour ${c}`} aria-pressed={design.accent.toLowerCase() === c.toLowerCase()}
                  style={{ width: 18, height: 18, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer', padding: 0, boxShadow: design.accent.toLowerCase() === c.toLowerCase() ? '0 0 0 2px var(--wa-surface), 0 0 0 4px var(--accent)' : 'inset 0 0 0 1px var(--wa-line-strong)' }} />
              ))}
            </span>
            <Segmented label="Type" value={design.font} options={[['sans', 'Sans'], ['serif', 'Serif']]} onChange={font => setDesign({ font })} />
            <button onClick={openDesign} style={{ ...quiet, marginLeft: 'auto', fontSize: 11, color: tab === 'design' ? 'var(--wa-muted)' : 'var(--wa-ink)', textDecoration: tab === 'design' ? 'none' : 'underline' }}>
              {tab === 'design' ? 'All options on the left' : 'More design options'}
            </button>
          </div>
          <Preview html={html} onEdit={openDesign} />
        </div>
      </div>
    </>
  )
}
