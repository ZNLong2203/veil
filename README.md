# Veil

**Understand sensitive paperwork in plain language, without handing your personal data to a cloud chatbot.**

Veil is a web app (Chrome) built for the [#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/) hackathon with
**Firebase AI Logic hybrid inference**. Gemini Nano runs on your device and removes your name, address, ID and account
numbers; only the redacted text goes to Gemini in the cloud for the heavy lifting. Real values are put back on your
device when the answer arrives.

## The problem

People paste hospital bills, leases, insurance denials and immigration letters into chatbots because those documents are
dense and the deadlines are real. Those same documents contain exactly the data you should not upload: full name, date
of birth, address, member and claim numbers, card and account numbers.

## What Veil does

1. **Add** a document: paste text, open a file, or take a photo. Photos are read by Gemini Nano **on-device only**.
2. **Review** what stays on your device. Deterministic rules plus Gemini Nano find personal data. You see your document and
   the exact redacted copy side by side, can add or remove values, and see a **route plan**: what will run where for this
   document and this device, and why.
3. **Understand**: a plain-language summary, deadlines, red flags, key facts, next steps and questions to ask, in 11 languages.
   Real names are filled back in locally.
4. **Do the next thing** with the **action kit**: a drafted dispute letter or phone script (the cloud writes with
   placeholders, your real details are filled in on this device and highlighted), and an `.ics` file with the deadlines.

Two panels make the privacy claim checkable instead of asking for trust:

- the **Privacy Ledger** shows, for every AI step, where it ran (`this device`, `cloud`, `blocked`);
- **On the wire** records every request that really left the tab, re-checks those bytes independently, shows the exact text
  that was sent, and exports a **privacy receipt** (counts, categories and hashes, never your text).

## How hybrid inference is used

Hybrid inference is usually pitched as an availability fallback. Veil uses it as a **data-sensitivity router**: each task
declares what kind of input it handles, and that decides which `InferenceMode` it may use.

| Task | Input | Mode | Why |
|---|---|---|---|
| Read a photo | raw image | `ONLY_ON_DEVICE` | The photo contains everything about you. Never uploaded. |
| Find personal data | raw text | `ONLY_ON_DEVICE` | Needs the original text, so it can never fall back to the cloud. |
| Identify document type | redacted | `PREFER_ON_DEVICE` | Short and free on-device; cloud fallback is safe because input is redacted. |
| Explain, translate | redacted | `PREFER_IN_CLOUD` | Long documents need the larger model; offline, Gemini Nano takes over with a shorter English summary. Run as a short chain with a 20 s timeout per cloud try: main model, lighter model, then the compact on-device variant. |
| Follow-up questions | redacted | `PREFER_IN_CLOUD` | Same. Chat is not available on-device, so each question is a self-contained prompt. |
| Draft letter / call script | redacted | `PREFER_IN_CLOUD` | The cloud writes with placeholders; real values are filled in locally. |

The static table says what each task *may* do. A **route planner** ([`planner.ts`](app/src/core/planner.ts)) decides what it *will* do for this
document and device: language (Gemini Nano officially supports en/es/ja), size, connectivity, data saver, battery, Nano status and a
Remote Config kill switch. A language outside Nano's list still runs on-device but is best-effort and needs the user's confirmation.

Guarantees enforced in code and covered by tests:

- **Policy invariant** ([`policy.ts`](app/src/core/policy.ts)): a task that reads raw data may only use `ONLY_ON_DEVICE`.
  The app refuses to start if that is ever violated.
- **Egress guard** ([`egress.ts`](app/src/core/egress.ts)): before any request that *could* reach the cloud, the final payload
  is re-checked against the vault and the detectors. Anything that still looks personal is blocked and logged.
- **Evidence, not promises** ([`run.ts`](app/src/ai/run.ts)): the ledger is built from the SDK's reported `inferenceSource`.
  If a raw-data task somehow ran in the cloud, its result is discarded.
- **The planner can never re-route raw data**: whatever the signals, the raw-data step stays `ONLY_ON_DEVICE` (tested over every signal mix).
- **Independent wire check**: [`wireTap.ts`](app/src/ai/wireTap.ts) records real requests at the network layer and re-checks the bodies.
- **One schema, two backends**: the same JSON Schema drives structured output on-device (`responseConstraint`) and in the
  cloud (`responseJsonSchema`) ([`models.ts`](app/src/ai/models.ts)).

Firebase AI Logic is called in [`app/src/ai/models.ts`](app/src/ai/models.ts) (`getGenerativeModel` with `InferenceMode`) and
[`app/src/ai/run.ts`](app/src/ai/run.ts) (`generateContent`), initialised with App Check in
[`app/src/ai/firebase.ts`](app/src/ai/firebase.ts).

## Firebase products used

**AI Logic** (hybrid inference, the core), **App Check** (required by AI Logic; reCAPTCHA v3 or debug token),
**Remote Config** (model names, a cloud kill switch, offline text budget, all with safe defaults), **Hosting**.
Veil deliberately does not use Firestore or Auth: documents are never stored.

## Quick start

Requirements: Node 22+, Chrome 139+ on desktop (for Gemini Nano), a Firebase project. Full steps in
[docs/setup.md](docs/setup.md).

```bash
cd app
npm ci
cp .env.example .env.local   # fill in your Firebase web config + App Check
npm run dev                  # http://localhost:5173
npm test                     # unit tests (privacy contract, detectors, vault, guard)
npm run build
npm run check                # typecheck + tests + build, as CI runs
```

Without Firebase config the app still runs the Add and Review steps (rules run locally); the AI steps are disabled and say so.

## Documentation

- [Setup (Firebase, App Check, Chrome flags, hosting)](docs/setup.md)
- [Architecture](docs/architecture.md)
- [Privacy model and its limits](docs/privacy-model.md)
- [Research notes](docs/research.md)
- [Devpost submission text](docs/submission.md) and [demo video script](docs/demo-script.md)

## Limits (honest)

Veil lowers risk; it does not make a document safe by itself. Detection is imperfect, which is why the review step
exists and why Veil requires an explicit confirmation when Gemini Nano did not cover the document. See
[docs/privacy-model.md](docs/privacy-model.md). Veil explains documents; it is not legal, medical or financial advice.

## License

[Apache-2.0](LICENSE)
