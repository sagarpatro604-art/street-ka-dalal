# Street ka Dalal

Community site: screeners, market intelligence, mutual-fund activity, announcements and insights.
Plain HTML/CSS/JS on GitHub Pages; Firebase for Google sign-in, members, login log and posts.

| Piece | Where |
|---|---|
| Daily data (`data/*.json`) | Written and pushed by `sector-scope/skd_publish.py` (task "SectorScope SKD Publish", weekdays 17:15 + 20:45). Read-only on SectorScope. |
| Sign-in | Firebase Auth, Google provider. Anyone with a Google account can join. |
| Members / login log / posts | Firestore `users`, `logins`, `posts`; rules in `firestore.rules` (admin = the email in `ADMIN_EMAILS`, `js/config.js`, and in the rules). |
| Admin terminal | `#/admin` — publisher, members, login log, data status. |
| Library (`#/library`) | Meet-up decks, our research PDFs, recommended books. Shelf list = `library/catalog.json`, files in `library/<shelf>/`; reader `js/library.js` (pdf.js from cdnjs, zoom + full screen, progress in the browser only). Only rows with `download: true` (meet-up decks) get a Download button. Research is `protect: true`: stored scrambled as `.bin` (XOR key in `js/library.js`), readable only in the reader. Locked rows show a lock card and have no file on the site; to open one, add the file (scramble research the same way), set `locked` false, add `file` + `pages`. Paid books are listed with a buy link, never uploaded. |

Not published on purpose: pattern entry/stop/target prices and filing buy/sell signals (SEBI), My Book, paper books.
Local preview without Firebase: leave `projectId` empty in `js/config.js` (demo sign-in, posts kept in the browser).

## Dalal (AI buddy)
- Widget `js/dalal.js` (bottom-right, members only); server `functions/api/dalal.js` (Cloudflare Pages Function).
- Uses Google Gemini (free tier) with Google Search grounding; answers from the site's `data/*.json` first. Every file listed in `data/meta.json` → `files` is read automatically, so new sections reach Dalal with no code change.
- 10 questions per member per day, counted in Cloudflare D1 `dalal-db` (binding `DALAL_DB` in `wrangler.toml`; free 100k writes/day). D1 also keeps a 10-minute copy of published posts and the model list. KV `DALAL_KV` is only a fallback. Admin is unlimited.
- News: `data/newsfeed/latest.json` (publisher, 7 days) + a live Google News search per question; optional `BRAVE_API_KEY` secret as backup. Key = encrypted secret `GEMINI_API_KEY` in Cloudflare (never in the repo).
- Questions are logged to Firestore `asks` (admin tab "Dalal questions"); logins and asks older than 90 days are cleaned when the admin opens the terminal.
- Health check: Admin → Data status → "Check Dalal". Social links in `js/config.js` → `SOCIAL`.

## Investor persona test (`/quiz`)
- Page `quiz.html` (public, no sign-in needed; Google sign-in optional): 16 game-style questions in 3 rounds (swipe Bull / Bear, read a chart, tap the breakout candle, slider guess, order, match, spot the red flags), each linked to the site tab it comes from. Ends with a persona (Beginner = Rising Rookie, Intermediate = Street Smart Investor, Advanced = Dalal Street Pro; cut-offs 40% / 72%), a skill profile, a PNG certificate drawn in the browser, and Instagram / WhatsApp / Telegram links. `FEATURED_REEL` at the top of the script = the Instagram reel code shown on the results page (empty = profile card only).
- Server `functions/api/quiz.js`: saves each finished game in D1 table `quiz_results` (level worked out on the server, 15 games a day per network); admin GET feeds Admin > Persona test (level counts, topic averages, says-vs-scores, CSV). Changing the questions: bump `VER` in quiz.html and add the new maximum to `VERSIONS` in quiz.js.
