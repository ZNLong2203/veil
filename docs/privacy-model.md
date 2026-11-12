# Privacy model

## What Veil promises

For the document you give it:

1. The **original text and any photo** are only ever processed in your browser tab, by plain code and by Gemini Nano
   (`ONLY_ON_DEVICE`). That route throws rather than falling back to the cloud.
2. The text sent to the cloud is the **redacted** text: personal values are replaced by placeholders such as `[PERSON_1]`.
3. Before every request that could reach the cloud, an **egress guard** re-checks the exact payload. If it still contains a
   known value or something the detectors recognise, the request is blocked and the ledger records it.
4. The mapping from placeholders back to real values (the **vault**) exists only in memory. It is never written to storage,
   logged, or sent. Closing the tab or pressing *Clear everything* removes it.
5. Your **follow-up questions** go through the same detectors and vault before they are sent.
6. Values found by Veil's rules are **locked**: they cannot be un-protected, because the egress guard would block them anyway.
   Over-protecting costs little, since real values are filled back in on your device for display.
7. The **self-test** button sends the original document through the real cloud-bound path with a stub model; the guard must
   block it, which demonstrates the guarantee without sending anything.
8. The Privacy Ledger shows what actually happened, using the SDK's reported `inferenceSource`, and stores sizes and counts,
   never text.

## What Veil does not promise

- **Detection is not perfect.** Rules are strong for structured data (emails, phone, card and account numbers, ID formats)
  and weaker for names in running text. Gemini Nano improves that on devices that have it, and the review step lets you fix
  the rest, but a name the model and the rules both miss and you do not notice will be sent.
- When Gemini Nano did not cover the document, Veil says so and requires an explicit confirmation. It cannot verify that you
  actually read the document.
- **Redaction is not anonymisation.** Context (a rare condition, an employer, a small town) can still identify someone.
  Organisation names and non-birth dates are left in on purpose, because the explanation needs them.
- The cloud model still sees the *content* of the document minus personal values. Do not use Veil for material that must never
  leave your control.
- Firebase and Google process the requests that do reach the cloud under their own terms.
- Veil is an explainer, not legal, medical or financial advice. AI output can be wrong.

## Threats considered

| Threat | Mitigation |
|---|---|
| Hybrid SDK silently falls back to the cloud for a raw-data step | Raw-data tasks use `ONLY_ON_DEVICE` with no cloud config; policy invariant tested and asserted at startup; result discarded if source is not on-device |
| Redaction misses a value the user already knows about | Review step: select-to-protect; vault applies to every occurrence, case-insensitively |
| Model hallucinates an entity | Entities must literally occur in the chunk they came from |
| Model output contains placeholders in odd forms | Rehydration accepts `[PERSON_1]`, `PERSON_1`, lower case; unknown placeholders are left alone |
| Error messages or logs leak values | Egress errors report kind and count only; the ledger holds no text |
| User types personal data into a follow-up | Questions are redacted and guarded like the document |
| Prompt injection inside the document | The model only produces text and JSON that is rendered as text; it has no tools and no network access of its own |

## Data handling in the app

- No analytics, no cookies, no `localStorage`/`IndexedDB` use for document content.
- Sample documents are fictional.
- Firebase AI Logic monitoring does not show on-device calls; the ledger is the local record.
