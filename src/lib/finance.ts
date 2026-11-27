import type { Department, EventEntry, Payment, Split, Work } from '../db/db'
import { parseAmount } from '../components/ContractCard'

// One line on the Finance page: a payment on a work, an event's fee, or money outside works.
export interface Entry {
  key: string
  source: 'work' | 'event' | 'other'
  title: string // the work or event; for money outside works, what it was for
  what?: string // what the payment was for, on works
  payer?: string
  invoiceNo?: string
  invoiced?: string
  date?: string // when it happened: received, else invoiced, else the event's date
  received?: string
  amount: number
  currency: string
  share: number // the artist's own part after the work's split, 0–1
  invoiceFile?: string
  invoiceFileName?: string
  work?: Work
  event?: EventEntry
  payment?: Payment
}

const ME = /^(you|me|myself|i)$/i

// The artist's own part of a work's money: their row in the split ("You", or their studio name),
// else the first row, which the split editor offers as You. No split = all of it.
export function ownShare(splits: Split[] | undefined, name?: string) {
  if (!splits?.length) return 1
  const mine = splits.find(s => ME.test(s.who.trim()) || (!!name && s.who.trim().toLowerCase() === name.trim().toLowerCase())) ?? splits[0]
  return Math.max(0, Math.min(100, mine.pct)) / 100
}

// An event fee as typed: "€400", "$1,200", "350 a visit". The currency is read from its symbol.
export function parseFee(fee?: string): { amount: number; currency: string } | undefined {
  if (!fee) return undefined
  const m = fee.match(/(R\$|[€$£])?\s*(\d[\d.,]*)/)
  const amount = m ? parseAmount(m[2]) : undefined
  if (amount == null) return undefined
  const currency = m?.[1] ?? (/R\$/.test(fee) ? 'R$' : fee.match(/[€$£]/)?.[0]) ?? '€'
  return { amount, currency }
}

const workCurrency = (w: Work) => w.contract?.currency ?? w.currency ?? '€'

export function collectEntries(works: Work[], events: EventEntry[], dept: Department | null | undefined): Entry[] {
  const out: Entry[] = []
  for (const w of works) {
    const share = ownShare(w.splits, dept?.name)
    for (const p of w.payments ?? []) {
      const right = p.rightId ? w.rights?.find(r => r.id === p.rightId)?.language : undefined
      out.push({
        key: `w${w.id}-${p.id}`, source: 'work', title: w.title, what: [right, p.label].filter(Boolean).join(' · '),
        payer: p.payer, invoiceNo: p.invoiceNo, invoiced: p.invoiced, received: p.received, date: p.received ?? p.invoiced,
        amount: p.amount ?? 0, currency: workCurrency(w), share, invoiceFile: p.invoiceFile, invoiceFileName: p.invoiceFileName, work: w, payment: p,
      })
    }
  }
  for (const e of events) {
    if (e.maybe) continue
    const fee = parseFee(e.fee)
    if (!fee) continue
    out.push({
      key: `e${e.id}`, source: 'event', title: e.title, what: [e.type, e.location].filter(Boolean).join(' · '), received: e.feeReceived,
      date: e.feeReceived ?? e.date, amount: fee.amount, currency: fee.currency, share: 1, event: e,
    })
  }
  for (const p of dept?.otherPayments ?? []) {
    out.push({
      key: `o${p.id}`, source: 'other', title: p.label, payer: p.payer, invoiceNo: p.invoiceNo, invoiced: p.invoiced, received: p.received,
      date: p.received ?? p.invoiced, amount: p.amount ?? 0, currency: p.currency ?? '€', share: 1,
      invoiceFile: p.invoiceFile, invoiceFileName: p.invoiceFileName, payment: p,
    })
  }
  return out.sort((a, b) => (b.date ?? '9999').localeCompare(a.date ?? '9999'))
}

// The year a line counts in. Money with no date yet counts in this year.
export const yearOf = (e: Entry) => Number((e.date ?? '').slice(0, 4)) || new Date().getFullYear()

// Sums per currency, e.g. { '€': 12400, '$': 3000 }.
export function sums(list: Entry[], f: (e: Entry) => number) {
  const by: Record<string, number> = {}
  for (const e of list) by[e.currency] = (by[e.currency] ?? 0) + f(e)
  return by
}

const csvCell = (v: string | number | undefined) => {
  const s = v == null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function entriesCsv(list: Entry[]) {
  const head = ['Received', 'Invoice sent', 'Kind', 'Title', 'What for', 'Who pays', 'Invoice no.', 'Currency', 'Amount', 'Your share', 'Status']
  const kind = { work: 'Work', event: 'Event', other: 'Other' } as const
  const rows = list.map(e => [
    e.received, e.invoiced, kind[e.source], e.title, e.what, e.payer?.split('\n').map(l => l.trim()).filter(Boolean).join(', '), e.invoiceNo,
    e.currency, e.amount, Math.round(e.amount * e.share * 100) / 100, e.received ? 'Paid' : 'Owed',
  ])
  return '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n')
}

export function downloadFile(name: string, text: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
