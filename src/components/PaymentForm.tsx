import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { db, type Department, type Payment, type RightItem } from '../db/db'
import { parseAmount } from './ContractCard'
import { readRaw } from '../lib/images'
import { printInvoice, type InvoiceFor } from '../lib/invoice'

export const CURRENCIES = ['€', '$', '£', 'R$']
const MAX_PDF_BYTES = 20 * 1024 * 1024
export const newId = () => Math.random().toString(36).slice(2, 10)
export const today = () => new Date().toISOString().slice(0, 10)

export const addBtn: React.CSSProperties = { background: 'none', border: '1px solid var(--wa-line)', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }
export const quiet: React.CSSProperties = { flexShrink: 0, padding: 0, border: 'none', background: 'none', fontSize: 11, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }
export const fieldLabel: React.CSSProperties = { fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
export const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '7px 10px', fontSize: 12, color: 'var(--wa-ink)', outline: 'none', width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
export const saveBtn: React.CSSProperties = { background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#111111', fontFamily: 'inherit' }

type Draft = { label: string; amount: string; currency: string; payer: string; rightId: string; invoiceNo: string; invoiced: string; received: string; invoiceFile?: string; invoiceFileName?: string }
const toDraft = (p: Partial<Payment>, currency: string): Draft => ({
  label: p.label ?? '', amount: p.amount != null ? String(p.amount) : '', currency: p.currency ?? currency, payer: p.payer ?? '', rightId: p.rightId ?? '',
  invoiceNo: p.invoiceNo ?? '', invoiced: p.invoiced ?? '', received: p.received ?? '', invoiceFile: p.invoiceFile, invoiceFileName: p.invoiceFileName,
})
const fromDraft = (id: string, d: Draft, ownCurrency: boolean): Payment => ({
  id, label: d.label.trim() || 'Payment', amount: parseAmount(d.amount), payer: d.payer.trim() || undefined, rightId: d.rightId || undefined,
  invoiceNo: d.invoiceNo.trim() || undefined, invoiced: d.invoiced || undefined, received: d.received || undefined,
  invoiceFile: d.invoiceFile, invoiceFileName: d.invoiceFile ? d.invoiceFileName : undefined,
  currency: ownCurrency ? d.currency : undefined,
})

// One payment's fields: on a work's Money card, and on Finance for money outside works.
// `ownCurrency` lets the payment carry its own currency (outside works); a work's payments use the work's.
export function PaymentForm({ payment, currency, ownCurrency = false, rights = [], workTitle, placeholder = 'Advance, first half', onSave, onDelete, onPrint, onCancel }: {
  payment: Partial<Payment> & { id?: string }
  currency: string
  ownCurrency?: boolean
  rights?: RightItem[]
  workTitle?: string
  placeholder?: string
  onSave: (p: Payment) => Promise<unknown>
  onDelete?: () => Promise<unknown>
  onPrint: (p: Payment) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(payment, currency))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [id] = useState(() => payment.id ?? newId())
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof Draft, v: string) => setDraft(d => ({ ...d, [k]: v }))

  async function save() {
    const p = fromDraft(id, draft, ownCurrency)
    await onSave(p)
    return p
  }

  async function attach(file?: File) {
    if (!file) return
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return window.alert('An invoice has to be a PDF.')
    if (file.size > MAX_PDF_BYTES) return window.alert('That file is over 20 MB. Try a smaller scan or export.')
    const raw = (await readRaw(file)).replace(/^data:[^;,]*/, 'data:application/pdf')
    setDraft(d => ({ ...d, invoiceFile: raw, invoiceFileName: file.name }))
  }

  const shown = ownCurrency ? draft.currency : currency

  return (
    <div style={{ background: 'var(--wa-fill-2)', borderRadius: 10, padding: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
      <label style={{ gridColumn: '1 / -1' }}>
        <span style={fieldLabel}>What for</span>
        <input autoFocus value={draft.label} onChange={e => set('label', e.target.value)} placeholder={placeholder} style={inp} />
      </label>
      <label>
        <span style={fieldLabel}>{ownCurrency ? 'Amount' : `Amount (${shown})`}</span>
        <div style={{ display: 'flex', gap: 6 }}>
          {ownCurrency && (
            <select value={draft.currency} onChange={e => set('currency', e.target.value)} aria-label="Currency" style={{ ...inp, width: 'auto', padding: '7px 6px' }}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <input value={draft.amount} onChange={e => set('amount', e.target.value)} placeholder="2000" inputMode="decimal" style={inp} />
        </div>
      </label>
      <label>
        <span style={fieldLabel}>Invoice no.</span>
        <input value={draft.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} style={inp} />
      </label>
      <label style={{ gridColumn: '1 / -1' }}>
        <span style={fieldLabel}>Who pays</span>
        <textarea value={draft.payer} onChange={e => set('payer', e.target.value)} rows={2} placeholder={'Little Lantern Books\n12 Quay Street, London'} style={{ ...inp, resize: 'vertical' }} />
      </label>
      {rights.length > 0 && (
        <label style={{ gridColumn: '1 / -1' }}>
          <span style={fieldLabel}>For</span>
          <select value={draft.rightId} onChange={e => set('rightId', e.target.value)} style={inp}>
            <option value="">{workTitle}</option>
            {rights.map(r => <option key={r.id} value={r.id}>{[r.language, r.publisher].filter(Boolean).join(' · ')}</option>)}
          </select>
        </label>
      )}
      <label>
        <span style={fieldLabel}>Invoice sent</span>
        <input type="date" value={draft.invoiced} onChange={e => set('invoiced', e.target.value)} style={inp} />
      </label>
      <label>
        <span style={fieldLabel}>Received</span>
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
        <button onClick={() => void save().then(onPrint)} style={addBtn}>Print invoice</button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" hidden aria-label="Invoice PDF" onChange={e => { void attach(e.target.files?.[0]); e.target.value = '' }} />
      </div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {onDelete ? (confirmDelete
          ? <span style={{ display: 'flex', gap: 10 }}><button onClick={() => void onDelete()} style={{ ...quiet, color: '#C53030' }}>Delete</button><button onClick={() => setConfirmDelete(false)} style={quiet}>Keep</button></span>
          : <button onClick={() => setConfirmDelete(true)} style={quiet}>Delete</button>) : <span />}
        <span style={{ display: 'flex', gap: 6 }}>
          <button onClick={onCancel} style={{ ...quiet, padding: '4px 6px' }}>Cancel</button>
          <button onClick={() => void save()} style={saveBtn}>Save</button>
        </span>
      </div>
    </div>
  )
}

// Printing needs the artist's own details once; after that it prints straight away.
// Returns print() and the dialog that asks for those details, to render alongside.
export function useInvoicePrinter(dept: Department | null | undefined) {
  const [ask, setAsk] = useState<{ work: InvoiceFor; p: Payment; currency: string } | null>(null)
  const [from, setFrom] = useState('')
  const [footer, setFooter] = useState('')

  function print(work: InvoiceFor, p: Payment, currency: string) {
    if (!dept?.invoiceFrom?.trim()) { setFrom(dept?.name ?? ''); setFooter(dept?.invoiceFooter ?? ''); setAsk({ work, p, currency }); return }
    printInvoice(work, p, dept, currency)
  }

  async function saveAndPrint() {
    if (!ask || dept?.id == null) return
    const next = { invoiceFrom: from.trim(), invoiceFooter: footer.trim() || undefined }
    await db.departments.update(dept.id, next)
    printInvoice(ask.work, ask.p, { ...dept, ...next }, ask.currency)
    setAsk(null)
  }

  const dialog = ask && createPortal(
    <div role="dialog" aria-label="Your details on invoices" onClick={() => setAsk(null)} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(17,17,17,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--wa-page)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420 }}>
        <h2 style={{ fontFamily: 'Recoleta, serif', fontSize: 20, fontWeight: 400, color: 'var(--wa-ink)', margin: '0 0 6px' }}>Your details on invoices</h2>
        <p style={{ fontSize: 12, color: 'var(--wa-text-2)', margin: '0 0 16px' }}>Asked once. Change them later in Account.</p>
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={fieldLabel}>From</span>
          <textarea autoFocus value={from} onChange={e => setFrom(e.target.value)} rows={4} placeholder={'Your name\nStreet and number\nPostcode, city\nTax number'} style={{ ...inp, resize: 'vertical' }} />
        </label>
        <label style={{ display: 'block', marginBottom: 16 }}>
          <span style={fieldLabel}>Bank and tax lines</span>
          <textarea value={footer} onChange={e => setFooter(e.target.value)} rows={3} placeholder={'IBAN, BIC\nVAT note'} style={{ ...inp, resize: 'vertical' }} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setAsk(null)} style={{ ...quiet, padding: '6px 8px' }}>Cancel</button>
          <button disabled={!from.trim()} onClick={() => void saveAndPrint()} style={{ ...saveBtn, padding: '7px 14px', opacity: from.trim() ? 1 : 0.5 }}>Save and print</button>
        </div>
      </div>
    </div>,
    document.body,
  )

  return { print, dialog }
}
