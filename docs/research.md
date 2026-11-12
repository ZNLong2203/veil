# Research notes

Summary of the research that shaped Veil's design. Facts were checked against the
official Firebase / Android / Chrome documentation on 2026-11-12. The hybrid APIs are
marked **experimental**, so re-check them before relying on any detail.

## What Firebase AI Logic hybrid inference gives us

| Platform | On-device engine | Modes | Hard limits that shape the design |
|---|---|---|---|
| Web (Chrome desktop 139+) | Gemini Nano via Chrome Prompt API | `PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `PREFER_IN_CLOUD`, `ONLY_IN_CLOUD` | Single-turn only (no chat). Text plus one JPEG/PNG image. About 9,216 tokens. Structured JSON/enum output works on-device. No tools, no audio, no token counting. Model download needs a user gesture. |
| Android | Gemini Nano via AICore / ML Kit Prompt API | same four modes | About 4,000 tokens. Single-turn text plus one Bitmap. English/Korean validated. Foreground only. Experimental SDK (`firebase-ai-ondevice`). |
| iOS | Apple Foundation Models | selected by the order of `HybridModel(primary:secondary:)` | About 4,096 tokens. Text only on-device. Function calling and structured output are supported on-device. SwiftPM only. |

Across platforms: `result.response.inferenceSource` (web/Android) or `rawResponse.modelVersion` (iOS)
reports where a request really ran. App Check is enforced for the cloud path.

## What previous winners did (Chrome Built-in AI Challenge 2024 and 2025)

Judging criteria there: functionality, purpose, content, user experience, technical execution.

- **Best hybrid app 2025:** Mentelo (on-page tech-support extension) and Trail (offline trail companion).
- **Best hybrid app 2024:** Orma (browser memory layer) and BrowseGraph (in-browser GraphRAG).
- **Most helpful 2025:** Nutshell (hands-free browsing) and AAC Board AI (private, offline communication aid).
- **Best multimodal 2025:** Phonaify (pronunciation feedback) and Pet Shelter App.

Patterns worth copying:

1. A real, specific person with a real problem, often accessibility or a vulnerable group.
2. A *stated reason* for hybrid. The hybrid category description explicitly asks for "a clear reason why the submission benefits from a hybrid AI approach".
3. Privacy and offline behaviour as visible product features, not footnotes.
4. A finished product experience, not a proof of concept.

## How this maps to the #BuildHybridAI 2026 criteria

| Criterion | Veil's answer |
|---|---|
| Technological implementation | Per-task routing policy over all four `InferenceMode`s, `inferenceSource` verification, an egress guard that blocks PII from reaching the cloud, structured output on both backends, App Check. |
| Design | A guided flow (add document, review what stays local, understand), plus a live Privacy Ledger. |
| Potential impact | People who must read dense, sensitive paperwork (medical bills, leases, immigration letters, insurance denials), often in a second language. |
| Quality of the idea | Hybrid used as a *data-sensitivity router*, not only an availability fallback. |

## Sources

- Firebase AI Logic hybrid on-device inference (web): https://firebase.google.com/docs/ai-logic/hybrid-on-device-inference
- Firebase AI Logic hybrid, Android: https://firebase.google.com/docs/ai-logic/hybrid/android/get-started
- Firebase AI Logic hybrid, iOS: https://firebase.google.com/docs/ai-logic/hybrid/ios/get-started
- Android hybrid inference overview: https://developer.android.com/ai/hybrid
- Chrome Built-in AI Challenge 2025 winners: https://developer.chrome.com/blog/ai-challenge-winners-2025
- Chrome Built-in AI Challenge 2024 winners: https://developer.chrome.com/blog/ai-challenge-winners
