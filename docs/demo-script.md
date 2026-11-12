# Demo video script (target 2:40, hard limit 3:00)

Judging weights four things equally: technological implementation, design, potential impact, quality of the idea. The video
should hit all four in order, and only the first three minutes are evaluated. Record at 1080p in desktop Chrome, narration in
English (or add English subtitles). Use only the fictional sample documents.

| Time | Screen | Say |
|---|---|---|
| 0:00 – 0:15 | Title card, then a chatbot-style paste of a hospital bill with a name, SSN and card number visible | "People paste medical bills and leases into chatbots to understand them. Those documents are full of data you should never upload." |
| 0:15 – 0:30 | Veil home. Header shows *Gemini Nano ready* and *Online* | "Veil explains sensitive paperwork, and removes your personal data on your device first. It uses Firebase AI Logic hybrid inference: Gemini Nano locally, Gemini in the cloud." |
| 0:30 – 0:55 | Click the *Hospital bill* sample, then *Find personal data*. Progress "Gemini Nano is reading…" | "Reading the raw bill is an ONLY_ON_DEVICE step. It can never fall back to the cloud." |
| 0:55 – 1:25 | Review step: highlights, protected-values list. Select a missed word, protect it. Open *Exactly what would be sent* | "Every value is highlighted. I can fix what the model missed. This is exactly what will leave my device: placeholders, no names, no numbers." |
| 1:25 – 1:55 | Click *Explain*, choose Spanish or Vietnamese first. Result: summary, deadlines, red flags. Toggle *Show my real names* | "The explanation runs on redacted text in the cloud, in my language. My real name is put back on this device, never sent." |
| 1:55 – 2:20 | Ledger panel close-up: step list with *On this device* vs *Cloud*, characters sent. Open *Routing policy* | "The ledger is built from the SDK's reported inference source. Photos and detection: on-device. Explanation: cloud, redacted. That's hybrid inference used as a privacy router, not just a fallback." |
| 2:20 – 2:40 | Turn off Wi-Fi (menu bar visible). Click *Explain* again on another sample. Compact summary appears with the offline banner | "Offline, the same call falls back to Gemini Nano with a shorter summary. Personal data was never at risk and the app still helps." |
| 2:40 – 2:55 | Click *Prove it*, show the Blocked ledger entry, then repo + live URL | "If anything personal is left, the egress guard blocks the request. Open source, Apache-2.0. Veil: understand your paperwork, keep your privacy." |

## Getting a "Blocked" entry on camera

In the review step click **Prove it: try to send the original**. It pushes the original document through the real cloud-bound
path; the egress guard blocks it, a green "Self-test passed" banner appears and the ledger shows **Blocked**. Nothing is sent
(the model in this test is a stub that must never be reached), and it works even before Firebase is configured.

## Checklist before recording

- [ ] Gemini Nano downloaded; header chip says *Gemini Nano ready*
- [ ] App Check token registered; one cloud request already succeeded (warm-up)
- [ ] Browser zoom 110–125% so text is legible at 1080p; close unrelated tabs and bookmarks bar
- [ ] Clear the ledger before the take
- [ ] Wi-Fi toggle visible in the menu bar for the offline segment
- [ ] Upload to YouTube as **Public**; confirm it plays logged out
