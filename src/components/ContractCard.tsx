import { useState } from 'react'
import { db, type BookContract, type Work } from '../db/db'
import { formatAnyDate } from '../lib/eventDates'
import { DateFields } from './DateFields'

const CURRENCIES = ['€', '$', '£', 'R$']
const BINDINGS = ['Hardcover', 'Paperback', 'Board book', 'Other']
const PAID_LABEL: Record<NonNullable<BookContract['advancePaid']>, string> = { no: 'Not paid yet', part: 'Partly paid', full: 'Paid in full' }

// Accepts German and English styles: "18", "18,50", "18.50", "3.000", "3,000", "1.234,50", "1,234.50".
export function parseAmount(raw: string): number | undefined {
  const s = raw.replace(/[\s€$£]|R\$/g, '')
  if (!s) return undefined
  let normal: string
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s) || /,\d{1,2}$/.test(s)) normal = s.replace(/\./g, '').replace(',', '.') // 3.000 / 1.234,50 / 18,50
  else normal = s.replace(/,/g, '') // 3,000 / 1,234.50 / 18.50
  const n = Number(normal)
  return Number.isFinite(n) ? n : undefined
}

export function money(n: number | undefined, currency = '€') {
  if (n == null) return ''
  const digits = Number.isInteger(n) ? 0 : 2
  return `${currency}${n.toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`
}

const count = (n: number) => n.toLocaleString('en-GB')

type Draft = Record<keyof BookContract, string>
const KEYS: Array<keyof BookContract> = [
  'currency', 'price', 'binding', 'printRun', 'authorCopies', 'advance', 'advancePaid', 'royaltyRate', 'royaltyBase',
  'royaltySteps', 'subRightsShare', 'territory', 'term', 'signed', 'agent', 'agentCommission', 'notes',
]
const NUMBERS: Array<keyof BookContract> = ['price', 'printRun', 'authorCopies', 'advance', 'royaltyRate', 'subRightsShare', 'agentCommission']

const toDraft = (c?: BookContract): Draft =>
  Object.fromEntries(KEYS.map(k => [k, c?.[k] != null ? String(c[k]) : ''])) as Draft

function fromDraft(d: Draft): BookContract {
  const out: Record<string, unknown> = {}
  for (const k of KEYS) {
    const v = d[k].trim()
    if (!v) continue
    out[k] = NUMBERS.includes(k) ? parseAmount(v) : v
  }
  return out as BookContract
}

const label: React.CSSProperties = { fontSize: 9, color: '#AAAAAA', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4, display: 'block' }

export function ContractCard({ work }: { work: Work }) {
  const c = work.contract ?? {}
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(c))
  const cur = c.currency ?? '€'
  const set = (k: keyof BookContract, v: string) => setDraft(d => ({ ...d, [k]: v }))

  async function save() {
    await db.works.update(work.id!, { contract: fromDraft(draft) } as Partial<Work>)
    setEditing(false)
  }

  // What one copy earns, and how many copies the advance needs, when the royalty is on the retail price.
  const perCopy = c.royaltyBase !== 'net' && c.price != null && c.royaltyRate != null ? c.price * c.royaltyRate / 100 : undefined
  const earnsOut = perCopy && c.advance ? Math.ceil(c.advance / perCopy) : undefined

  const rows: Array<[string, string]> = [
    ['Price', [money(c.price, cur), c.binding].filter(Boolean).join(' · ')],
    ['First print run', c.printRun != null ? `${count(c.printRun)} copies` : ''],
    ['Advance', [money(c.advance, cur), c.advancePaid ? PAID_LABEL[c.advancePaid] : ''].filter(Boolean).join(' · ')],
    ['Royalty', c.royaltyRate != null ? `${c.royaltyRate}% of ${c.royaltyBase === 'net' ? 'net receipts' : 'retail price'}` : ''],
    ['Royalty steps', c.royaltySteps ?? ''],
    ['Per copy', perCopy != null ? money(Math.round(perCopy * 100) / 100, cur) : ''],
    ['Earns out at', earnsOut != null ? `${count(earnsOut)} copies${c.printRun ? ` (print run ${count(c.printRun)})` : ''}` : ''],
    ['Share of licensed rights', c.subRightsShare != null ? `${c.subRightsShare}%` : ''],
    ['Territory', c.territory ?? ''],
    ['Term', c.term ?? ''],
    ['Signed', formatAnyDate(c.signed)],
    ['Agent', [c.agent, c.agentCommission != null ? `${c.agentCommission}%` : ''].filter(Boolean).join(' · ')],
    ['Author copies', c.authorCopies != null ? count(c.authorCopies) : ''],
  ]
  const shown = rows.filter(([, v]) => v)

  const inp: React.CSSProperties = { borderRadius: 8, border: '1px solid #EEEEEE', background: '#F5F5F5', padding: '7px 10px', fontSize: 12, color: '#111111', outline: 'none', width: '100%', boxSizing: 'border-box' }
  const field = (k: keyof BookContract, text: string, placeholder?: string, numeric = false) => (
    <label>
      <span style={label}>{text}</span>
      <input value={draft[k]} onChange={e => set(k, e.target.value)} placeholder={placeholder} inputMode={numeric ? 'decimal' : undefined} style={inp} />
    </label>
  )
  const select = (k: keyof BookContract, text: string, options: Array<[string, string]>) => (
    <label>
      <span style={label}>{text}</span>
      <select value={draft[k]} onChange={e => set(k, e.target.value)} style={{ ...inp, color: draft[k] ? '#111111' : '#999999' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  )

  return (
    <div style={{ background: '#FFFFFF', borderRadius: 16, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#CCCCCC', margin: 0 }}>Contract</p>
        {editing ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: '#999999', cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => void save()} style={{ background: 'var(--accent)', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}>Save</button>
          </div>
        ) : (
          <button onClick={() => { setDraft(toDraft(c)); setEditing(true) }}
            style={{ background: 'none', border: '1px solid #EBEBEB', borderRadius: 6, padding: '3px 8px', fontSize: 10, color: '#AAAAAA', cursor: 'pointer' }}>
            {shown.length ? 'Edit' : '+ Add'}
          </button>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {select('currency', 'Currency', CURRENCIES.map(x => [x, x]))}
          {field('price', 'Retail price', '18,00', true)}
          {select('binding', 'Format', [['', 'Format…'], ...BINDINGS.map(b => [b, b] as [string, string])])}
          {field('printRun', 'First print run', '3000', true)}
          {field('advance', 'Advance', '4000', true)}
          {select('advancePaid', 'Advance paid', [['', 'Not set'], ['no', PAID_LABEL.no], ['part', PAID_LABEL.part], ['full', PAID_LABEL.full]])}
          {field('royaltyRate', 'Royalty %', '7', true)}
          {select('royaltyBase', 'Royalty on', [['retail', 'Retail price'], ['net', 'Net receipts']])}
          <div style={{ gridColumn: '1 / -1' }}>{field('royaltySteps', 'Royalty steps', '8% from 5,000 copies, 10% from 10,000')}</div>
          {field('subRightsShare', 'Share of licensed rights %', '50', true)}
          {field('authorCopies', 'Author copies', '10', true)}
          {field('territory', 'Territory', 'World, German language')}
          {field('term', 'Term', 'Until out of print')}
          {field('agent', 'Agent')}
          {field('agentCommission', 'Agent commission %', '15', true)}
          <div style={{ gridColumn: '1 / -1' }}>
            <DateFields label="Signed" value={draft.signed} onChange={v => set('signed', v)} inp={inp} />
          </div>
          <label style={{ gridColumn: '1 / -1' }}>
            <span style={label}>Other conditions</span>
            <textarea value={draft.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Option on next book, reversion clause, ebook and audio terms…" style={{ ...inp, resize: 'vertical' }} />
          </label>
        </div>
      ) : shown.length === 0 && !c.notes ? (
        <p style={{ fontSize: 12, color: '#CCCCCC', fontStyle: 'italic', margin: 0 }}>No contract terms yet</p>
      ) : (
        <>
          {shown.map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', borderBottom: '1px solid #F5F5F5' }}>
              <span style={{ fontSize: 10, color: '#AAAAAA', flexShrink: 0 }}>{k}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#111111', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          {c.notes && <p style={{ fontSize: 12, color: '#666666', lineHeight: 1.6, margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>{c.notes}</p>}
        </>
      )}
    </div>
  )
}
