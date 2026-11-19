# Architecture

```
app/src
├── core/      Pure TypeScript. No SDK, no DOM. Everything the privacy promise depends on, fully unit-tested.
│   ├── rules.ts     Deterministic detectors (email, phone, card+Luhn, IBAN+mod97, IDs, DOB, labelled names, addresses)
│   ├── vault.ts     value ⇄ placeholder map ([PERSON_1]); apply / segments / rehydrate; lives in memory only
│   ├── egress.ts    Last check before any cloud-capable request; reports kinds and counts, never values
│   ├── policy.ts    Task → route table and the invariant "raw input ⇒ ON_DEVICE_ONLY"
│   ├── planner.ts   Custom routing: language guess, signals → plan (what runs where, and why)
│   ├── wire.ts      Wire log, request classification, independent re-check of request bodies
│   ├── receipt.ts   Privacy receipt (counts, categories, hashes; never text)
│   ├── ics.ts       RFC 5545 writer for deadline reminders
│   ├── redact.ts    Rules first, then an injected on-device detector, chunked to fit Gemini Nano
│   ├── ledger.ts    Append-only record of where each AI step ran; sizes and counts only
│   └── chunk.ts     Paragraph/sentence chunking for the on-device context window
├── ai/        The only code that touches Firebase AI Logic.
│   ├── firebase.ts  initializeApp + App Check + getAI(GoogleAIBackend)
│   ├── models.ts    Route → InferenceMode; builds hybrid models (onDeviceParams / inCloudParams)
│   ├── run.ts       runTask(): egress guard → generateContent → inferenceSource → ledger
│   ├── tasks.ts     readImage, findEntities, triage, explain, followUp, prompts
│   ├── wireTap.ts   Records cross-origin fetches (never headers or query strings)
│   ├── runtimeConfig.ts  Firebase Remote Config: model names, cloud kill switch, offline text budget (safe defaults)
│   ├── schemas.ts   JSON Schemas shared by the on-device and cloud backends
│   └── device.ts    Gemini Nano availability probe and download (via initializeDeviceModel)
├── state/     React hooks: session state machine, device status
└── ui/        Add / Review / Understand steps, Route plan, Action kit, Privacy Ledger, Wire view, header chips
```

## Data flow

```mermaid
sequenceDiagram
    participant U as User
    participant R as Rules (local code)
    participant N as Gemini Nano (ONLY_ON_DEVICE)
    participant V as Vault (memory)
    participant G as Egress guard
    participant C as Gemini cloud (PREFER_IN_CLOUD)

    U->>R: document text
    R->>V: structured identifiers, labelled names, addresses
    U->>N: raw chunks (never leaves the device)
    N->>V: names / addresses found in free text
    U->>V: review: add or remove values
    V->>G: redacted text
    G-->>G: vault values? detector hits? → block
    G->>C: redacted text only
    C->>V: answer containing [PERSON_1] placeholders
    V->>U: rehydrated answer, shown locally
```

If the network is down, `PREFER_IN_CLOUD` falls back to Gemini Nano with a compact schema and a truncated, still-redacted
document (the SDK falls back on `FETCH_ERROR`, `ERROR` and `API_NOT_ENABLED`).

## Custom routing

`planRoutes(signals)` is pure. Signals: document size and language, `navigator.onLine`, `connection.saveData`, battery level and
charging state, Gemini Nano status, and the Remote Config kill switch. Examples of decisions it makes:

- raw-data step: always `ONLY_ON_DEVICE`; skipped (and review required) when Nano is not ready, never replaced by the cloud;
- triage: on-device normally, cloud (redacted) when the battery is below 20% and not charging;
- explain / follow-up / draft: cloud normally; fully on-device with a compact schema when offline or when the kill switch is off.

The UI shows the plan before anything runs, so each decision has a visible reason.

## Why these modes

| Concern | Decision |
|---|---|
| Raw data must never reach the cloud | `ONLY_ON_DEVICE` throws instead of falling back. The model is built with no `inCloudParams` at all. |
| Gemini Nano on web is single-turn, ~9k tokens, text + one image | Chunk the document; each follow-up is one self-contained prompt; images are read on-device only. |
| Gemini Nano may be missing (other browsers, weak hardware, not downloaded) | Rules still run; review requires explicit confirmation; explanations still work through the cloud on redacted text. |
| Same output shape on both backends | One JSON Schema → `responseConstraint` (on-device) and `responseJsonSchema` (cloud). |
| Default SDK session asks for image input | Text-only models declare only text inputs, so they work without the multimodal flag. |
| Cloud must be switchable without a deploy | Remote Config `cloud_enabled=false` downgrades every cloud-capable route to `ON_DEVICE_ONLY` (`effectiveRoute`). Remote values are validated and only applied when they truly came from the server. |
| Proof, not promises | Ledger entries use the SDK-reported `inferenceSource`. A raw-data task that ran off-device has its result discarded. |

## Platform scope

The shipped target is **Web (Chrome)**. The routing policy in `core/policy.ts` is platform-neutral by design, so the same
table maps onto `OnDeviceConfig(mode = ...)` on Android and `HybridModel(primary:secondary:)` on iOS. Those ports are not part
of this submission.

## Testing

`npm test` runs Vitest: detectors against fictional documents, vault round-trips, the egress guard, the policy invariant, and
`runTask` against a fake hybrid model (blocked payloads never reach the model, the ledger reflects the reported source, raw-data
tasks that run in the cloud are rejected).
