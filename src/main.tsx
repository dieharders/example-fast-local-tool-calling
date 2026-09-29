import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// Room for every resource entry, so the "0 bytes sent" counter can't miss one to a full buffer.
performance.setResourceTimingBufferSize?.(1000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
