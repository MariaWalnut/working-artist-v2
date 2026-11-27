import type { InvoiceStatus } from '../lib/invoice'

export const STATUS_NAME: Record<InvoiceStatus, string> = { draft: 'Draft', sent: 'Sent', overdue: 'Overdue', paid: 'Paid' }

const STYLE: Record<InvoiceStatus, React.CSSProperties> = {
  draft: { background: 'none', color: 'var(--wa-text-2)', boxShadow: 'inset 0 0 0 1px var(--wa-line-strong)' },
  sent: { background: 'var(--accent)', color: '#111111' },
  overdue: { background: '#B42318', color: '#ffffff' },
  paid: { background: 'var(--wa-fill)', color: 'var(--wa-text-2)' },
}

export function InvoiceStatusChip({ status }: { status: InvoiceStatus }) {
  return (
    <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: 999, whiteSpace: 'nowrap', ...STYLE[status] }}>
      {STATUS_NAME[status]}
    </span>
  )
}
