# Demo video script (target 2:50, hard limit 3:00)

Judging weights four things equally: technological implementation, design, potential impact, quality of the idea. Only the first three
minutes are evaluated. The story arc: *a real problem → hybrid used as a privacy router → proof you can check → a result you can act on*.
Record at 1080p in desktop Chrome, narration in English (or add English subtitles). Use only the fictional sample documents.

| Time | Screen | Say |
|---|---|---|
| 0:00 – 0:15 | A hospital bill with a name, SSN and card number, then a chatbot box | "People paste medical bills and leases into chatbots to understand them. Those documents are full of data you should never upload." |
| 0:15 – 0:28 | Veil home, hero flow diagram. Header: *Gemini Nano ready*, *Online* | "Veil explains sensitive paperwork and removes your personal data on your device first, using Firebase AI Logic hybrid inference: Gemini Nano locally, Gemini in the cloud." |
| 0:28 – 0:48 | Click *Try it on a sample bill*. Progress "Gemini Nano is reading…" | "Reading the raw bill is an ONLY_ON_DEVICE step. It can never fall back to the cloud." |
| 0:48 – 1:15 | Review step: side-by-side. Select a missed word and protect it. Scroll to the **Route plan** card | "On the left, my document. On the right, exactly what the cloud will see. And a route plan: for this document, on this device, what runs where and why. Battery, language, connection, whether Nano is ready." |
| 1:15 – 1:40 | Choose *Español* or *Tiếng Việt*, click *Explain*. Result: summary, deadlines, red flags. Toggle *Show my real names* | "Only the redacted text goes to Gemini in the cloud, and the answer comes back in my language. My real name is put back on this device." |
| 1:40 – 2:15 | Action kit: pick the out-of-network flag, *Draft the letter*. Letter appears with highlighted details | "Now the useful part. The cloud wrote this letter using placeholders. My name, address and claim number, highlighted here, were filled in on this device. The cloud never saw them. Copy, print, or add the deadlines to my calendar." |
| 2:15 – 2:40 | The green **Checked on the wire** bar under the answer, then *See the exact bytes* and *Show the exact text sent*. Click *Download receipt* | "Don't trust us, check. This is recorded at the network layer: the real request, the exact text, thirteen placeholders, no personal data. On-device steps make no request at all. This receipt holds counts and hashes, never my text." |
| 2:40 – 2:55 | Click *Prove it: try to send the original*, then repo and live URL | "And if anything personal is left, the egress guard blocks the request. Open source, Apache-2.0. Veil: understand your paperwork, keep your privacy." |

If there is room, add the offline moment (turn off Wi-Fi, run *Explain*, show the compact on-device summary) by trimming the
Español/Tiếng Việt step. Do not exceed 3:00.

## Getting a "Blocked" entry on camera

In the review step click **Prove it: try to send the original**. It pushes the original document through the real cloud-bound
path; the egress guard blocks it, a "Self-test passed" banner appears and the ledger shows **Blocked**. Nothing is sent (the model in
this test is a stub that must never be reached), and it works even before Firebase is configured.

## Checklist before recording

- [ ] Gemini Nano downloaded; header chip says *Gemini Nano ready*; wait for the *Warm up Gemini Nano* ledger entry to finish
- [ ] Firebase AI Logic enabled and App Check token registered; one cloud request already succeeded (warm-up), so the explanation
      comes from the cloud and the ledger says **Cloud**
- [ ] Browser zoom 110–125% so text is legible at 1080p; close unrelated tabs and the bookmarks bar
- [ ] Clear the ledger and the wire log before the take
- [ ] Draft the letter once beforehand so the model is loaded, then clear it and do the take
- [ ] Upload to YouTube as **Public**; confirm it plays logged out
