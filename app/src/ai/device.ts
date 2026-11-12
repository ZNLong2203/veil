import { getGenerativeModel, InferenceMode } from 'firebase/ai'
import { deviceCreateOptions } from './models'
import { getAi } from './firebase'

/**
 * Status of the on-device model, for the UI only.
 *
 * `LanguageModel.availability()` is Chrome's capability probe, not inference: it does not run a
 * prompt. All actual inference, including the model download, goes through Firebase AI Logic.
 */
export type DeviceStatus = 'unsupported' | 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface ChromeLanguageModel {
  availability(options?: unknown): Promise<string>
}

const chromeLanguageModel = (): ChromeLanguageModel | undefined =>
  (globalThis as unknown as { LanguageModel?: ChromeLanguageModel }).LanguageModel

export interface DeviceCapabilities {
  text: DeviceStatus
  image: boolean
}

async function probe(image: boolean): Promise<DeviceStatus> {
  const lm = chromeLanguageModel()
  if (!lm) return 'unsupported'
  try {
    const { expectedInputs, expectedOutputs } = deviceCreateOptions({ image })
    const s = await lm.availability({ expectedInputs, expectedOutputs })
    return s === 'available' || s === 'downloadable' || s === 'downloading' ? s : 'unavailable'
  } catch {
    return 'unavailable'
  }
}

export async function getDeviceCapabilities(): Promise<DeviceCapabilities> {
  const text = await probe(false)
  const image = text === 'available' ? (await probe(true)) === 'available' : false
  return { text, image }
}

/**
 * Downloads Gemini Nano through the Firebase AI Logic SDK. Must be called from a user gesture
 * (a click), as required by Chrome's Prompt API.
 */
export async function downloadDeviceModel(onProgress: (fraction: number) => void): Promise<void> {
  const model = getGenerativeModel(getAi(), {
    mode: InferenceMode.ONLY_ON_DEVICE,
    onDeviceParams: { createOptions: deviceCreateOptions() },
  })
  await model.initializeDeviceModel(onProgress)
}
