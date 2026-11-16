import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './lib/theme'
import App from './App.tsx'
import { Capacitor } from '@capacitor/core'

// In the iPhone app, tapping a field must not zoom the page in (iOS does that for text under 16px).
// The website keeps pinch-zoom.
if (Capacitor.isNativePlatform()) {
  document.querySelector('meta[name=viewport]')?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
