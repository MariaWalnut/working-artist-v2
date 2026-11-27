import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Payment, type Split, type Work } from '../db/db'
import { money, parseAmount } from './ContractCard'
import { formatAnyDate } from '../lib/eventDates'
import { nextInvoiceNo } from '../lib/invoice'
import { ClippingViewer } from './ClippingViewer'
import { CURRENCIES, PaymentForm, addBtn, inp, newId, quiet, saveBtn, useInvoicePrinter } from './PaymentForm'

const label: React.CSSProperties = { fontSize: 9, color: 'var(--wa-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }
const subLabel: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: 0 }

export function MoneyCard({ work }: { work: Work }) {
  const dept = useLiveQuery(() => (work.departmentId != null ? db.departments.get(work.departmentId) : db.departments.toCollection().first()), [work.departmentId])
  const payments = work.payments ?? []
  const splits = work.splits ?? []
  const rights = work.rights ?? []
  const currency = work.contract?.currency ?? work.currency ?? '€'

  const [editing, setEditing] = useState<string | null>(null) // a payment id, or 'new'
  const [newNo, setNewNo] = useState('')
  const [viewing, setViewing] = useState<Payment | null>(null)
  const [editingSplit, setEditingSplit] = useState(false)
  const [splitDraft, setSplitDraft] = useState<Array<{ id: string; who: string; pct: string }>>([])
  const printer = useInvoicePrinter(dept)

  const received = payments.filter(p => p.received).reduce((s, p) => s + (p.amount ?? 0), 0)
  const owed = payments.filter(p => !p.received).reduce((s, p) => s + (p.amount ?? 0), 0)
  const save = (next: Payment[]) => db.works.update(work.id!, { payments: next } as Partial<Work>)

  async function startNew() {
    setNewNo(await nextInvoiceNo())
    setEditing('new')
  }

  async function savePayment(p: Payment) {
    await save(editing === 'new' ? [...payments, p] : payments.map(x => (x.id === p.id ? p : x)))
    if (p.invoiceId != null) await db.invoices.update(p.invoiceId, { sent: p.invoiced, paid: p.received, updatedAt: Date.now() })
    setEditing(null)
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

  const form = (p?: Payment) => (
    <PaymentForm key={p?.id ?? 'new'} payment={p ?? { invoiceNo: newNo }} currency={currency} rights={rights} workTitle={work.title}
      onSave={savePayment}
      onDelete={p ? async () => { await save(payments.filter(x => x.id !== p.id)); setEditing(null) } : undefined}
      onPrint={x => printer.print(work, x, currency)}
      onCancel={() => setEditing(null)} />
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

      {editing === 'new' && form()}
      {payments.map(p => editing === p.id ? <div key={p.id}>{form(p)}</div> : (
        <button key={p.id} onClick={() => setEditing(p.id)} disabled={!!editing}
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

      {printer.dialog}
      {viewing?.invoiceFile && <ClippingViewer entry={{ title: work.title, outlet: `Invoice ${viewing.invoiceNo ?? ''}`.trim(), clipping: viewing.invoiceFile, clippingName: viewing.invoiceFileName }} onClose={() => setViewing(null)} />}
    </div>
  )
}
