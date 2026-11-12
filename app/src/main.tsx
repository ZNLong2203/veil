import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/fraunces'
import '@fontsource-variable/jetbrains-mono'
import App from './App'
import { policyViolations } from './core/policy'
import './index.css'

// Fail loudly at startup if a routing change would let raw data reach the cloud.
const violations = policyViolations()
if (violations.length > 0) throw new Error(`Routing policy violates the privacy contract: ${violations.join(', ')}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
