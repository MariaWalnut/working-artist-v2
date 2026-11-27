import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type EventEntry, type Payment } from '../db/db'
import { Shell } from '../components/layout/Shell'
import { FrameHeader, FrameTabs } from '../components/FrameHeader'
import { AddButton, SideItem, SidePanel, pageFrame, pageGrid } from '../components/PageFrame'
import { PracticeFilter } from '../components/Practice'
import { ClippingViewer } from '../components/ClippingViewer'
import { money } from '../components/ContractCard'
import { PaymentForm, fieldLabel, inp, quiet, saveBtn, today, useInvoicePrinter } from '../components/PaymentForm'
import { useActiveDept } from '../lib/useDept'
import { useNarrow } from '../lib/useNarrow'
import { practiceOf, usePractice } from '../lib/practice'
import { formatAnyDate } from '../lib/eventDates'
import { nextInvoiceNo } from '../lib/invoice'
import { collectEntries, downloadFile, entriesCsv, sums, yearOf, type Entry } from '../lib/finance'

type Show = 'all' | 'owed' | 'paid'
const SHOW: Array<[Show, string]> = [['all', 'All'], ['owed', 'Owed'], ['paid', 'Paid']]

const big: React.CSSProperties = { fontFamily: 'Recoleta, serif', fontSize: 22, color: 'var(--wa-ink)', whiteSpace: 'nowrap' }
const chip = (paid: boolean): React.CSSProperties => ({
  fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap',
  background: paid ? 'var(--wa-fill)' : 'var(--accent)', color: paid ? 'var(--wa-text-2)' : '#111111',
})

// Several currencies read as "€12,400 · $3,000".
const total = (by: Record<string, number>) => {
  const parts = Object.entries(by).filter(([, n]) => Math.round(n * 100) !== 0).map(([c, n]) => money(Math.round(n * 100) / 100, c))
  return parts.length ? parts.join(' · ') : money(0, Object.keys(by)[0] ?? '€')
}

export function Finance() {
  const navigate = useNavigate()
  const narrow = useNarrow()
  const dept = useActiveDept()
  const { acts, keep } = usePractice({ filter: true })
  const works = useLiveQuery(() => db.works.toArray()) ?? []
  const events = useLiveQuery(() => db.eventEntries.toArray()) ?? []
  const thisYear = new Date().getFullYear()
  const [year, setYear] = useState<number | 'all'>(thisYear)
  const [show, setShow] = useState<Show>('all')
  const [tab, setTab] = useState<'payments' | 'invoices'>('payments')
  const [editing, setEditing] = useState<string | null>(null) // an entry key, or 'new'
  const [newNo, setNewNo] = useState('')
  const [feeDate, setFeeDate] = useState('')
  const [viewing, setViewing] = useState<Entry | null>(null)
  const printer = useInvoicePrinter(dept)

  const all = useMemo(() => {
    const p = practiceOf(acts, works)
    return collectEntries(works.filter(w => keep(p.work(w))), events.filter(e => p.eventAll(e).some(keep)), dept)
  }, [works, events, dept, acts, keep])

  const years = useMemo(() => [...new Set([thisYear, ...all.map(yearOf)])].sort((a, b) => b - a), [all, thisYear])
  const inYear = year === 'all' ? all : all.filter(e => yearOf(e) === year)
  const shown = inYear.filter(e => show === 'all' || (show === 'paid' ? !!e.received : !e.received))
  const paid = inYear.filter(e => e.received)
  const owed = inYear.filter(e => !e.received)
  const split = inYear.some(e => e.share < 1)
  const invoices = shown.filter(e => e.invoiceNo).sort((a, b) => (b.invoiceNo ?? '').localeCompare(a.invoiceNo ?? '', undefined, { numeric: true }))

  const others = dept?.otherPayments ?? []
  const saveOthers = (next: Payment[]) => (dept?.id != null ? db.departments.update(dept.id, { otherPayments: next.length ? next : undefined }) : Promise.resolve(0))

  async function startNew() {
    setNewNo(await nextInvoiceNo())
    setEditing('new')
  }
  async function saveOther(p: Payment) {
    await saveOthers(others.some(x => x.id === p.id) ? others.map(x => (x.id === p.id ? p : x)) : [...others, p])
    setEditing(null)
  }
  async function saveFee(e: EventEntry, received: string) {
    await db.eventEntries.update(e.id!, { feeReceived: received || undefined })
    setEditing(null)
  }
  function open(e: Entry) {
    if (e.source === 'work') return navigate(`/studio/${e.work!.id}`)
    if (e.source === 'event') setFeeDate(e.received ?? '')
    setEditing(e.key)
  }
  function exportCsv() {
    downloadFile(`${tab === 'invoices' ? 'invoices' : 'finance'}-${year === 'all' ? 'all-years' : year}${show === 'all' ? '' : `-${show}`}.csv`, entriesCsv(tab === 'invoices' ? invoices : shown))
  }

  const otherForm = (p?: Payment) => (
    <div style={{ padding: '12px 20px 2px' }}>
      <PaymentForm key={p?.id ?? 'new'} payment={p ?? { invoiceNo: newNo }} currency={p?.currency ?? '€'} ownCurrency placeholder="Grant, prize, teaching"
        onSave={saveOther}
        onDelete={p ? async () => { await saveOthers(others.filter(x => x.id !== p.id)); setEditing(null) } : undefined}
        onPrint={x => printer.print({ title: '' }, x, x.currency ?? '€')}
        onCancel={() => setEditing(null)} />
    </div>
  )

  const feeForm = (e: Entry) => (
    <div style={{ margin: '12px 20px 10px', background: 'var(--wa-fill-2)', borderRadius: 10, padding: 12 }}>
      <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--wa-ink)' }}>
        {e.title} <span style={{ color: 'var(--wa-muted)' }}>{[e.event?.date ? formatAnyDate(e.event.date) : '', e.event?.fee].filter(Boolean).join(' · ')}</span>
      </p>
      <label style={{ display: 'block', maxWidth: 240 }}>
        <span style={fieldLabel}>Received</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="date" autoFocus value={feeDate} onChange={x => setFeeDate(x.target.value)} style={inp} />
          {!feeDate && <button onClick={() => setFeeDate(today())} style={{ ...quiet, fontSize: 10 }}>Today</button>}
        </div>
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
        <button onClick={() => setEditing(null)} style={{ ...quiet, padding: '4px 6px' }}>Cancel</button>
        <button onClick={() => void saveFee(e.event!, feeDate)} style={saveBtn}>Save</button>
      </div>
    </div>
  )

  const row = (e: Entry) => {
    if (editing === e.key) return <div key={e.key} style={{ borderBottom: '1px solid var(--wa-line)' }}>{e.source === 'event' ? feeForm(e) : otherForm(e.payment)}</div>
    const meta = [
      e.source === 'event' ? 'Event' : e.source === 'other' ? 'Outside works' : '',
      e.what, e.payer?.split('\n')[0],
      e.received ? `Received ${formatAnyDate(e.received)}` : e.invoiced ? `Invoiced ${formatAnyDate(e.invoiced)}` : e.source === 'event' && e.event?.date ? formatAnyDate(e.event.date) : 'Not invoiced',
      e.invoiceNo ? `No. ${e.invoiceNo}` : '',
    ].filter(Boolean).join(' · ')
    return (
      <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid var(--wa-line)' }}>
        <button onClick={() => open(e)} disabled={!!editing}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', border: 'none', background: 'none', textAlign: 'left', cursor: editing ? 'default' : 'pointer', fontFamily: 'inherit' }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>{meta}</span>
          </span>
          <span style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)', whiteSpace: 'nowrap' }}>{money(e.amount, e.currency)}</span>
            {e.share < 1 && <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', whiteSpace: 'nowrap', marginTop: 2 }}>Yours {money(Math.round(e.amount * e.share * 100) / 100, e.currency)}</span>}
          </span>
          <span style={chip(!!e.received)}>{e.received ? 'Paid' : 'Owed'}</span>
        </button>
        {e.invoiceFile && <button onClick={() => setViewing(e)} aria-label={`Invoice ${e.invoiceNo ?? ''}`.trim()} style={{ ...quiet, fontSize: 10, color: 'var(--wa-ink)' }}><span style={{ borderBottom: '2px solid var(--accent)' }}>PDF</span></button>}
      </div>
    )
  }

  const printEntry = (e: Entry) => {
    if (!e.payment) return
    if (e.source === 'work' && e.work) printer.print(e.work, e.payment, e.currency)
    else printer.print({ title: '' }, e.payment, e.currency)
  }

  const invoiceRow = (e: Entry) => (
    <div key={e.key} style={{ display: 'flex', alignItems: 'center', flexWrap: narrow ? 'wrap' : 'nowrap', columnGap: 14, rowGap: 6, padding: '11px 20px', borderBottom: '1px solid var(--wa-line)' }}>
      <span style={{ width: narrow ? 'auto' : 76, flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--wa-ink)', fontVariantNumeric: 'tabular-nums' }}>{e.invoiceNo}</span>
      <span style={{ flex: 1, minWidth: narrow ? '60%' : 0 }}>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.payer?.split('\n')[0] || 'No recipient'}</span>
        <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>
          {[e.source === 'work' ? e.title : '', e.source === 'work' ? e.what : e.title, e.invoiced ? `Sent ${formatAnyDate(e.invoiced)}` : 'Not sent', e.received ? `Received ${formatAnyDate(e.received)}` : ''].filter(Boolean).join(' · ')}
        </span>
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: narrow ? 'auto' : 0 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)', whiteSpace: 'nowrap' }}>{money(e.amount, e.currency)}</span>
        <span style={chip(!!e.received)}>{e.received ? 'Paid' : 'Owed'}</span>
        {e.invoiceFile
          ? <button onClick={() => setViewing(e)} style={{ ...quiet, fontSize: 11, color: 'var(--wa-ink)' }}><span style={{ borderBottom: '2px solid var(--accent)' }}>PDF</span></button>
          : <span style={{ width: 22 }} />}
        <button onClick={() => printEntry(e)} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)' }}>Print</button>
      </span>
    </div>
  )

  const yearPanel = (
    <SidePanel title="Year" narrow={narrow}>
      {years.map(y => <SideItem key={y} label={String(y)} count={all.filter(e => yearOf(e) === y).length} active={year === y} narrow={narrow} onClick={() => setYear(y)} />)}
      <SideItem label="All years" count={all.length} active={year === 'all'} narrow={narrow} onClick={() => setYear('all')} />
    </SidePanel>
  )
  const showPanel = (
    <SidePanel title="Show" narrow={narrow}>
      {SHOW.map(([k, l]) => <SideItem key={k} label={l} count={k === 'all' ? inYear.length : k === 'paid' ? paid.length : owed.length} active={show === k} narrow={narrow} onClick={() => setShow(k)} />)}
    </SidePanel>
  )

  return (
    <Shell>
      <div style={pageGrid(narrow)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <PracticeFilter narrow={narrow} />
          {yearPanel}
          {showPanel}
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...pageFrame, padding: '18px 20px', display: 'flex', flexWrap: 'wrap', columnGap: 32, rowGap: 12 }}>
            <div><span style={fieldLabel}>Received</span><span style={big}>{total(sums(paid, e => e.amount))}</span></div>
            <div><span style={fieldLabel}>Owed</span><span style={big}>{total(sums(owed, e => e.amount))}</span></div>
            {split && <div><span style={fieldLabel}>Yours, received</span><span style={big}>{total(sums(paid, e => e.amount * e.share))}</span></div>}
          </div>

          <div style={pageFrame}>
            <FrameHeader right={<>
              {(tab === 'invoices' ? invoices : shown).length > 0 && <button onClick={exportCsv} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)' }}>Export CSV</button>}
              {!editing && tab === 'payments' && <AddButton onClick={() => void startNew()} />}
            </>}>
              <FrameTabs label="Finance" active={tab} onSelect={k => { setTab(k); setEditing(null) }}
                tabs={[{ key: 'payments', label: 'Payments', count: shown.length }, { key: 'invoices', label: 'Invoices', count: invoices.length }]} />
            </FrameHeader>
            {tab === 'invoices' && invoices.map(invoiceRow)}
            {tab === 'invoices' && invoices.length === 0 && (
              <p style={{ margin: 0, padding: '18px 20px', fontSize: 12, color: 'var(--wa-text-2)' }}>No invoices{year === 'all' ? '' : ` in ${year}`}. A payment with an invoice number shows here.</p>
            )}
            {tab === 'payments' && editing === 'new' && <div style={{ borderBottom: '1px solid var(--wa-line)' }}>{otherForm()}</div>}
            {tab === 'payments' && shown.map(row)}
            {tab === 'payments' && shown.length === 0 && editing !== 'new' && (
              <p style={{ margin: 0, padding: '18px 20px', fontSize: 12, color: 'var(--wa-text-2)' }}>
                {show === 'all' ? 'No payments' : show === 'owed' ? 'Nothing owed' : 'Nothing received'}{year === 'all' ? '' : ` in ${year}`}. Payments on works are added on each work's Money card.
              </p>
            )}
          </div>
        </div>
      </div>
      {printer.dialog}
      {viewing?.invoiceFile && <ClippingViewer entry={{ title: viewing.title, outlet: `Invoice ${viewing.invoiceNo ?? ''}`.trim(), clipping: viewing.invoiceFile, clippingName: viewing.invoiceFileName }} onClose={() => setViewing(null)} />}
    </Shell>
  )
}
