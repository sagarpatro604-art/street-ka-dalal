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
