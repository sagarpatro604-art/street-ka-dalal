# Street ka Dalal

Community site: screeners, market intelligence, mutual-fund activity, announcements and insights.
Plain HTML/CSS/JS on GitHub Pages; Firebase for Google sign-in, members, login log and posts.

| Piece | Where |
|---|---|
| Daily data (`data/*.json`) | Written and pushed by `sector-scope/skd_publish.py` (task "SectorScope SKD Publish", weekdays 17:15 + 20:45). Read-only on SectorScope. |
| Sign-in | Firebase Auth, Google provider. Anyone with a Google account can join. |
| Members / login log / posts | Firestore `users`, `logins`, `posts`; rules in `firestore.rules` (admin = the email in `ADMIN_EMAILS`, `js/config.js`, and in the rules). |
| Admin terminal | `#/admin` — publisher, members, login log, data status. |

Not published on purpose: pattern entry/stop/target prices and filing buy/sell signals (SEBI), My Book, paper books.
Local preview without Firebase: leave `projectId` empty in `js/config.js` (demo sign-in, posts kept in the browser).

## Dalal (AI buddy)
- Widget `js/dalal.js` (bottom-right, members only); server `functions/api/dalal.js` (Cloudflare Pages Function).
- Uses Google Gemini (free tier) with Google Search grounding; answers from the site's `data/*.json` first. Every file listed in `data/meta.json` → `files` is read automatically, so new sections reach Dalal with no code change.
- 10 questions per member per day, counted in Cloudflare D1 `dalal-db` (binding `DALAL_DB` in `wrangler.toml`; free 100k writes/day). D1 also keeps a 10-minute copy of published posts and the model list. KV `DALAL_KV` is only a fallback. Admin is unlimited.
- News: `data/newsfeed/latest.json` (publisher, 7 days) + a live Google News search per question; optional `BRAVE_API_KEY` secret as backup. Key = encrypted secret `GEMINI_API_KEY` in Cloudflare (never in the repo).
- Questions are logged to Firestore `asks` (admin tab "Dalal questions"); logins and asks older than 90 days are cleaned when the admin opens the terminal.
- Health check: Admin → Data status → "Check Dalal". Social links in `js/config.js` → `SOCIAL`.
