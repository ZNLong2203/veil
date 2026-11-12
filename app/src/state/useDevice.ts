import { useCallback, useEffect, useState } from 'react'
import { downloadDeviceModel, getDeviceCapabilities, type DeviceCapabilities } from '../ai/device'
import { isFirebaseConfigured } from '../ai/env'

export interface DeviceState {
  caps: DeviceCapabilities | null
  online: boolean
  /** 0..1 while the model is downloading, null otherwise. */
  progress: number | null
  error: string | null
  download: () => Promise<void>
  refresh: () => Promise<void>
}

/** Tracks Gemini Nano availability and connectivity for the header chip and the routing UI. */
export function useDevice(): DeviceState {
  const [caps, setCaps] = useState<DeviceCapabilities | null>(null)
  const [online, setOnline] = useState(() => navigator.onLine)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => setCaps(await getDeviceCapabilities()), [])

  useEffect(() => {
    void refresh()
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [refresh])

  const download = useCallback(async () => {
    setError(null)
    if (!isFirebaseConfigured) {
      setError('Firebase is not configured yet, so the model download (which goes through Firebase AI Logic) cannot start.')
      return
    }
    setProgress(0)
    try {
      await downloadDeviceModel(setProgress)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setProgress(null)
      await refresh()
    }
  }, [refresh])

  return { caps, online, progress, error, download, refresh }
}
