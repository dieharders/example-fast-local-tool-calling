import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled, not fetched from Google, so the only third-party download is the model.
import '@fontsource/anton'
import '@fontsource/caveat/500.css'
import '@fontsource/caveat/700.css'
import '@fontsource/courier-prime/400.css'
import '@fontsource/courier-prime/400-italic.css'
import '@fontsource/courier-prime/700.css'
import '@fontsource/special-elite'
import App from './App'
import './index.css'

// Room for every resource entry, so the "0 bytes sent" counter can't miss one to a full buffer.
performance.setResourceTimingBufferSize?.(1000)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
