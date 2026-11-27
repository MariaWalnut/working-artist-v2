import { db, type Department, type Payment, type Work } from '../db/db'

// What an invoice is for: a work (with its translations and licences), or nothing for money outside works.
export type InvoiceFor = Pick<Work, 'title' | 'rights'>

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const lines = (s?: string) => (s ?? '').split('\n').map(l => esc(l.trim())).filter(Boolean).join('<br>')

function longDate(iso?: string) {
  const d = iso ? new Date(`${iso.slice(0, 10)}T12:00:00`) : new Date()
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function amount(n: number | undefined, currency: string) {
  if (n == null) return ''
  return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// What the invoice says the money is for: the work, the instalment, and the edition or licence.
export function invoiceDescription(work: InvoiceFor, p: Payment) {
  const right = p.rightId ? work.rights?.find(r => r.id === p.rightId) : undefined
  return [work.title, right?.language ?? '', p.label].filter(Boolean).join(' · ')
}

export function invoiceHtml(work: InvoiceFor, p: Payment, dept: Department | undefined, currency: string) {
  const no = p.invoiceNo?.trim() || '—'
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(no)}</title><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#231F20;padding:56px 64px;max-width:760px;margin:0 auto}
.label{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#595959;margin-bottom:6px}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:48px}
h1{font-size:28px;font-weight:400;letter-spacing:-.01em}
.meta{text-align:right}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px}
table{width:100%;border-collapse:collapse;margin-bottom:40px}
th{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#595959;text-align:left;padding-bottom:8px;border-bottom:1px solid #231F20}
td{padding:14px 0;border-bottom:1px dotted #231F20;vertical-align:top}
.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tfoot td{border-bottom:none;font-weight:600;font-size:14px}
.foot{border-top:1px dotted #231F20;padding-top:16px;color:#3d3a3b}
@page{margin:16mm}@media print{body{padding:0}}
</style></head><body>
<div class="top"><h1>Invoice</h1><div class="meta"><div class="label">Number</div><div>${esc(no)}</div><div class="label" style="margin-top:10px">Date</div><div>${longDate(p.invoiced)}</div></div></div>
<div class="parties"><div><div class="label">From</div><div>${lines(dept?.invoiceFrom) || esc(dept?.name ?? '')}</div></div><div><div class="label">To</div><div>${lines(p.payer)}</div></div></div>
<table><thead><tr><th>Description</th><th class="r">Amount</th></tr></thead>
<tbody><tr><td>${esc(invoiceDescription(work, p))}</td><td class="r">${amount(p.amount, currency)}</td></tr></tbody>
<tfoot><tr><td>Total</td><td class="r">${amount(p.amount, currency)}</td></tr></tfoot></table>
${dept?.invoiceFooter?.trim() ? `<div class="foot">${lines(dept.invoiceFooter)}</div>` : ''}
</body></html>`
}

// Prints from a hidden frame, so no new window or tab opens.
export function printInvoice(work: InvoiceFor, p: Payment, dept: Department | undefined, currency: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open(); doc.write(invoiceHtml(work, p, dept, currency)); doc.close()
  const go = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => frame.remove(), 1000)
  }
  if (doc.readyState === 'complete') window.setTimeout(go, 50)
  else frame.onload = go
}

// Next invoice number after the highest one used anywhere in the studio: 2026-004 → 2026-005.
export async function nextInvoiceNo() {
  const [works, depts] = await Promise.all([db.works.toArray(), db.departments.toArray()])
  const used = [...works.flatMap(w => w.payments ?? []), ...depts.flatMap(d => d.otherPayments ?? [])].map(p => p.invoiceNo ?? '').filter(Boolean)
  const year = new Date().getFullYear()
  const n = used.map(s => Number(s.match(/(\d+)\s*$/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0)
  return `${year}-${String(n + 1).padStart(3, '0')}`
}
