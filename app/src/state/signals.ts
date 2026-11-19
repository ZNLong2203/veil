import type { DeviceCapabilities } from '../ai/device'
import { isFirebaseConfigured } from '../ai/env'
import { guessLanguage, type Signals } from '../core/planner'
import type { BatteryInfo } from './useBattery'

interface NetworkInformation {
  effectiveType?: string
  saveData?: boolean
}

export interface SignalInputs {
  caps: DeviceCapabilities | null
  online: boolean
  text: string
  targetLanguage: string
  cloudEnabled: boolean
  battery: BatteryInfo | null
}

/** Collects what the route planner needs to know about this document, device and connection. */
export function buildSignals(i: SignalInputs): Signals {
  const conn = (navigator as Navigator & { connection?: NetworkInformation }).connection
  return {
    docChars: i.text.length,
    language: guessLanguage(i.text),
    targetLanguage: i.targetLanguage,
    online: i.online,
    saveData: conn?.saveData === true,
    effectiveType: conn?.effectiveType,
    batteryLevel: i.battery?.level,
    charging: i.battery?.charging,
    nano: i.caps?.text ?? 'unknown',
    cloudEnabled: i.cloudEnabled,
    firebaseConfigured: isFirebaseConfigured,
  }
}
