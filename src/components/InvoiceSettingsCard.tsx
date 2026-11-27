import { useRef, useState } from 'react'
import { db, type Department, type InvoiceSettings } from '../db/db'
import { parseAmount } from './ContractCard'
import { CURRENCIES } from './PaymentForm'
import { readRaw } from '../lib/images'

const ta: React.CSSProperties = { width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid var(--wa-line)', background: 'var(--wa-fill)', padding: '8px 12px', fontSize: 13, color: 'var(--wa-ink)', outline: 'none', fontFamily: 'inherit' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 9, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--wa-muted)', marginBottom: 4 }
const group: React.CSSProperties = { fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--wa-muted)', margin: '16px 0 8px', gridColumn: '1 / -1' }
const chipBtn: React.CSSProperties = { flexShrink: 0, background: 'var(--wa-fill)', borderRadius: 8, border: 'none', padding: '6px 12px', fontSize: 10, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit' }

// Logos keep their transparency and are kept small: they sit on coloured headers too.
async function logoDataUrl(file: File, max = 600): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    if (file.type === 'image/svg+xml') return await readRaw(file)
    const img = await new Promise<HTMLImageElement>((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    const ctx = c.getContext('2d')
    if (!ctx) return await readRaw(file)
    ctx.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}

type Draft = Record<'from' | 'footer' | 'email' | 'website' | 'taxNumber' | 'vatId' | 'bankHolder' | 'bankName' | 'iban' | 'bic' | 'currency' | 'vatRate' | 'taxNote' | 'termsDays' | 'prefix' | 'notes', string> & { logo?: string }

const toDraft = (d?: Department | null): Draft => {
  const s = d?.invoiceSettings ?? {}
  return {
    from: d?.invoiceFrom ?? '', footer: d?.invoiceFooter ?? '', logo: s.logo,
    email: s.email ?? '', website: s.website ?? '', taxNumber: s.taxNumber ?? '', vatId: s.vatId ?? '',
    bankHolder: s.bankHolder ?? '', bankName: s.bankName ?? '', iban: s.iban ?? '', bic: s.bic ?? '',
    currency: s.currency ?? '€', vatRate: s.vatRate != null ? String(s.vatRate) : '', taxNote: s.taxNote ?? '',
    termsDays: s.termsDays != null ? String(s.termsDays) : '14', prefix: s.prefix ?? '', notes: s.notes ?? '',
  }
}

// Account › Invoices: what every invoice carries. Designs are made on an invoice and saved from there.
export function InvoiceSettingsCard({ dept }: { dept?: Department | null }) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = dept?.invoiceSettings ?? {}
  const set = (k: keyof Draft, v: string | undefined) => setDraft(d => (d ? { ...d, [k]: v } : d))

  async function save() {
    if (!draft || dept?.id == null) return
    const t = (v: string) => v.trim() || undefined
    const next: InvoiceSettings = {
      ...s, logo: draft.logo, email: t(draft.email), website: t(draft.website), taxNumber: t(draft.taxNumber), vatId: t(draft.vatId),
      bankHolder: t(draft.bankHolder), bankName: t(draft.bankName), iban: t(draft.iban)?.toUpperCase(), bic: t(draft.bic)?.toUpperCase(),
      currency: draft.currency, vatRate: parseAmount(draft.vatRate), taxNote: t(draft.taxNote), termsDays: parseAmount(draft.termsDays),
      prefix: t(draft.prefix), notes: t(draft.notes),
    }
    await db.departments.update(dept.id, { invoiceFrom: t(draft.from), invoiceFooter: t(draft.footer), invoiceSettings: next })
    setDraft(null)
  }

  async function pickLogo(file?: File) {
    if (!file) return
    if (!file.type.startsWith('image/')) return window.alert('A logo has to be an image: PNG, JPG or SVG.')
    set('logo', await logoDataUrl(file))
  }

  if (!draft) {
    const summary = [
      dept?.invoiceFrom?.split('\n')[0],
      s.iban && `IBAN ${s.iban.replace(/\s/g, '').replace(/^(.{4}).*(.{4})$/, '$1 … $2')}`,
      s.vatId ? `VAT ID ${s.vatId}` : s.taxNumber && `Tax number ${s.taxNumber}`,
      s.termsDays != null && `Due in ${s.termsDays} days`,
    ].filter(Boolean)
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          {s.logo && <img src={s.logo} alt="" style={{ maxWidth: 64, maxHeight: 40, objectFit: 'contain', background: '#fff', borderRadius: 6, padding: 4 }} />}
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: summary.length ? 'var(--wa-ink)' : 'var(--wa-text-2)', whiteSpace: 'pre-wrap' }}>
            {summary.length ? summary.join('\n') : 'Logo, address, tax and bank details, printed on every invoice.'}
          </p>
        </div>
        <button onClick={() => setDraft(toDraft(dept))} style={chipBtn}>{summary.length || s.logo ? 'Edit' : 'Add'}</button>
      </div>
    )
  }

  const field = (k: keyof Draft, label: string, placeholder = '', wide = false) => (
    <label style={{ display: 'block', gridColumn: wide ? '1 / -1' : undefined }}>
      <span style={lbl}>{label}</span>
      <input value={(draft[k] as string) ?? ''} onChange={e => set(k, e.target.value)} placeholder={placeholder} style={ta} />
    </label>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 10, rowGap: 10 }}>
      <p style={{ ...group, marginTop: 0 }}>Logo</p>
      <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 12 }}>
        {draft.logo
          ? <img src={draft.logo} alt="Logo" style={{ maxWidth: 140, maxHeight: 56, objectFit: 'contain', background: '#fff', borderRadius: 8, padding: 6 }} />
          : <span style={{ width: 80, height: 48, borderRadius: 8, border: '1px dashed var(--wa-line-strong)', display: 'inline-block' }} />}
        <button onClick={() => fileRef.current?.click()} style={chipBtn}>{draft.logo ? 'Replace' : 'Upload'}</button>
        {draft.logo && <button onClick={() => set('logo', undefined)} style={{ ...chipBtn, background: 'none' }}>Remove</button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden aria-label="Logo" onChange={e => { void pickLogo(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      <p style={group}>You</p>
      <label style={{ display: 'block', gridColumn: '1 / -1' }}>
        <span style={lbl}>Name and address</span>
        <textarea autoFocus rows={4} value={draft.from} onChange={e => set('from', e.target.value)} placeholder={'Your name or studio\nStreet and number\nPostcode, city\nCountry'} style={{ ...ta, resize: 'vertical' }} />
      </label>
      {field('email', 'Email', 'hello@studio.com')}
      {field('website', 'Website', 'studio.com')}

      <p style={group}>Tax</p>
      {field('taxNumber', 'Tax number', '12/345/67890')}
      {field('vatId', 'VAT ID', 'DE123456789')}

      <p style={group}>Bank</p>
      {field('bankHolder', 'Account holder')}
      {field('bankName', 'Bank')}
      {field('iban', 'IBAN', 'DE89 3704 0044 0532 0130 00')}
      {field('bic', 'BIC', 'COBADEFFXXX')}

      <p style={group}>New invoices</p>
      <label style={{ display: 'block' }}>
        <span style={lbl}>Currency</span>
        <select value={draft.currency} onChange={e => set('currency', e.target.value)} style={ta}>
          {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
      {field('vatRate', 'VAT %', '19')}
      {field('termsDays', 'Due after (days)', '14')}
      {field('prefix', 'Number prefix', 'WA-')}
      {field('taxNote', 'Tax note', 'Small business, no VAT charged (§ 19 UStG)', true)}
      <label style={{ display: 'block', gridColumn: '1 / -1' }}>
        <span style={lbl}>Note on new invoices</span>
        <textarea rows={2} value={draft.notes} onChange={e => set('notes', e.target.value)} placeholder="Thank you. Please pay within 14 days." style={{ ...ta, resize: 'vertical' }} />
      </label>
      <label style={{ display: 'block', gridColumn: '1 / -1' }}>
        <span style={lbl}>Line at the foot</span>
        <textarea rows={2} value={draft.footer} onChange={e => set('footer', e.target.value)} placeholder="Anything else for the foot of every invoice" style={{ ...ta, resize: 'vertical' }} />
      </label>

      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <button onClick={() => setDraft(null)} style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--wa-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        <button onClick={() => void save()} style={{ background: 'var(--accent)', borderRadius: 8, border: 'none', padding: '7px 14px', fontSize: 10, fontWeight: 600, cursor: 'pointer', color: '#111111', fontFamily: 'inherit' }}>Save</button>
      </div>
    </div>
  )
}
