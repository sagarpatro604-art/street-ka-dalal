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

## Admin > Analytics (usage dashboard, 2026-11-24)
- Sagar: "a analytical tab in admin where week by week, m by m, we can check everything to track the performance of our terminal". First tab of `#/admin`, code `js/analytics.js`.
- Day by day / week by week / month by month: new members, total members, active members (returning vs new), visitors not signed in, hours on the site and minutes per active member, visits and average visit, Dalal questions, persona tests, meet sign-ups. Breakdowns for today / 7 / 30 / 90 days / 1 year: weekday x hour heatmap (IST), hours of the day, visit lengths, sections used most, Discover / Results Plus sub-pages, stocks opened most, how many days members come, member-to-premium funnel, devices, weekly comeback groups, top members by time, members not seen for 30+ days, the full table + CSV.
- Time counter: `js/track.js` (main site, Reels, quiz, meet page) counts 5-second steps only while the page is on screen and used in the last 2 min (5 on Reels), sends to `functions/api/track.js` every 2 min and on leaving; only on street-ka-dalal.pages.dev; the admin's own use is never stored. D1 tables `ux_day`, `ux_hour`, `ux_sess`, `ux_who`, `ux_cid`, `ux_ip` (see the function's header). No cookies, no outside analytics service.
- Members, logins and Dalal questions come from Firestore; logins / questions are copied into the admin's browser (localStorage `skd.an.*`) so only new rows are read and the history outlives the 90-day clean-up there.
- Test: `node tests/test_track.mjs` (20 checks on a real SQLite). Watch: `~/.claude/tools/dalal_watch.py` (hourly) reads `/api/track?health=1` and sends one private note when nothing has been counted for 24 h.

## Plagiarism checker + Humanizer: REMOVED 2026-11-24
- Sagar: it was an experiment; the Claude key is for Dalal only. Page, functions and Admin tab removed (code in git history before this commit). D1 tables humanize_log / plag_log / humanize_spend / humanize_ip / hz_user / hz_people left as they were (not dropped). `lib/hz_common.js` stays because `functions/api/premium.js` uses its sign-in helpers.

## Investor persona test (`/quiz`)
- Page `quiz.html` (public, no sign-in needed; Google sign-in optional): a persona survey, not a knowledge test. Round 1 About you (years in the market, self rating 1 to 10, main style, daily time, goal), Round 2 Your toolkit (tap the market words you know, incl. one made-up honesty-check word "Zeta crossover"; tools; where they learn; 4 swipe habits), Round 3 Market moments (5 situations; each choice moves a virtual Rs 1,00,000, outcomes made up for the game). Every answer moves straight to the next question; the virtual profit or loss is shown only at the end, then the persona (Beginner = Rising Rookie, Intermediate = Street Smart Investor, Advanced = Dalal Street Pro; persona score out of 100, cut-offs 35 / 65), the trading style, a 5-part profile, a PNG certificate drawn in the browser, and Instagram / WhatsApp / Telegram links. `FEATURED_REEL` at the top of the script = the Instagram reel code shown on the results page (empty = profile card only).
- Server `functions/api/quiz.js`: re-scores the answers with the same tables (never trusts the browser's level) and saves each game in D1 table `persona_results` (15 games a day per network); admin GET feeds Admin > Persona test (levels, styles, years, word familiarity least-known first, tools, learning sources, goals, habits, market-moment choices, self rating vs level, CSV). Changing questions or scores: change BOTH files, bump `VER` in quiz.html and `VERSIONS` in quiz.js.
