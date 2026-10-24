import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { FrameHeader, FrameTabs } from './FrameHeader'

const TABS = [
  { key: 'timeline', label: 'Timeline', to: '/career' },
  { key: 'map', label: 'Map', to: '/career/map' },
  { key: 'recognition', label: 'Recognition', to: '/career/recognition' },
] as const

type CareerTab = typeof TABS[number]['key']

// One white frame for each Career view, with the three views as titles in its header.
export function CareerFrame({ active, right, children }: { active: CareerTab; right?: ReactNode; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <div data-tour="career" style={{ background: '#FFFFFF', borderRadius: 20, overflow: 'hidden' }}>
      <FrameHeader right={right}>
        <FrameTabs label="Career" tabs={TABS.map(t => ({ key: t.key, label: t.label }))} active={active}
          onSelect={k => navigate(TABS.find(t => t.key === k)!.to)} />
      </FrameHeader>
      {children}
    </div>
  )
}
