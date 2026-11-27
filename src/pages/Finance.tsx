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
import { InvoiceStatusChip, STATUS_NAME } from '../components/InvoiceStatusChip'
import { InvoicePopup } from './InvoiceEditor'
import { useActiveDept } from '../lib/useDept'
import { useNarrow } from '../lib/useNarrow'
import { practiceOf, usePractice } from '../lib/practice'
import { formatAnyDate } from '../lib/eventDates'
import { addDays, invoiceHtml, invoiceStatus, invoiceTotals, nextInvoiceNo, printHtml, type InvoiceStatus } from '../lib/invoice'
import { collectEntries, downloadFile, entriesCsv, sums, toCsv, yearOf, type Entry } from '../lib/finance'

type Tab = 'invoices' | 'payments'
type PayShow = 'all' | 'owed' | 'paid'
type InvShow = 'all' | InvoiceStatus

const chip = (paid: boolean): React.CSSProperties => ({
  fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap',
  background: paid ? 'var(--wa-fill)' : 'var(--accent)', color: paid ? 'var(--wa-text-2)' : '#111111',
})

// Several currencies read as "€12,400 · $3,000".
const total = (by: Record<string, number>) => {
  const parts = Object.entries(by).filter(([, n]) => Math.round(n * 100) !== 0).map(([c, n]) => money(Math.round(n * 100) / 100, c))
  return parts.length ? parts.join(' · ') : money(0, Object.keys(by)[0] ?? '€')
}

// One line on the Invoices tab: an invoice made on Finance, or a quick one from a Money card.
interface InvRow {
  key: string
  number: string
  client: string
  forText: string
  issued?: string
  due?: string
  total: number
  currency: string
  status: InvoiceStatus
  file?: Entry
  open: () => void
  print: () => void
}

export function Finance() {
  const navigate = useNavigate()
  const narrow = useNarrow()
  const dept = useActiveDept()
  const { acts, keep } = usePractice({ filter: true })
  const works = useLiveQuery(() => db.works.toArray()) ?? []
  const events = useLiveQuery(() => db.eventEntries.toArray()) ?? []
  const invoiceRecords = useLiveQuery(() => db.invoices.toArray()) ?? []
  const thisYear = new Date().getFullYear()
  const [tab, setTab] = useState<Tab>('invoices')
  const [year, setYear] = useState<number | 'all'>(thisYear)
  const [payShow, setPayShow] = useState<PayShow>('all')
  const [invShow, setInvShow] = useState<InvShow>('all')
  const [editing, setEditing] = useState<string | null>(null) // a payment entry key, or 'new'
  const [newNo, setNewNo] = useState('')
  const [feeDate, setFeeDate] = useState('')
  const [viewing, setViewing] = useState<Entry | null>(null)
  const [popup, setPopup] = useState<{ id: string; from?: string } | null>(null) // the invoice open over the list
  const printer = useInvoicePrinter(dept)

  const p = useMemo(() => practiceOf(acts, works), [acts, works])
  const all = useMemo(
    () => collectEntries(works.filter(w => keep(p.work(w))), events.filter(e => p.eventAll(e).some(keep)), dept),
    [works, events, dept, p, keep],
  )

  // Invoices: the ones made here, then quick invoices on payments that have a number but no invoice of their own.
  const invRows = useMemo<InvRow[]>(() => {
    const terms = dept?.invoiceSettings?.termsDays ?? 14
    const made: InvRow[] = invoiceRecords
      .filter(inv => { const w = inv.workId != null ? works.find(x => x.id === inv.workId) : undefined; return !w || keep(p.work(w)) })
      .map(inv => {
        const w = inv.workId != null ? works.find(x => x.id === inv.workId) : undefined
        const right = inv.rightId ? w?.rights?.find(r => r.id === inv.rightId)?.language : undefined
        return {
          key: `i${inv.id}`, number: inv.number, client: inv.clientName ?? '', forText: w ? [w.title, right].filter(Boolean).join(' · ') : inv.lines[0]?.description.split('\n')[0] ?? '',
          issued: inv.issued, due: inv.due, total: invoiceTotals(inv).total, currency: inv.currency, status: invoiceStatus(inv),
          file: all.find(e => e.payment?.invoiceId === inv.id && e.invoiceFile),
          open: () => setPopup({ id: String(inv.id) }),
          print: () => printHtml(invoiceHtml(inv, dept)),
        }
      })
    const quick: InvRow[] = all.filter(e => e.invoiceNo && e.payment && e.payment.invoiceId == null && e.source !== 'event').map(e => ({
      key: e.key, number: e.invoiceNo!, client: e.payer?.split('\n')[0] ?? '', forText: e.source === 'work' ? [e.title, e.what].filter(Boolean).join(' · ') : e.title,
      issued: e.invoiced, due: e.invoiced ? addDays(e.invoiced, terms) : undefined, total: e.amount, currency: e.currency,
      status: invoiceStatus({ sent: e.invoiced, paid: e.received, due: e.invoiced ? addDays(e.invoiced, terms) : undefined }),
      file: e.invoiceFile ? e : undefined,
      open: () => setPopup({ id: 'new', from: `${e.source === 'work' ? e.work!.id : 'other'}:${e.payment!.id}` }),
      print: () => printer.print(e.work ?? { title: '' }, e.payment!, e.currency),
    }))
    return [...made, ...quick].sort((a, b) => b.number.localeCompare(a.number, undefined, { numeric: true }))
  }, [invoiceRecords, works, all, dept, keep, p, navigate, printer])

  const invYear = (r: InvRow) => Number((r.issued ?? '').slice(0, 4)) || thisYear
  const years = useMemo(() => [...new Set([thisYear, ...all.map(yearOf), ...invRows.map(invYear)])].sort((a, b) => b - a), [all, invRows, thisYear])

  const inYear = year === 'all' ? all : all.filter(e => yearOf(e) === year)
  const shown = inYear.filter(e => payShow === 'all' || (payShow === 'paid' ? !!e.received : !e.received))
  const paid = inYear.filter(e => e.received)
  const owed = inYear.filter(e => !e.received)
  const split = inYear.some(e => e.share < 1)
  const invInYear = year === 'all' ? invRows : invRows.filter(r => invYear(r) === year)
  const invShown = invInYear.filter(r => invShow === 'all' || r.status === invShow)

  const others = dept?.otherPayments ?? []
  const saveOthers = (next: Payment[]) => (dept?.id != null ? db.departments.update(dept.id, { otherPayments: next.length ? next : undefined }) : Promise.resolve(0))

  async function startNew() {
    setNewNo(await nextInvoiceNo())
    setEditing('new')
  }
  async function saveOther(x: Payment) {
    await saveOthers(others.some(o => o.id === x.id) ? others.map(o => (o.id === x.id ? x : o)) : [...others, x])
    setEditing(null)
  }
  async function saveFee(e: EventEntry, received: string) {
    await db.eventEntries.update(e.id!, { feeReceived: received || undefined })
    setEditing(null)
  }
  function open(e: Entry) {
    if (e.payment?.invoiceId != null) return setPopup({ id: String(e.payment.invoiceId) })
    if (e.source === 'work') return navigate(`/studio/${e.work!.id}`)
    if (e.source === 'event') setFeeDate(e.received ?? '')
    setEditing(e.key)
  }
  function exportCsv() {
    const when = year === 'all' ? 'all-years' : year
    if (tab === 'payments') return downloadFile(`payments-${when}${payShow === 'all' ? '' : `-${payShow}`}.csv`, entriesCsv(shown))
    downloadFile(`invoices-${when}${invShow === 'all' ? '' : `-${invShow}`}.csv`, toCsv(
      ['Number', 'Client', 'For', 'Date', 'Due', 'Currency', 'Total', 'Status'],
      invShown.map(r => [r.number, r.client, r.forText, r.issued, r.due, r.currency, r.total, STATUS_NAME[r.status]]),
    ))
  }

  const otherForm = (x?: Payment) => (
    <div style={{ padding: '12px 20px 2px' }}>
      <PaymentForm key={x?.id ?? 'new'} payment={x ?? { invoiceNo: newNo }} currency={x?.currency ?? '€'} ownCurrency placeholder="Grant, prize, teaching"
        onSave={saveOther}
        onDelete={x ? async () => { await saveOthers(others.filter(o => o.id !== x.id)); setEditing(null) } : undefined}
        onPrint={y => printer.print({ title: '' }, y, y.currency ?? '€')}
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

  const payRow = (e: Entry) => {
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

  const cell: React.CSSProperties = { fontSize: 12, color: 'var(--wa-text-2)', whiteSpace: 'nowrap' }
  const invRow = (r: InvRow) => (
    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 20px', borderBottom: '1px solid var(--wa-line)' }}>
      <button onClick={r.open}
        style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: narrow ? 'minmax(0, 1fr) auto' : '84px minmax(0, 1fr) 92px 92px 96px 76px', alignItems: 'center', columnGap: 14, rowGap: 4, padding: '12px 0', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
        {narrow ? <>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'No client'}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', marginTop: 2 }}>{[r.number, r.forText, r.due ? `Due ${formatAnyDate(r.due)}` : ''].filter(Boolean).join(' · ')}</span>
          </span>
          <span style={{ textAlign: 'right' }}>
            <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)', whiteSpace: 'nowrap', marginBottom: 4 }}>{money(r.total, r.currency)}</span>
            <InvoiceStatusChip status={r.status} />
          </span>
        </> : <>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--wa-ink)', fontVariantNumeric: 'tabular-nums' }}>{r.number}</span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 13, color: 'var(--wa-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.client || 'No client'}</span>
            <span style={{ display: 'block', fontSize: 10, color: 'var(--wa-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.forText}</span>
          </span>
          <span style={cell}>{r.issued ? formatAnyDate(r.issued) : ''}</span>
          <span style={{ ...cell, ...(r.status === 'overdue' ? { color: 'var(--wa-ink)', fontWeight: 600 } : {}) }}>{r.due ? formatAnyDate(r.due) : ''}</span>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--wa-ink)', textAlign: 'right', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{money(r.total, r.currency)}</span>
          <span style={{ textAlign: 'right' }}><InvoiceStatusChip status={r.status} /></span>
        </>}
      </button>
      <span style={{ display: 'flex', gap: 10, width: narrow ? 'auto' : 64, justifyContent: 'flex-end' }}>
        {r.file && <button onClick={() => setViewing(r.file!)} style={{ ...quiet, fontSize: 10, color: 'var(--wa-ink)' }}><span style={{ borderBottom: '2px solid var(--accent)' }}>PDF</span></button>}
        <button onClick={r.print} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)' }}>Print</button>
      </span>
    </div>
  )

  const head: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--wa-muted)' }
  const invHead = !narrow && invShown.length > 0 && (
    <div style={{ display: 'flex', gap: 10, padding: '10px 20px 8px', borderBottom: '1px solid var(--wa-line)' }}>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '84px minmax(0, 1fr) 92px 92px 96px 76px', columnGap: 14 }}>
        <span style={head}>No.</span><span style={head}>Client</span><span style={head}>Date</span><span style={head}>Due</span><span style={{ ...head, textAlign: 'right' }}>Total</span><span style={{ ...head, textAlign: 'right' }}>Status</span>
      </div>
      <span style={{ width: 64 }} />
    </div>
  )

  const yearCount = (y: number) => (tab === 'invoices' ? invRows.filter(r => invYear(r) === y).length : all.filter(e => yearOf(e) === y).length)
  const yearPanel = (
    <SidePanel title="Year" narrow={narrow}>
      {years.map(y => <SideItem key={y} label={String(y)} count={yearCount(y)} active={year === y} narrow={narrow} onClick={() => setYear(y)} />)}
      <SideItem label="All years" count={tab === 'invoices' ? invRows.length : all.length} active={year === 'all'} narrow={narrow} onClick={() => setYear('all')} />
    </SidePanel>
  )
  const statusPanel = tab === 'invoices' ? (
    <SidePanel title="Status" narrow={narrow}>
      {(['all', 'draft', 'sent', 'overdue', 'paid'] as InvShow[]).map(k => (
        <SideItem key={k} label={k === 'all' ? 'All' : STATUS_NAME[k]} count={k === 'all' ? invInYear.length : invInYear.filter(r => r.status === k).length}
          dot={k === 'overdue' && invInYear.some(r => r.status === 'overdue') ? '#B42318' : undefined}
          active={invShow === k} narrow={narrow} onClick={() => setInvShow(k)} />
      ))}
    </SidePanel>
  ) : (
    <SidePanel title="Show" narrow={narrow}>
      {([['all', 'All'], ['owed', 'Owed'], ['paid', 'Paid']] as Array<[PayShow, string]>).map(([k, l]) => (
        <SideItem key={k} label={l} count={k === 'all' ? inYear.length : k === 'paid' ? paid.length : owed.length} active={payShow === k} narrow={narrow} onClick={() => setPayShow(k)} />
      ))}
    </SidePanel>
  )

  // Kept small: a few lines of text at the side, not the headline.
  const totalsRows: Array<[string, string]> = [['Received', total(sums(paid, e => e.amount))], ['Owed', total(sums(owed, e => e.amount))]]
  if (split) totalsRows.push(['Yours', total(sums(paid, e => e.amount * e.share))])
  const totals = narrow ? (
    <p style={{ margin: 0, padding: '0 4px', fontSize: 11, color: 'var(--wa-text-2)' }}>{totalsRows.map(([l, v]) => `${l} ${v}`).join(' · ')}</p>
  ) : (
    <div style={{ background: 'var(--wa-surface)', borderRadius: 20, padding: '16px 24px' }}>
      <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '0 0 8px' }}>{year === 'all' ? 'All years' : year}</p>
      {totalsRows.map(([l, v]) => (
        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, padding: '3px 0' }}>
          <span style={{ color: 'var(--wa-text-2)' }}>{l}</span><span style={{ color: 'var(--wa-ink)', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{v}</span>
        </div>
      ))}
    </div>
  )

  const list = tab === 'invoices' ? invShown : shown
  return (
    <Shell>
      <div style={pageGrid(narrow)}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <PracticeFilter narrow={narrow} />
          {yearPanel}
          {statusPanel}
          {!narrow && totals}
        </div>

        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {narrow && totals}
          <div style={pageFrame}>
            <FrameHeader right={<>
              {list.length > 0 && <button onClick={exportCsv} style={{ ...quiet, fontSize: 11, color: 'var(--wa-text-2)' }}>Export CSV</button>}
              {tab === 'invoices'
                ? <AddButton label="+ New invoice" onClick={() => setPopup({ id: 'new' })} />
                : !editing && <AddButton onClick={() => void startNew()} />}
            </>}>
              <FrameTabs label="Finance" active={tab} onSelect={k => { setTab(k); setEditing(null) }}
                tabs={[{ key: 'invoices', label: 'Invoices', count: invShown.length }, { key: 'payments', label: 'Payments', count: shown.length }]} />
            </FrameHeader>

            {tab === 'invoices' && <>
              {invHead}
              {invShown.map(invRow)}
              {invShown.length === 0 && (
                <div style={{ padding: '28px 20px', textAlign: 'center' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 12, color: 'var(--wa-text-2)' }}>
                    {invShow === 'all' ? 'No invoices' : `No ${STATUS_NAME[invShow as InvoiceStatus].toLowerCase()} invoices`}{year === 'all' ? '' : ` in ${year}`}.
                  </p>
                  {invShow === 'all' && <AddButton label="+ New invoice" onClick={() => setPopup({ id: 'new' })} />}
                </div>
              )}
            </>}

            {tab === 'payments' && <>
              {editing === 'new' && <div style={{ borderBottom: '1px solid var(--wa-line)' }}>{otherForm()}</div>}
              {shown.map(payRow)}
              {shown.length === 0 && editing !== 'new' && (
                <p style={{ margin: 0, padding: '18px 20px', fontSize: 12, color: 'var(--wa-text-2)' }}>
                  {payShow === 'all' ? 'No payments' : payShow === 'owed' ? 'Nothing owed' : 'Nothing received'}{year === 'all' ? '' : ` in ${year}`}.
                </p>
              )}
            </>}
          </div>
        </div>
      </div>
      {printer.dialog}
      {popup && <InvoicePopup key={`${popup.id}-${popup.from ?? ''}`} invoiceId={popup.id} from={popup.from} onClose={() => setPopup(null)} />}
      {viewing?.invoiceFile && <ClippingViewer entry={{ title: viewing.title, outlet: `Invoice ${viewing.invoiceNo ?? ''}`.trim(), clipping: viewing.invoiceFile, clippingName: viewing.invoiceFileName }} onClose={() => setViewing(null)} />}
    </Shell>
  )
}
