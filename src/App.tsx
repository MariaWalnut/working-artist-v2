import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'
import { Today } from './pages/Today'
import { Projects } from './pages/Projects'
import { Opportunities } from './pages/Opportunities'
import { TheMap } from './pages/TheMap'
import { Studio } from './pages/Studio'
import { Account } from './pages/Account'
import { Onboarding } from './pages/Onboarding'
import { ProjectDetail } from './pages/ProjectDetail'
import { WorkDetail } from './pages/WorkDetail'
import { BookDetail } from './pages/BookDetail'
import { AllEvents } from './pages/AllEvents'
import { WorldMap } from './pages/WorldMap'
import { VisionBoard } from './pages/VisionBoard'

function AppRoutes() {
  const depts = useLiveQuery(() => db.departments.toArray())
  if (depts === undefined) return null
  if (depts.length === 0) return <Onboarding />

  return (
    <Routes>
      <Route path="/today" element={<Today />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/projects/events" element={<AllEvents />} />
      <Route path="/projects/:id" element={<ProjectDetail />} />
      <Route path="/opportunities" element={<Opportunities />} />
      <Route path="/the-map" element={<TheMap />} />
      <Route path="/the-map/world" element={<WorldMap />} />
      <Route path="/studio" element={<Studio />} />
      <Route path="/studio/boards" element={<VisionBoard />} />
      <Route path="/studio/books/:id" element={<BookDetail />} />
      <Route path="/studio/:id" element={<WorkDetail />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
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
