import { Component, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { Projects } from './pages/Projects'
import { Opportunities } from './pages/Opportunities'
import { Studio } from './pages/Studio'
import { Account } from './pages/Account'
import { Onboarding } from './pages/Onboarding'
import { ProjectDetail } from './pages/ProjectDetail'
import { WorkDetail, LegacyBookRedirect } from './pages/WorkDetail'
import { AllEvents } from './pages/AllEvents'
import { VisionBoard } from './pages/VisionBoard'
import { WorldMap } from './pages/WorldMap'
import { Career } from './pages/Career'
import { Press } from './pages/Press'

// Shown instead of a blank page if the local database can't be opened (e.g. an upgrade fails).
function DataError({ detail }: { detail: string }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F5F5F5' }}>
      <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '32px 36px', maxWidth: 440, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
        <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 22, fontWeight: 400, margin: '0 0 10px', color: '#111111' }}>Your data couldn't be opened</h1>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: '#666666', margin: '0 0 18px' }}>Nothing has been deleted. Reload to try again.</p>
        <button onClick={() => location.reload()} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Reload</button>
        <p style={{ fontSize: 10, color: '#AAAAAA', margin: '18px 0 0', wordBreak: 'break-word' }}>{detail}</p>
      </div>
    </div>
  )
}

function AppRoutes() {
  const [openError, setOpenError] = useState<string | null>(null)
  useEffect(() => {
    db.open().catch((e: unknown) => setOpenError(e instanceof Error ? `${e.name}: ${e.message}` : String(e)))
  }, [])
  const depts = useLiveQuery(() => db.departments.toArray())
  if (openError) return <DataError detail={openError} />
  if (depts === undefined) return null
  if (depts.length === 0) return <Onboarding />

  return (
    <Routes>
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/events" element={<AllEvents />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/opportunities" element={<Opportunities />} />
      <Route path="/manifest" element={<VisionBoard />} />
      <Route path="/the-map" element={<Navigate to="/manifest" replace />} />
      <Route path="/the-map/vision" element={<Navigate to="/manifest" replace />} />
      <Route path="/the-map/world" element={<Navigate to="/career/map" replace />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/studio/boards" element={<Navigate to="/manifest" replace />} />
      <Route path="/studio/books/:id" element={<LegacyBookRedirect />} />
      <Route path="/studio/:id" element={<WorkDetail />} />
      <Route path="/career" element={<Career />} />
      <Route path="/career/map" element={<WorldMap />} />
      <Route path="/career/recognition" element={<Press />} />
      <Route path="/press" element={<Navigate to="/career/recognition" replace />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/projects" replace />} />
    </Routes>
  )
}

// If a page crashes, show what went wrong instead of a blank screen. Data is never touched here.
class PageErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: '' }
  static getDerivedStateFromError(error: Error) { return { error, where: location.pathname } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('[Working Artist]', error, info.componentStack) }
  render() {
    const { error, where } = this.state
    if (!error) return this.props.children
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: '#F5F5F5' }}>
        <div style={{ background: '#FFFFFF', borderRadius: 20, padding: '32px 36px', maxWidth: 460, boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
          <h1 style={{ fontFamily: 'Recoleta, serif', fontSize: 22, fontWeight: 400, margin: '0 0 10px', color: '#111111' }}>This page hit a problem</h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: '#666666', margin: '0 0 18px' }}>Your data is safe. Go back to your desk, or reload to try again.</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { location.href = '/projects' }} style={{ background: '#F5E642', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>On My Desk</button>
            <button onClick={() => location.reload()} style={{ background: '#F5F5F5', border: 'none', borderRadius: 8, padding: '9px 18px', fontSize: 11, cursor: 'pointer' }}>Reload</button>
          </div>
          <p style={{ fontSize: 10, color: '#AAAAAA', margin: '18px 0 0', wordBreak: 'break-word' }}>{where} · {error.name}: {error.message}</p>
        </div>
      </div>
    )
  }
}

export default function App() {
  return (
    <BrowserRouter>
      <PageErrorBoundary>
        <AppRoutes />
      </PageErrorBoundary>
    </BrowserRouter>
  )
}
