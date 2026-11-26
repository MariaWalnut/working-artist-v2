import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Payment, type Split, type Work } from '../db/db'
import { money, parseAmount } from './ContractCard'
import { formatAnyDate } from '../lib/eventDates'
import { readRaw } from '../lib/images'
import { printInvoice } from '../lib/invoice'
import { ClippingViewer } from './ClippingViewer'

const CURRENCIES = ['€', '$', '£', 'R$']
const MAX_PDF_BYTES = 20 * 1024 * 1024
const newId = () => Math.random().toString(36).slice(2, 10)
const today = () => new Date().toISOString().slice(0, 10)

const addBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--wa-line)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }
const quiet: React.CSSProperties = { flexShrink: 0, padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }
const label: React.CSSProperties = { fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
const subLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: 0 }
const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '7px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
const saveBtn: React.CSSProperties = { background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#111111', fontFamily: 'inherit' }

type Draft = { label: string; amount: string; payer: string; rightId: string; invoiceNo: string; invoiced: string; received: string; invoiceFile?: string; invoiceFileName?: string }
const toDraft = (p?: Payment): Draft => ({
  label: p?.label ?? '', amount: p?.amount != null ? String(p.amount) : '', payer: p?.payer ?? '', rightId: p?.rightId ?? '',
  invoiceNo: p?.invoiceNo ?? '', invoiced: p?.invoiced ?? '', received: p?.received ?? '', invoiceFile: p?.invoiceFile, invoiceFileName: p?.invoiceFileName,
})
const fromDraft = (id: string, d: Draft): Payment => ({
  id, label: d.label.trim() || 'Payment', amount: parseAmount(d.amount), payer: d.payer.trim() || undefined, rightId: d.rightId || undefined,
  invoiceNo: d.invoiceNo.trim() || undefined, invoiced: d.invoiced || undefined, received: d.received || undefined,
  invoiceFile: d.invoiceFile, invoiceFileName: d.invoiceFile ? d.invoiceFileName : undefined,
})

// Next invoice number after the highest one used anywhere in the studio: INV-2026-004 → INV-2026-005.
async function nextInvoiceNo() {
  const works = await db.works.toArray()
  const used = works.flatMap(w => (w.payments ?? []).map(p => p.invoiceNo ?? '')).filter(Boolean)
  const year = new Date().getFullYear()
  const n = used.map(s => Number(s.match(/(\d+)\s*$/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0)
  return `${year}-${String(n + 1).padStart(3, '0')}`
}

export function MoneyCard({ work }: { work: Work }) {
  const dept = useLiveQuery(() => (work.departmentId != null ? db.departments.get(work.departmentId) : db.departments.toCollection().first()), [work.departmentId])
  const payments = work.payments ?? []
  const splits = work.splits ?? []
  const rights = work.rights ?? []
  const currency = work.contract?.currency ?? work.currency ?? '€'

  const [editing, setEditing] = useState<string | null>(null) // a payment id, or 'new'
  const [draft, setDraft] = useState<Draft>(toDraft())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [viewing, setViewing] = useState<Payment | null>(null)
  const [editingSplit, setEditingSplit] = useState(false)
  const [splitDraft, setSplitDraft] = useState<Array<{ id: string; who: string; pct: string }>>([])
  const [askFrom, setAskFrom] = useState<Payment | null>(null)
  const [from, setFrom] = useState('')
  const [footer, setFooter] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const received = payments.filter(p => p.received).reduce((s, p) => s + (p.amount ?? 0), 0)
  const owed = payments.filter(p => !p.received).reduce((s, p) => s + (p.amount ?? 0), 0)
  const set = (k: keyof Draft, v: string) => setDraft(d => ({ ...d, [k]: v }))
  const save = (next: Payment[]) => db.works.update(work.id!, { payments: next } as Partial<Work>)

  async function startNew() {
    setDraft({ ...toDraft(), invoiceNo: await nextInvoiceNo() })
    setConfirmDelete(false)
    setEditing('new')
  }
  function startEdit(p: Payment) { setDraft(toDraft(p)); setConfirmDelete(false); setEditing(p.id) }

  async function savePayment() {
    if (!editing) return
    const p = fromDraft(editing === 'new' ? newId() : editing, draft)
    await save(editing === 'new' ? [...payments, p] : payments.map(x => (x.id === editing ? p : x)))
    setEditing(null)
    return p
  }

  async function deletePayment() {
    await save(payments.filter(x => x.id !== editing))
    setEditing(null)
  }

  async function attach(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return window.alert('An invoice has to be a PDF.')
    if (file.size > MAX_PDF_BYTES) return window.alert('That file is over 20 MB. Try a smaller scan or export.')
    const raw = (await readRaw(file)).replace(/^data:[^;,]*/, 'data:application/pdf')
    setDraft(d => ({ ...d, invoiceFile: raw, invoiceFileName: file.name }))
  }

  // Printing needs the artist's own details once; after that it prints straight away.
  async function print() {
    const p = await savePayment()
    if (!p) return
    if (!dept?.invoiceFrom?.trim()) { setFrom(dept?.name ?? ''); setFooter(dept?.invoiceFooter ?? ''); setAskFrom(p); return }
    printInvoice(work, p, dept, currency)
  }

  async function saveFromAndPrint() {
    if (!askFrom || dept?.id == null) return
    const next = { invoiceFrom: from.trim(), invoiceFooter: footer.trim() || undefined }
    await db.departments.update(dept.id, next)
    printInvoice(work, askFrom, { ...dept, ...next }, currency)
    setAskFrom(null)
  }

  function startSplit() {
    setSplitDraft(splits.length ? splits.map(s => ({ id: s.id, who: s.who, pct: String(s.pct) })) : [{ id: newId(), who: '', pct: '' }, { id: newId(), who: '', pct: '' }])
    setEditingSplit(true)
  }
  async function saveSplit() {
    const next: Split[] = splitDraft.map(s => ({ id: s.id, who: s.who.trim(), pct: parseAmount(s.pct) ?? 0 })).filter(s => s.who)
    await db.works.update(work.id!, { splits: next.length ? next : undefined } as Partial<Work>)
    setEditingSplit(false)
  }
  const splitTotal = splitDraft.reduce((s, x) => s + (parseAmount(x.pct) ?? 0), 0)

  const rightName = (id?: string) => (id ? rights.find(r => r.id === id)?.language : undefined)

  const form = (
    <div style={{ background: 'var(--wa-fill-2)', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
      <label style={{ gridColumn: '1 / -1' }}>
        <span style={label}>What for</span>
        <input autoFocus value={draft.label} onChange={e => set('label', e.target.value)} placeholder="Advance, first half" style={inp} />
      </label>
      <label>
        <span style={label}>Amount ({currency})</span>
        <input value={draft.amount} onChange={e => set('amount', e.target.value)} placeholder="2000" inputMode="decimal" style={inp} />
      </label>
      <label>
        <span style={label}>Invoice no.</span>
        <input value={draft.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} style={inp} />
      </label>
      <label style={{ gridColumn: '1 / -1' }}>
        <span style={label}>Who pays</span>
        <textarea value={draft.payer} onChange={e => set('payer', e.target.value)} rows={2} placeholder={'Little Lantern Books\n12 Quay Street, London'} style={{ ...inp, resize: 'vertical' }} />
      </label>
      {rights.length > 0 && (
        <label style={{ gridColumn: '1 / -1' }}>
          <span style={label}>For</span>
          <select value={draft.rightId} onChange={e => set('rightId', e.target.value)} style={inp}>
            <option value="">{work.title}</option>
            {rights.map(r => <option key={r.id} value={r.id}>{[r.language, r.publisher].filter(Boolean).join(' · ')}</option>)}
          </select>
        </label>
      )}
      <label>
        <span style={label}>Invoice sent</span>
        <input type="date" value={draft.invoiced} onChange={e => set('invoiced', e.target.value)} style={inp} />
      </label>
      <label>
        <span style={label}>Received</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" value={draft.received} onChange={e => set('received', e.target.value)} style={inp} />
          {!draft.received && <button onClick={() => set('received', today())} style={{ ...quiet, fontSize: 10 }}>Today</button>}
        </div>
      </label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {draft.invoiceFile ? <>
          <span style={{ fontSize: 12, color: 'var(--wa-ink)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '2px solid var(--accent)' }}>{draft.invoiceFileName ?? 'Invoice.pdf'}</span>
          <button onClick={() => fileRef.current?.click()} style={quiet}>Replace</button>
          <button onClick={() => setDraft(d => ({ ...d, invoiceFile: undefined, invoiceFileName: undefined }))} style={quiet}>Remove</button>
        </> : <button onClick={() => fileRef.current?.click()} style={addBtn}>+ Attach invoice PDF</button>}
        <button onClick={() => void print()} style={addBtn}>Print invoice</button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden aria-label="Invoice PDF" onChange={e => { void attach(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {editing !== 'new' ? (confirmDelete
          ? <span style={{ display: 'flex', gap: 10 }}><button onClick={() => void deletePayment()} style={{ ...quiet, color: '#C53030' }}>Delete</button><button onClick={() => setConfirmDelete(false)} style={quiet}>Keep</button></span>
          : <button onClick={() => setConfirmDelete(true)} style={quiet}>Delete</button>) : <span />}
        <span style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setEditing(null)} style={{ ...quiet, padding: '4px 6px' }}>Cancel</button>
          <button onClick={() => void savePayment()} style={saveBtn}>Save</button>
        </span>
      </div>
    </div>
  )

  return (
    <div style={{ background: 'var(--wa-surface)', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={subLabel}>Money</p>
        {!editing && <button onClick={() => void startNew()} style={addBtn}>+ Add</button>}
      </div>

      {payments.length > 0 && (
        <div style={{ display: 'flex', gap: 24, marginBottom: 12 }}>
          <div><span style={label}>Received</span><span style={{ fontFamily: 'Recoleta, serif', fontSize: 22, color: 'var(--wa-ink)' }}>{money(received, currency)}</span></div>
          {owed > 0 && <div><span style={label}>Owed</span><span style={{ fontFamily: 'Recoleta, serif', fontSize: 22, color: 'var(--wa-ink)' }}>{money(owed, currency)}</span></div>}
        </div>
      )}

      {editing === 'new' && form}
      {payments.map(p => editing === p.id ? <div key={p.id}>{form}</div> : (
        <button key={p.id} onClick={() => startEdit(p)} disabled={!!editing}
          style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 10, padding: '9px 0', border: 'none', borderBottom: '1px solid var(--wa-line)', background: 'none', textAlign: 'left', cursor: editing ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)' }}>{p.label}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>
              {[rightName(p.rightId), p.payer?.split('\n')[0], p.received ? `Received ${formatAnyDate(p.received)}` : p.invoiced ? `Invoiced ${formatAnyDate(p.invoiced)}` : 'Not invoiced', p.invoiceFile ? 'Invoice' : ''].filter(Boolean).join(' · ')}
            </span>
          </span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)', whiteSpace: 'nowrap' }}>{money(p.amount, currency)}</span>
          <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap',
            background: p.received ? 'var(--wa-fill)' : 'var(--accent)', color: p.received ? 'var(--wa-text-2)' : '#111111' }}>{p.received ? 'Paid' : 'Owed'}</span>
        </button>
      ))}
      {payments.length === 0 && editing !== 'new' && !work.currency && !work.contract && (
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--wa-muted)', marginBottom: 4 }}>
          Currency
          <select value={currency} onChange={e => void db.works.update(work.id!, { currency: e.target.value } as Partial<Work>)} style={{ ...inp, width: 'auto', padding: '3px 8px' }}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
      )}

      {payments.some(p => p.invoiceFile) && !editing && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 10 }}>
          {payments.filter(p => p.invoiceFile).map(p => (
            <button key={p.id} onClick={() => setViewing(p)} style={{ ...quiet, fontSize: 11, color: 'var(--wa-ink)' }}>
              <span style={{ borderBottom: '2px solid var(--accent)' }}>{p.invoiceFileName ?? `Invoice ${p.invoiceNo ?? ''}`}</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--wa-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <p style={subLabel}>Split</p>
          {editingSplit ? (
            <span style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setEditingSplit(false)} style={{ ...quiet, padding: '4px 6px' }}>Cancel</button>
              <button onClick={() => void saveSplit()} style={saveBtn}>Save</button>
            </span>
          ) : <button onClick={startSplit} style={addBtn}>{splits.length ? 'Edit' : '+ Add'}</button>}
        </div>
        {editingSplit ? (
          <>
            {splitDraft.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input autoFocus={i === 0} value={s.who} onChange={e => setSplitDraft(d => d.map(x => (x.id === s.id ? { ...x, who: e.target.value } : x)))} placeholder={i === 0 ? 'You' : 'Who'} aria-label="Who" style={{ ...inp, flex: 1 }} />
                <input value={s.pct} onChange={e => setSplitDraft(d => d.map(x => (x.id === s.id ? { ...x, pct: e.target.value } : x)))} placeholder="50" inputMode="decimal" aria-label="Share %" style={{ ...inp, width: 64 }} />
                <span style={{ fontSize: 11, color: 'var(--wa-muted)' }}>%</span>
                <button onClick={() => setSplitDraft(d => d.filter(x => x.id !== s.id))} aria-label="Remove" style={{ ...quiet, fontSize: 13 }}>×</button>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
              <button onClick={() => setSplitDraft(d => [...d, { id: newId(), who: '', pct: '' }])} style={addBtn}>+ Person</button>
              <span style={{ fontSize: 11, color: Math.round(splitTotal) === 100 ? 'var(--wa-text-2)' : '#C53030' }}>Total {splitTotal.toLocaleString('en-GB')}%</span>
            </div>
          </>
        ) : splits.map(s => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--wa-line)' }}>
            <span style={{ fontSize: 12, color: 'var(--wa-ink)' }}>{s.who} <span style={{ color: 'var(--wa-muted)' }}>{s.pct}%</span></span>
            {received > 0 && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)' }}>{money(Math.round(received * s.pct) / 100, currency)}</span>}
          </div>
        ))}
      </div>

      {askFrom && createPortal(
        <div role="dialog" aria-label="Your details on invoices" onClick={() => setAskFrom(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,17,17,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--wa-page)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontFamily: 'Recoleta, serif', fontSize: 20, fontWeight: 400, color: 'var(--wa-ink)', margin: '0 0 6px' }}>Your details on invoices</h2>
            <p style={{ fontSize: 12, color: 'var(--wa-text-2)', margin: '0 0 16px' }}>Asked once. Change them later in Account.</p>
            <label style={{ display: 'block', marginBottom: 10 }}>
              <span style={label}>From</span>
              <textarea autoFocus value={from} onChange={e => setFrom(e.target.value)} rows={4} placeholder={'Your name\nStreet and number\nPostcode, city\nTax number'} style={{ ...inp, resize: 'vertical' }} />
            </label>
            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={label}>Bank and tax lines</span>
              <textarea value={footer} onChange={e => setFooter(e.target.value)} rows={3} placeholder={'IBAN, BIC\nVAT note'} style={{ ...inp, resize: 'vertical' }} />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setAskFrom(null)} style={{ ...quiet, padding: '6px 8px' }}>Cancel</button>
              <button disabled={!from.trim()} onClick={() => void saveFromAndPrint()} style={{ ...saveBtn, padding: '7px 14px', opacity: from.trim() ? 1 : 0.5 }}>Save and print</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {viewing?.invoiceFile && <ClippingViewer entry={{ title: work.title, outlet: `Invoice ${viewing.invoiceNo ?? ''}`.trim(), clipping: viewing.invoiceFile, clippingName: viewing.invoiceFileName }} onClose={() => setViewing(null)} />}
    </div>
  )
}
