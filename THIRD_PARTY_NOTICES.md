# Third-party notices

Veil is released under the Apache License 2.0 (see `LICENSE`). It uses the open-source software and fonts below under their own licenses. Versions are those in `app/package-lock.json` at the time of writing.

## Runtime (shipped in the web app)

| Package | Version | License | Use |
|---|---|---|---|
| firebase (Firebase JS SDK) | 13.3.0 | Apache-2.0 | Firebase AI Logic hybrid inference, App Check, Remote Config |
| react, react-dom | 19.3.1 | MIT | User interface |
| @fontsource-variable/inter | 5.3.0 | OFL-1.1 | Body typeface (Inter) |
| @fontsource-variable/fraunces | 5.3.0 | OFL-1.1 | Display typeface (Fraunces) |
| @fontsource-variable/jetbrains-mono | 5.3.0 | OFL-1.1 | Monospace typeface for placeholders (JetBrains Mono) |

The fonts are served from the app's own origin (no font CDN is contacted). Inter, Fraunces and JetBrains Mono are licensed under the SIL Open Font License 1.1, <https://openfontlicense.org>; their copyright belongs to their respective authors.

## Development only (not shipped)

Vite, Vitest, @vitejs/plugin-react, jsdom, oxlint (MIT) and TypeScript (Apache-2.0).

## Services

Veil calls Gemini models only through Firebase AI Logic. Use of Firebase and the Gemini API is subject to Google's terms for those services. "Google", "Firebase" and "Gemini" are trademarks of Google LLC, used here only to name the technologies Veil is built with. Veil is not affiliated with or endorsed by Google.

## Sample data

Every person, address, number and organisation in the bundled sample documents is fictional. Reserved test values are used where they exist (555-01xx phone numbers, 9xx Social Security numbers, the 4111 1111 1111 1111 test card).
