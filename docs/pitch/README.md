# RollCall hackathon pitch

HTML-first hackathon pitch. Five slides, English slide copy and speech, Russian presenter cues. No conversion or publication yet.

Open `rollcall-pitch.html` directly in a browser. It is a single offline file, including all photos, styles, scripts and icons. The editable source is `index.html`, `pitch.css`, `pitch.js` and `assets/`. Run `python3 build.py` after editing to rebuild the single-file HTML. Alternatively, serve this folder with `python3 -m http.server 4173` and open http://localhost:4173.

## Timing

| Slide | Slot | Purpose |
| --- | --- | --- |
| 1 | 0:00–0:15 | Problem: asking guests to send photos |
| 2 | 0:15–0:35 | Solution: one shared event album |
| 3 | 0:35–0:47 | Product facts: one QR code, zero app installs |
| 4 | 0:47–1:12 | Automatic grouping and concrete search example |
| 5 | 1:12–1:25 | Hand off to live demo |
| Live demo | 1:25–2:55 | 90 seconds in the app |
| 5, reused | 2:55–3:00 | Closing line after the demo |

Speech totals 90 seconds, including the closing line after the demo. These are rehearsal targets, not measured claims about app speed. The full speech is in the Notes panel and in `pitch.js`.

The team has no measured user or performance data yet. The numerical slide uses product facts (one QR code per event and no native app installation), not market statistics or traction. The copy deliberately uses direct descriptions instead of slogans. External statistics were not added because the reviewed figures did not establish this specific event-photo collection problem.

## Controls

- Next / previous: arrow keys, Space, Page Up / Page Down.
- Jump: 1–5, Home / End.
- F: fullscreen. Notes close automatically before fullscreen.
- N: notes, script and optional three-minute rehearsal clock.
- O: visual overview.
- T: start / pause rehearsal clock.
- Swipe left / right on touchscreens.

Notes overlay the slides on the same display. Use them for rehearsal, not while projecting. The clock does not advance slides or switch to the app automatically. Use the app’s existing browser tab for the demo and return to slide 5 afterwards. Its presenter notes include the closing line.

## Demo preparation

1. Prepare an event, a signed-in host device and a second guest device. Test the full QR journey beforehand. Google sign-in is required. If using a phone, use the existing HTTPS setup and authorized OAuth origin.
2. Preload a small photo set and a pair of genuine similar shots. Check duplicate grouping and a search query against those actual photos.
3. Keep the guest’s Google account ready. During the demo, show the QR, guest join and one upload. Show the photo on the host device and save its original.
4. If time allows, reveal the similar group and run the verified search query. Reserve the last ten seconds for returning to the closing slide.

## Design and evidence

- Native system sans, white and `#f1f3f4` table surfaces, `#3390ec` accent from the current app, original RollCall logo and film asset.
- The join image is the project’s real screenshot from `docs/screenshots/03-join.png`, with its illustrative seeded event counts. Those counts are not traction claims. Refresh the screenshot before final export if the app changes.
- Slide 4 repeats one photo intentionally to illustrate grouping. It is not a before/after algorithm benchmark.
- Photos are existing licensed app assets. Original source links are in `web/public/pile/SOURCES.md`. Photos depict illustrative events, not the team or users.
- Scope and behavior follow `PRODUCT.md`, `README.md`, `web/components/album.tsx` and the duplicate/search implementation. No invented metrics, adoption figures or login-free claims.
- Each slide uses a fixed 1600 × 900 canvas, with responsive scaling. All slide copy remains HTML text. Print styles are included for later conversion, but no PDF or PPTX was generated in this pass.
