import { useEffect, useState } from 'react'

export interface BatteryInfo {
  level: number
  charging: boolean
}

interface BatteryManager extends EventTarget {
  level: number
  charging: boolean
}

/** Battery level and charging state, where the browser exposes them (Chrome desktop and Android). */
export function useBattery(): BatteryInfo | null {
  const [info, setInfo] = useState<BatteryInfo | null>(null)

  useEffect(() => {
    const nav = navigator as Navigator & { getBattery?: () => Promise<BatteryManager> }
    if (!nav.getBattery) return
    let manager: BatteryManager | undefined
    let alive = true
    const read = () => {
      if (alive && manager) setInfo({ level: manager.level, charging: manager.charging })
    }
    nav
      .getBattery()
      .then((m) => {
        manager = m
        read()
        m.addEventListener('levelchange', read)
        m.addEventListener('chargingchange', read)
      })
      .catch(() => {
        /* not available: routing simply ignores the battery */
      })
    return () => {
      alive = false
      manager?.removeEventListener('levelchange', read)
      manager?.removeEventListener('chargingchange', read)
    }
  }, [])

  return info
}
