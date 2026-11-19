# Setup

## 1. Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com/) (or reuse one).
2. Open **Build → AI Logic** and click **Get started**. Choose the **Gemini Developer API** (free tier covers text inference).
3. **Project settings → Your apps → Add app → Web**. Copy the config object.
4. Copy `app/.env.example` to `app/.env.local` and fill in the `VITE_FIREBASE_*` values. `.env.local` is gitignored.

## 2. App Check (required by Firebase AI Logic)

Firebase AI Logic enforces App Check, so cloud calls are rejected without it.

**Production / hosted demo**

1. Create a reCAPTCHA v3 site key at <https://www.google.com/recaptcha/admin> and add your hosting domain
   (for example `your-project.web.app`) and `localhost`.
2. **Firebase console → App Check → Apps → your web app → reCAPTCHA v3**, paste the *secret* key.
3. Put the *site* key in `VITE_APPCHECK_RECAPTCHA_SITE_KEY`.

If you created a **reCAPTCHA Enterprise** key instead (Google Cloud console), register the app with the *reCAPTCHA Enterprise* provider in
App Check (no secret key is needed) and set `VITE_APPCHECK_PROVIDER=enterprise`.

**Local development and judging (debug token)**

1. Set `VITE_APPCHECK_DEBUG_TOKEN=true` and run the app. The browser console prints
   `App Check debug token: <uuid>` on first load.
2. **Firebase console → App Check → Apps → your web app → ⋮ → Manage debug tokens → Add**, paste the token.
3. To reuse the token on another machine, set `VITE_APPCHECK_DEBUG_TOKEN=<uuid>`.

Do not commit a debug token that is tied to a production project you care about. Debug tokens are accepted in hackathon
submissions, but treat them like a password.

## 3. Gemini Nano in Chrome (for the on-device path)

- Chrome **139+** on desktop (Windows, macOS, Linux). Enough free disk space for the model download.
- Open `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`, set it to **Enabled**, restart Chrome.
- Open Veil and click **Download Gemini Nano** in the header (a click is required by the Prompt API). The download goes
  through the Firebase AI Logic SDK (`initializeDeviceModel`). It can take several minutes.
- Check `chrome://on-device-internals` if the status chip says the model is unavailable on your device.

Without Gemini Nano the app still works: the rule-based detectors run, the review step requires explicit confirmation, and
explanations use the cloud model on redacted text.

## 4. Models

`VITE_CLOUD_MODEL` (default `gemini-3.5-flash`) is used for the explanation. `VITE_CLOUD_MODEL_LITE`
(default `gemini-3.5-flash-lite`) is the cloud fallback for light on-device-first tasks. Model names change; check the
[Firebase AI Logic model list](https://firebase.google.com/docs/ai-logic/models).

## 5. Remote Config (optional)

Veil reads four optional parameters from Firebase Remote Config. If you create none of them, or the fetch fails, the values
from `.env.local` apply and nothing breaks. Values are validated before use (model names must look like model names; the
on-device text budget is clamped to 1,000–12,000 characters).

| Parameter | Type | Meaning |
|---|---|---|
| `cloud_model` | string | Cloud model for the explanation and follow-ups |
| `cloud_model_lite` | string | Cloud fallback for light, on-device-first tasks |
| `cloud_enabled` | boolean | **Kill switch.** `false` makes every step on-device only; nothing reaches the cloud |
| `compact_max_chars` | number | Characters of redacted text given to Gemini Nano for the offline summary |

Create them in **Firebase console → Run → Remote Config**, then **Publish changes**.

## 6. Run

```bash
cd app && npm ci && npm run dev
```

## 7. Deploy to Firebase Hosting

```bash
npm install -g firebase-tools   # or use npx firebase-tools
firebase login
firebase use --add              # pick your project
cd app && npm run build && cd ..
firebase deploy --only hosting
```

`firebase.json` serves `app/dist` as a single-page app.

## Troubleshooting

| Symptom | Cause |
|---|---|
| "Firebase is not configured" banner | `app/.env.local` missing or incomplete. Restart `npm run dev` after editing it. |
| App Check error on every cloud call | No token registered. See step 2. |
| `api-not-enabled` / `PERMISSION_DENIED` | AI Logic is not enabled for the project (step 1.2). |
| Chip says "On-device AI not supported" | Not desktop Chrome 139+, or the Prompt API flag is off. |
| Chip says "unavailable on this device" | Hardware below Chrome's Gemini Nano requirements. Veil still works with rules plus review. |
| Photo reading refuses | Needs Gemini Nano with image input (flag in step 3). Paste the text instead. |
