import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FrameHeader } from './FrameHeader'
import { FrameTitle } from './PageFrame'

// The full view of one Career box: a white frame, with the way back to Career beside its title.
export function CareerFrame({ title, right, children }: { title: string; right?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div data-tour="career" style={{ background: 'var(--wa-surface)', borderRadius: 20, overflow: 'hidden' }}>
      <FrameHeader right={right}>
        <button onClick={() => navigate('/career')}
          style={{ padding: 0, border: 'none', background: 'none', fontSize: 12, color: 'var(--wa-text-2)', cursor: 'pointer', fontFamily: 'inherit', marginRight: 6 }}>← Career</button>
        <FrameTitle>{title}</FrameTitle>
      </FrameHeader>
      {children}
    </div>
  )
}
