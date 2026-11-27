import { db, INVOICE_BLOCKS, type Department, type Invoice, type InvoiceBlock, type InvoiceDesign, type Payment, type Work, type WordmarkFont } from '../db/db'

// What a payment's invoice is for: a work (with its translations and licences), or nothing for money outside works.
export type InvoiceFor = Pick<Work, 'title' | 'rights'>

export const DEFAULT_DESIGN: InvoiceDesign = { layout: 'classic', font: 'sans', accent: '#231F20', logo: 'left', blocks: [...INVOICE_BLOCKS] }

// The three starting points. Each can be changed and saved as a template of its own.
export const LAYOUTS: Array<{ key: InvoiceDesign['layout']; name: string; design: InvoiceDesign }> = [
  { key: 'classic', name: 'Classic', design: DEFAULT_DESIGN },
  { key: 'modern', name: 'Modern', design: { layout: 'modern', font: 'sans', accent: '#E8D44D', logo: 'left', blocks: [...INVOICE_BLOCKS] } },
  { key: 'minimal', name: 'Minimal', design: { layout: 'minimal', font: 'serif', accent: '#231F20', logo: 'center', blocks: [...INVOICE_BLOCKS] } },
]

// Four faces for a name set in place of a logo.
export const WORDMARK_FONTS: Array<{ key: WordmarkFont; name: string; family: string; css: string; size: number; weight: number }> = [
  { key: 'playfair', name: 'Elegant', family: "'Playfair Display', Georgia, serif", css: 'Playfair+Display:ital,wght@0,600;1,600', size: 26, weight: 600 },
  { key: 'syne', name: 'Bold', family: "'Syne', Helvetica, sans-serif", css: 'Syne:wght@700', size: 24, weight: 700 },
  { key: 'pinyon', name: 'Script', family: "'Pinyon Script', cursive", css: 'Pinyon+Script', size: 32, weight: 400 },
  { key: 'spacemono', name: 'Typewriter', family: "'Space Mono', monospace", css: 'Space+Mono:wght@700', size: 20, weight: 700 },
]
export const wordmarkFont = (k?: WordmarkFont) => WORDMARK_FONTS.find(f => f.key === k) ?? WORDMARK_FONTS[0]
export const fontLink = (k?: WordmarkFont) => `https://fonts.googleapis.com/css2?family=${wordmarkFont(k).css}&display=swap`

export const BLOCK_NAME: Record<InvoiceBlock, string> = { parties: 'From and to', lines: 'Lines', totals: 'Totals', notes: 'Notes', payment: 'Bank and tax details' }

export const designOf = (inv: Pick<Invoice, 'design'>, dept?: Department | null): InvoiceDesign =>
  ({ ...DEFAULT_DESIGN, ...(dept?.invoiceSettings?.design ?? {}), ...(inv.design ?? {}) })

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const lines = (s?: string) => (s ?? '').split('\n').map(l => esc(l.trim())).filter(Boolean).join('<br>')
const today = () => new Date().toISOString().slice(0, 10)

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function longDate(iso?: string) {
  if (!iso) return ''
  return new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const round = (n: number) => Math.round(n * 100) / 100

export function invoiceTotals(inv: Pick<Invoice, 'lines' | 'vatRate'>) {
  const net = round(inv.lines.reduce((s, l) => s + (l.qty || 0) * (l.price || 0), 0))
  const tax = round(net * (inv.vatRate ?? 0) / 100)
  return { net, tax, total: round(net + tax) }
}

export type InvoiceStatus = 'draft' | 'sent' | 'overdue' | 'paid'
export function invoiceStatus(inv: Pick<Invoice, 'sent' | 'paid' | 'due'>): InvoiceStatus {
  if (inv.paid) return 'paid'
  if (!inv.sent) return 'draft'
  return inv.due && inv.due < today() ? 'overdue' : 'sent'
}

// What a quick invoice says the money is for: the work, the edition or licence, and the instalment.
export function invoiceDescription(work: InvoiceFor, p: Payment) {
  const right = p.rightId ? work.rights?.find(r => r.id === p.rightId) : undefined
  return [work.title, right?.language ?? '', p.label].filter(Boolean).join(' · ')
}

// A payment from a Money card, read as a one-line invoice so it prints in the same design.
export function paymentAsInvoice(work: InvoiceFor, p: Payment, dept: Department | null | undefined, currency: string): Invoice {
  const [clientName, ...rest] = (p.payer ?? '').split('\n')
  return {
    number: p.invoiceNo?.trim() || '', issued: p.invoiced ?? today(), clientName: clientName?.trim(), clientAddress: rest.join('\n'),
    lines: [{ id: 'l1', description: invoiceDescription(work, p), qty: 1, price: p.amount ?? 0 }], currency,
    taxNote: dept?.invoiceSettings?.taxNote, sent: p.invoiced, paid: p.received, createdAt: 0, updatedAt: 0,
  }
}

const FONTS = {
  sans: "'Helvetica Neue',Helvetica,Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
}

// Dark or light text on the accent, whichever reads.
function onAccent(hex: string) {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '#ffffff'
  const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#231F20' : '#ffffff'
}

export function invoiceHtml(inv: Invoice, dept: Department | null | undefined, design = designOf(inv, dept)) {
  const set = dept?.invoiceSettings ?? {}
  const { net, tax, total } = invoiceTotals(inv)
  const cur = inv.currency || '€'
  const ink = '#231F20'
  const accent = /^#[0-9a-f]{6}$/i.test(design.accent) ? design.accent : ink
  const modern = design.layout === 'modern'
  const minimal = design.layout === 'minimal'
  const tinted = !modern && accent.toLowerCase() !== ink.toLowerCase()
  const rule = minimal ? '1px solid #d9d6d6' : `1px dotted ${ink}`
  const fromName = (dept?.invoiceFrom ?? '').split('\n')[0]?.trim() || dept?.name || ''
  const hidden = new Set(design.hidden ?? [])
  const wm = !set.logo && set.wordmark?.trim() ? wordmarkFont(set.wordmarkFont) : undefined
  const logo = set.logo ? `<img class="logo" src="${set.logo}" alt="">`
    : wm ? `<div class="logo wordmark" style="font-family:${wm.family};font-size:${wm.size}px;font-weight:${wm.weight}">${esc(set.wordmark!.trim())}</div>` : ''

  const meta = `<div class="meta">
    <div><div class="label">Invoice no.</div><div>${esc(inv.number || '—')}</div></div>
    <div><div class="label">Date</div><div>${longDate(inv.issued)}</div></div>
    ${inv.due ? `<div><div class="label">Due</div><div>${longDate(inv.due)}</div></div>` : ''}
  </div>`

  const header = design.logo === 'center'
    ? `<header class="center">${logo}<h1>Invoice</h1>${meta}</header>`
    : `<header class="${design.logo === 'right' ? 'flip' : ''}"><div class="brand">${logo}<h1>Invoice</h1></div>${meta}</header>`

  const contact = [set.email, set.website].filter(Boolean).map(x => esc(x!)).join('<br>')
  const blocks: Record<InvoiceBlock, string> = {
    parties: `<section class="parties">
      <div><div class="label">From</div><div>${lines(dept?.invoiceFrom) || esc(fromName)}${contact ? `<br>${contact}` : ''}</div></div>
      <div><div class="label">To</div><div>${[esc(inv.clientName ?? ''), lines(inv.clientAddress), esc(inv.clientEmail ?? '')].filter(Boolean).join('<br>')}</div></div>
    </section>`,
    lines: `<table><thead><tr><th>Description</th><th class="r">Qty</th><th class="r">Price</th><th class="r">Amount</th></tr></thead><tbody>
      ${inv.lines.map(l => `<tr><td>${lines(l.description)}</td><td class="r">${(l.qty || 0).toLocaleString('en-GB')}</td><td class="r">${fmt(l.price || 0, cur)}</td><td class="r">${fmt((l.qty || 0) * (l.price || 0), cur)}</td></tr>`).join('')}
    </tbody></table>`,
    totals: `<section class="totals"><div>
      ${inv.vatRate ? `<div class="row"><span>Net</span><span>${fmt(net, cur)}</span></div><div class="row"><span>VAT ${inv.vatRate}%</span><span>${fmt(tax, cur)}</span></div>` : ''}
      <div class="row total"><span>Total</span><span>${fmt(total, cur)}</span></div>
      ${inv.taxNote?.trim() ? `<p class="small">${lines(inv.taxNote)}</p>` : ''}
    </div></section>`,
    notes: inv.notes?.trim() ? `<section class="notes">${lines(inv.notes)}</section>` : '',
    payment: (() => {
      const bank = [set.bankHolder && `Account holder: ${esc(set.bankHolder)}`, set.bankName && esc(set.bankName), set.iban && `IBAN ${esc(set.iban)}`, set.bic && `BIC ${esc(set.bic)}`].filter(Boolean).join('<br>')
      const taxes = [set.taxNumber && `Tax number ${esc(set.taxNumber)}`, set.vatId && `VAT ID ${esc(set.vatId)}`].filter(Boolean).join('<br>')
      const foot = lines(dept?.invoiceFooter)
      if (!bank && !taxes && !foot) return ''
      return `<section class="payment">${bank ? `<div><div class="label">Payment</div>${bank}</div>` : ''}${taxes ? `<div><div class="label">Tax</div>${taxes}</div>` : ''}${foot ? `<div>${foot}</div>` : ''}</section>`
    })(),
  }

  const body = design.blocks.filter(b => !hidden.has(b)).map(b => blocks[b]).join('\n')

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)}</title>${wm ? `<link rel="stylesheet" href="${fontLink(wm.key)}">` : ''}<style>
*{box-sizing:border-box;margin:0;padding:0}
html{background:#fff}
body{font-family:${FONTS[design.font]};font-size:${minimal ? 11 : 12}px;line-height:1.6;color:${ink};padding:56px 64px;max-width:794px;margin:0 auto;background:#fff}
.label{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:#595959;margin-bottom:4px}
header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:44px}
${modern ? `header{background:${accent};color:${onAccent(accent)};margin:-56px -64px 44px;padding:40px 64px}header .label{color:${onAccent(accent)};opacity:.8}` : ''}
header.flip{flex-direction:row-reverse}
header.flip .meta{text-align:left}
header.center{flex-direction:column;align-items:center;text-align:center}
header.center .meta{text-align:center;justify-content:center}
.brand{display:flex;flex-direction:column;gap:14px}
header.flip .brand{align-items:flex-end}
.logo{max-height:56px;max-width:200px;object-fit:contain;align-self:flex-start}
.wordmark{max-height:none;max-width:none;line-height:1.1;white-space:nowrap}
header.center .logo{align-self:center}
header.flip .logo{align-self:flex-end}
h1{font-size:${minimal ? 22 : 30}px;font-weight:${modern ? 700 : 400};letter-spacing:${modern ? '.04em' : '-.01em'}${modern ? ';text-transform:uppercase' : ''}${tinted ? `;color:${accent}` : ''}}
.meta{display:flex;gap:24px;text-align:right}
section{margin-bottom:36px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:32px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{font-size:9px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;text-align:left;${modern ? `padding:8px 10px;background:${accent};color:${onAccent(accent)}` : `padding:0 0 8px;color:#595959;border-bottom:1px solid ${ink}`}}
td{padding:12px ${modern ? '10px' : '0'};border-bottom:${rule};vertical-align:top}
th.r,td.r{text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;padding-left:16px}
.totals{display:flex;justify-content:flex-end}
.totals>div{min-width:260px}
.row{display:flex;justify-content:space-between;gap:24px;padding:4px 0;font-variant-numeric:tabular-nums}
.row.total{font-weight:600;font-size:${minimal ? 13 : 15}px;border-top:1px solid ${ink};margin-top:6px;padding-top:10px${tinted ? `;color:${accent}` : ''}}
.small{font-size:10px;color:#3d3a3b;margin-top:10px}
.notes{color:#3d3a3b}
.payment{display:flex;flex-wrap:wrap;gap:32px;border-top:${rule};padding-top:16px;color:#3d3a3b;font-size:11px}
@page{margin:14mm}
@media print{body{padding:0}${modern ? 'header{margin:0 0 44px;padding:28px 32px;-webkit-print-color-adjust:exact;print-color-adjust:exact}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}' : ''}}
</style></head><body>
${header}
${body}
</body></html>`
}

// Prints from a hidden frame, so no new window or tab opens. "Save as PDF" in the print dialog makes the PDF.
export function printHtml(html: string) {
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open(); doc.write(html); doc.close()
  const go = async () => {
    await doc.fonts?.ready.catch(() => undefined) // a name set in a web font must load before printing
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => frame.remove(), 1000)
  }
  if (doc.readyState === 'complete') window.setTimeout(() => void go(), 150)
  else frame.onload = () => void go()
}

// A quick invoice from a Money card payment, in the studio's default design.
export function printInvoice(work: InvoiceFor, p: Payment, dept: Department | undefined, currency: string) {
  printHtml(invoiceHtml(paymentAsInvoice(work, p, dept, currency), dept))
}

// Next invoice number after the highest one used anywhere in the studio: 2026-004 → 2026-005.
export async function nextInvoiceNo() {
  const [works, depts, invoices] = await Promise.all([db.works.toArray(), db.departments.toArray(), db.invoices.toArray()])
  const used = [...works.flatMap(w => w.payments ?? []), ...depts.flatMap(d => d.otherPayments ?? [])].map(p => p.invoiceNo ?? '')
    .concat(invoices.map(i => i.number)).filter(Boolean)
  const prefix = depts[0]?.invoiceSettings?.prefix ?? ''
  const year = new Date().getFullYear()
  const n = used.map(s => Number(s.match(/(\d+)\s*$/)?.[1] ?? 0)).reduce((a, b) => Math.max(a, b), 0)
  return `${prefix}${year}-${String(n + 1).padStart(3, '0')}`
}

const newId = () => Math.random().toString(36).slice(2, 10)

// Keeps the invoice's payment in step: on its work when it has one, else outside works.
// A draft has no payment. Returns the payment id now linked (or undefined).
export async function syncInvoicePayment(inv: Invoice & { id: number }): Promise<string | undefined> {
  const pid = inv.paymentId ?? newId()
  const { total } = invoiceTotals(inv)
  const payer = [inv.clientName, inv.clientAddress].filter(Boolean).join('\n') || undefined
  // A new payment is named after the first line, without the work's title it already sits under.
  const work = inv.workId != null ? await db.works.get(inv.workId) : undefined
  const first = inv.lines[0]?.description.split('\n')[0]?.trim() ?? ''
  const label = (work ? first.replace(new RegExp(`^${work.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*·?\\s*`), '') : first) || `Invoice ${inv.number}`
  const payment: Payment = {
    id: pid, label, amount: total, payer, rightId: inv.workId != null ? inv.rightId : undefined, invoiceNo: inv.number,
    invoiced: inv.sent, received: inv.paid, invoiceId: inv.id, currency: inv.workId == null ? inv.currency : undefined,
  }
  const keep = !!inv.sent || !!inv.paid
  await db.transaction('rw', db.works, db.departments, async () => {
    // Take it out wherever it was, keeping a PDF attached to it, then put it where it belongs now.
    // A payment belongs to this invoice when it's linked to it, or (before the first link) has its id
    // in the place the invoice points at.
    let previous: Payment | undefined
    const mine = (x: Payment, here: boolean) => x.invoiceId === inv.id || (x.invoiceId == null && here && x.id === pid)
    for (const w of await db.works.toArray()) {
      const found = w.payments?.find(x => mine(x, w.id === inv.workId))
      if (found) { previous = found; await db.works.update(w.id!, { payments: w.payments!.filter(x => x !== found) } as Partial<Work>) }
    }
    const dept = await db.departments.toCollection().first()
    if (dept?.id != null) {
      const found = dept.otherPayments?.find(x => mine(x, inv.workId == null))
      if (found) { previous = found; await db.departments.update(dept.id, { otherPayments: dept.otherPayments!.filter(x => x !== found) }) }
    }
    if (!keep) return
    const next: Payment = { ...payment, label: previous?.label ?? payment.label, invoiceFile: previous?.invoiceFile, invoiceFileName: previous?.invoiceFileName }
    if (inv.workId != null) {
      const w = await db.works.get(inv.workId)
      if (w) await db.works.update(w.id!, { payments: [...(w.payments ?? []), next] } as Partial<Work>)
    } else if (dept?.id != null) {
      const fresh = await db.departments.get(dept.id)
      await db.departments.update(dept.id, { otherPayments: [...(fresh?.otherPayments ?? []), next] })
    }
  })
  return keep ? pid : undefined
}

// Removes an invoice and the payment that followed it.
export async function deleteInvoice(inv: Invoice & { id: number }) {
  await syncInvoicePayment({ ...inv, sent: undefined, paid: undefined })
  await db.invoices.delete(inv.id)
}
