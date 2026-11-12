import {
  getGenerativeModel,
  InferenceMode,
  type GenerativeModel,
  type LanguageModelCreateOptions,
  type ModelParams,
  type OnDeviceParams,
} from 'firebase/ai'
import type { Route } from '../core/policy'
import { getAi } from './firebase'

/** Route (Veil's vocabulary) → Firebase AI Logic hybrid inference mode. */
export const INFERENCE_MODE: Record<Route, InferenceMode> = {
  ON_DEVICE_ONLY: InferenceMode.ONLY_ON_DEVICE,
  PREFER_ON_DEVICE: InferenceMode.PREFER_ON_DEVICE,
  PREFER_CLOUD: InferenceMode.PREFER_IN_CLOUD,
  CLOUD_ONLY: InferenceMode.ONLY_IN_CLOUD,
}

const TEXT_IN = { type: 'text' as const, languages: ['en'] }
const TEXT_OUT = { type: 'text' as const, languages: ['en'] }

/**
 * Text-only sessions declare only text inputs. The SDK default also asks for image input,
 * which makes Chrome report "unavailable" unless the multimodal flag is on.
 */
export function deviceCreateOptions(opts: { image?: boolean; system?: string } = {}): LanguageModelCreateOptions {
  return {
    expectedInputs: opts.image ? [TEXT_IN, { type: 'image' }] : [TEXT_IN],
    expectedOutputs: [TEXT_OUT],
    ...(opts.system
      ? { initialPrompts: [{ role: 'system' as const, content: [{ type: 'text' as const, value: opts.system }] }] }
      : {}),
  }
}

export interface ModelSpec {
  route: Route
  system: string
  /** JSON Schema used for structured output on BOTH backends (one source of truth). */
  schema?: Record<string, unknown>
  /** Cloud model name. Not needed (and not configured) for ON_DEVICE_ONLY. */
  cloudModel?: string
  image?: boolean
  temperature?: number
}

/**
 * Builds a hybrid model. The configuration is split exactly the way Firebase AI Logic wants it:
 *   - `onDeviceParams`: Gemini Nano (Chrome Prompt API) session options + `responseConstraint`
 *   - `inCloudParams`:  Gemini model name, system instruction + `responseJsonSchema`
 * ON_DEVICE_ONLY models get no `inCloudParams` at all, so there is nothing to fall back to.
 */
export function buildModel(spec: ModelSpec): GenerativeModel {
  const onDeviceParams: OnDeviceParams = {
    createOptions: deviceCreateOptions({ image: spec.image, system: spec.system }),
    ...(spec.schema ? { promptOptions: { responseConstraint: spec.schema } } : {}),
  }

  const mode = INFERENCE_MODE[spec.route]
  if (spec.route === 'ON_DEVICE_ONLY') {
    return getGenerativeModel(getAi(), { mode, onDeviceParams })
  }

  const inCloudParams: ModelParams = {
    model: spec.cloudModel ?? '',
    systemInstruction: spec.system,
    generationConfig: {
      temperature: spec.temperature ?? 0.2,
      ...(spec.schema ? { responseMimeType: 'application/json', responseJsonSchema: spec.schema } : {}),
    },
  }
  return getGenerativeModel(getAi(), { mode, onDeviceParams, inCloudParams })
}
