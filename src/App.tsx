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

function AppRoutes() {
  const depts = useLiveQuery(() => db.departments.toArray())
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

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
