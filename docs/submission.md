# Devpost submission text

Copy each section into the matching Devpost field. Items in `«…»` must be filled in before submitting.

## Project name

Veil

## Tagline

Understand any sensitive document, with your personal data removed on your device before anything reaches the cloud.

## Platform

Web (Chrome)

## Links

- Live app: «https://YOUR-PROJECT.web.app»
- Code: «https://github.com/YOUR-USER/YOUR-REPO» (Apache-2.0, license visible in the About section)
- Demo video (YouTube, public, under 3 minutes): «https://youtu.be/…»

## Inspiration

People paste hospital bills, leases, insurance denials and immigration letters into chatbots because those documents are dense
and the deadlines are real. Those documents also hold exactly what should not be uploaded: full name, date of birth, address,
member and claim numbers, card and account numbers. Many of the people who need the help most (non-native speakers, patients,
tenants) are also the least able to judge that risk.

## What it does

Veil turns a sensitive document into a plain-language explanation while keeping personal data on the device.

1. **Add** a document by pasting text, opening a file or photographing it. Photos are read by Gemini Nano on-device only.
2. **Review**. Pattern rules and Gemini Nano find personal data. Every protected value is highlighted, you can add or remove any
   of them, and you can inspect exactly what would be sent.
3. **Understand**. Gemini in the cloud explains the *redacted* text: summary, deadlines, red flags, key facts, next steps and
   questions to ask, in 11 languages, plus follow-up questions. Real names are filled back in locally.

A **Privacy Ledger** shows for every AI step whether it ran on the device or in the cloud, and how many characters were sent.

## How we use Firebase AI Logic

All inference goes through Firebase AI Logic hybrid inference (`firebase/ai`, `getGenerativeModel` with `InferenceMode`),
initialised with App Check. We use hybrid inference as a **data-sensitivity router**, not only as an availability fallback.
Each task declares the kind of input it handles, and that selects the only modes it may use:

- `ONLY_ON_DEVICE`: reading a photo and finding personal data in the raw text. These steps are built without any cloud
  configuration, so there is nothing to fall back to.
- `PREFER_ON_DEVICE`: document classification on redacted text. Free and instant locally; the cloud fallback is safe because
  the input is already redacted.
- `PREFER_IN_CLOUD`: the explanation and follow-ups on redacted text. Offline, the SDK falls back to Gemini Nano and Veil
  switches to a compact schema and a truncated document for a shorter English summary.

Technical details worth a look:

- One JSON Schema drives structured output on both backends: `responseConstraint` on-device, `responseJsonSchema` in the cloud.
- An **egress guard** re-checks the final payload against the vault and the detectors before any cloud-capable request, and
  blocks it if personal data remains.
- The ledger uses the SDK-reported `inferenceSource`. A raw-data task that somehow ran off-device has its result discarded.
- A **policy invariant** (raw input ⇒ `ONLY_ON_DEVICE`) is unit-tested and asserted at startup.
- Text-only sessions declare only text inputs so they work without Chrome's multimodal flag.

## How we built it

TypeScript, React and Vite; Firebase AI Logic with Gemini Nano (Chrome Prompt API) and Gemini; Firebase App Check and Hosting.
The privacy-critical logic lives in a framework-free `core/` module with unit tests (detectors, vault, egress guard, routing
policy, and `runTask` against a fake hybrid model). Developed with Claude Code as an AI coding assistant.

## Built during the submission period

Everything in this repository was created during the submission period (new project).

## Challenges

- Gemini Nano on the web is single-turn with about 9k tokens, so documents are chunked and follow-ups are self-contained prompts.
- Making "never falls back to the cloud" a property we can test, not a sentence in a README.
- Name detection in free text: rules alone miss it, models hallucinate it. Entities must literally occur in the source chunk, and
  the user always gets a review step.

## Accomplishments

A complete flow rather than a demo: review and correction UI, offline behaviour, 11 languages, accessibility and dark mode, and a
ledger that makes the privacy claim visible instead of asking for trust.

## What we learned

Hybrid inference is most interesting when the routing decision is about the *data*, not just about whether a model happens to
be installed.

## What's next

Chrome extension ("explain this page, privately"), Android and iOS ports using the same routing policy, PDF support with local
text extraction, and per-organisation redaction rules.

## Value proposition

For anyone who has to read dense paperwork they did not choose, Veil gives the clarity of a cloud model without the data
exposure of a cloud chatbot, and shows the evidence.

## Built with

firebase-ai-logic, gemini-nano, gemini, firebase-app-check, firebase-hosting, chrome-prompt-api, typescript, react, vite, vitest

## Testing instructions for judges

1. Open «live URL» in desktop Chrome 139+.
2. Click one of the **fictional sample documents**, then **Find personal data on this device**.
3. Review the highlighted values, then **Explain this document**. Watch the Privacy Ledger on the right.
4. Optional (full on-device path): enable `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, restart, click
   **Download Gemini Nano** in the header, then repeat. Switch off Wi-Fi and run **Explain** again to see the offline fallback.

No login is required. The app is free to use. «If a debug App Check token is needed for the hosted build, state it here.»
