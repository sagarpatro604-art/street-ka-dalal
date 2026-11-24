// Sign-in (Google), member records, login log and the insights (posts) store.
// Firestore:  users/{uid}   one record per member (name, email, first/last seen, visits, device)
//             logins/{id}   one row per visit (who, when, device)       , only the admin can read
//             posts/{id}    blogs / sectoral views; members read published ones, only the admin writes
import { firebaseConfig, ADMIN_EMAILS } from './config.js';

const V = '10.12.2';
export const state = { ready: false, user: null, demo: !firebaseConfig.projectId, error: null };
const listeners = new Set();
export const onChange = (f) => listeners.add(f);
const emit = () => listeners.forEach((f) => f());
let fb = null;

export const isAdmin = () => !!state.user && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(String(state.user.email || '').toLowerCase());

// Instagram / Facebook / other in-app browsers: Google refuses to sign in there.
export function inAppBrowser() {
  const ua = navigator.userAgent || '';
  return /Instagram|FBAN|FBAV|FB_IAB|Line\/|Snapchat|LinkedInApp|Twitter/i.test(ua);
}

function device() {
  const ua = navigator.userAgent || '';
  const os = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iPhone/iPad' : /Windows/i.test(ua) ? 'Windows' : /Mac OS/i.test(ua) ? 'Mac' : /Linux/i.test(ua) ? 'Linux' : 'Other';
  const br = /Edg\//.test(ua) ? 'Edge' : /SamsungBrowser/.test(ua) ? 'Samsung' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${br}`;
}

/* ---------- demo mode (no Firebase yet): everything lives in this browser ---------- */
const LS = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };
const demo = {
  posts: () => LS('skd.demo.posts') || [],
  savePosts: (p) => LS('skd.demo.posts', p),
  users: () => LS('skd.demo.users') || [],
  logins: () => LS('skd.demo.logins') || [],
};

export async function init() {
  if (state.demo) {
    state.user = LS('skd.demo.user');
    state.ready = true;
    if (state.user) recordVisit();
    emit();
    return;
  }
  try {
    const base = `https://www.gstatic.com/firebasejs/${V}/`;
    const [{ initializeApp }, auth, fs] = await Promise.all([import(base + 'firebase-app.js'), import(base + 'firebase-auth.js'), import(base + 'firebase-firestore.js')]);
    const app = initializeApp(firebaseConfig);
    const a = auth.getAuth(app);
    let db;
    try { db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache() }); } catch { db = fs.getFirestore(app); }
    fb = { auth, fs, a, db };
    // Stay signed in on this device until the member taps Sign out (survives closing the browser / phone restart).
    await auth.setPersistence(a, auth.indexedDBLocalPersistence).catch(() => auth.setPersistence(a, auth.browserLocalPersistence)).catch(() => {});
    await auth.getRedirectResult(a).catch(() => {});
    await new Promise((resolve) => {
      auth.onAuthStateChanged(a, (u) => {
        state.user = u ? { uid: u.uid, name: u.displayName || u.email, email: u.email, photo: u.photoURL } : null;
        state.ready = true;
        if (u) recordVisit().catch((e) => console.warn('visit not recorded', e));
        emit();
        resolve();
      });
    });
  } catch (e) {
    state.error = e.message || String(e);
    state.ready = true;
    emit();
  }
}

export async function signIn() {
  if (state.demo) {
    state.user = { uid: 'demo-admin', name: 'Sagar (demo)', email: ADMIN_EMAILS[0], photo: null };
    LS('skd.demo.user', state.user);
    recordVisit();
    emit();
    return;
  }
  const p = new fb.auth.GoogleAuthProvider();
  p.setCustomParameters({ prompt: 'select_account' });
  try {
    await fb.auth.signInWithPopup(fb.a, p);
  } catch (e) {
    if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/cancelled-popup-request'].includes(e.code)) {
      await fb.auth.signInWithRedirect(fb.a, p);
    } else if (e.code !== 'auth/popup-closed-by-user') throw e;
  }
}

export async function signOut() {
  try { sessionStorage.removeItem('skd.visit'); } catch {}
  if (state.demo) { localStorage.removeItem('skd.demo.user'); state.user = null; emit(); return; }
  await fb.auth.signOut(fb.a);
}

// One member record per person, and one login row per visit (a tab session), not per page view.
async function recordVisit() {
  const u = state.user;
  if (!u) return;
  try { if (sessionStorage.getItem('skd.visit') === u.uid) return; sessionStorage.setItem('skd.visit', u.uid); } catch {}
  const now = new Date().toISOString();
  if (state.demo) {
    const users = demo.users();
    const me = users.find((x) => x.uid === u.uid);
    if (me) Object.assign(me, { lastSeen: now, visits: (me.visits || 0) + 1, device: device() });
    else users.push({ uid: u.uid, name: u.name, email: u.email, photo: u.photo, firstSeen: now, lastSeen: now, visits: 1, device: device() });
    LS('skd.demo.users', users);
    LS('skd.demo.logins', [{ uid: u.uid, name: u.name, email: u.email, at: now, device: device() }, ...demo.logins()].slice(0, 500));
    return;
  }
  const { fs, db } = fb;
  const ref = fs.doc(db, 'users', u.uid);
  const snap = await fs.getDoc(ref);
  const base = { name: u.name || '', email: u.email || '', photo: u.photo || '', lastSeen: fs.serverTimestamp(), device: device(), visits: fs.increment(1) };
  await fs.setDoc(ref, snap.exists() ? base : { ...base, firstSeen: fs.serverTimestamp() }, { merge: true });
  await fs.addDoc(fs.collection(db, 'logins'), { uid: u.uid, name: u.name || '', email: u.email || '', at: fs.serverTimestamp(), device: device() });
}

const ts = (v) => (v?.toDate ? v.toDate().toISOString() : v || null);

/* ---------- posts (insights) ---------- */
export async function listPosts({ all = false } = {}) {
  if (state.demo) {
    const p = demo.posts();
    return (all ? p : p.filter((x) => x.status === 'published')).sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
  }
  const { fs, db } = fb;
  const q = all ? fs.collection(db, 'posts') : fs.query(fs.collection(db, 'posts'), fs.where('status', '==', 'published'));
  const s = await fs.getDocs(q);
  const out = [];
  s.forEach((d) => { const x = d.data(); out.push({ ...x, id: d.id, publishedAt: ts(x.publishedAt), updatedAt: ts(x.updatedAt), createdAt: ts(x.createdAt) }); });
  return out.sort((a, b) => (b.publishedAt || b.updatedAt || '').localeCompare(a.publishedAt || a.updatedAt || ''));
}

export async function getPost(id) {
  if (state.demo) return demo.posts().find((p) => p.id === id) || null;
  const { fs, db } = fb;
  const d = await fs.getDoc(fs.doc(db, 'posts', id));
  if (!d.exists()) return null;
  const x = d.data();
  return { ...x, id: d.id, publishedAt: ts(x.publishedAt), updatedAt: ts(x.updatedAt), createdAt: ts(x.createdAt) };
}

export async function savePost(post) {
  const now = new Date().toISOString();
  const clean = { title: post.title, kind: post.kind, sector: post.sector || '', cover: post.cover || '', summary: post.summary || '', body: post.body || '', status: post.status, author: state.user?.name || '' };
  if (state.demo) {
    const all = demo.posts();
    const cur = all.find((p) => p.id === post.id);
    const wasPublished = cur?.status === 'published';
    const rec = { ...(cur || {}), ...clean, id: post.id || 'p' + Date.now().toString(36), updatedAt: now, createdAt: cur?.createdAt || now,
      publishedAt: clean.status === 'published' ? (wasPublished ? cur.publishedAt : now) : cur?.publishedAt || null };
    demo.savePosts(cur ? all.map((p) => (p.id === rec.id ? rec : p)) : [rec, ...all]);
    return rec.id;
  }
  const { fs, db } = fb;
  if (post.id) {
    const ref = fs.doc(db, 'posts', post.id);
    const cur = await fs.getDoc(ref);
    const firstPublish = clean.status === 'published' && cur.data()?.status !== 'published';
    await fs.setDoc(ref, { ...clean, updatedAt: fs.serverTimestamp(), ...(firstPublish ? { publishedAt: fs.serverTimestamp() } : {}) }, { merge: true });
    return post.id;
  }
  const r = await fs.addDoc(fs.collection(db, 'posts'), { ...clean, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp(), publishedAt: clean.status === 'published' ? fs.serverTimestamp() : null });
  return r.id;
}

export async function deletePost(id) {
  if (state.demo) { demo.savePosts(demo.posts().filter((p) => p.id !== id)); return; }
  await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'posts', id));
}

/* ---------- Dalal (the AI buddy) ---------- */
export async function idToken() {
  if (state.demo || !fb?.a.currentUser) return null;
  return fb.a.currentUser.getIdToken();
}

// What members ask Dalal: kept for the admin (question + a short copy of the answer).
export async function logAsk({ q, a, web, model }) {
  const u = state.user;
  if (!u) return;
  const rec = { uid: u.uid, name: u.name || '', email: u.email || '', q: String(q).slice(0, 900), a: String(a || '').slice(0, 1500), web: !!web, model: model || '' };
  if (state.demo) { LS('skd.demo.asks', [{ ...rec, at: new Date().toISOString() }, ...(LS('skd.demo.asks') || [])].slice(0, 300)); return; }
  await fb.fs.addDoc(fb.fs.collection(fb.db, 'asks'), { ...rec, at: fb.fs.serverTimestamp() });
}

export async function listAsks(n = 200) {
  if (state.demo) return (LS('skd.demo.asks') || []).slice(0, n);
  const { fs, db } = fb;
  const s = await fs.getDocs(fs.query(fs.collection(db, 'asks'), fs.orderBy('at', 'desc'), fs.limit(n)));
  const out = [];
  s.forEach((d) => { const x = d.data(); out.push({ ...x, id: d.id, at: ts(x.at) }); });
  return out;
}

// Housekeeping (admin only): login rows and Dalal questions older than `days` are removed so the free
// database never fills up. Members and posts are never touched. A few hundred per visit at most.
export async function purgeOld(days = 90) {
  if (state.demo || !isAdmin()) return 0;
  const { fs, db } = fb;
  const cutoff = fs.Timestamp.fromDate(new Date(Date.now() - days * 86400000));
  let removed = 0;
  for (const col of ['logins', 'asks']) {
    const s = await fs.getDocs(fs.query(fs.collection(db, col), fs.where('at', '<', cutoff), fs.limit(200)));
    if (s.empty) continue;
    const b = fs.writeBatch(db);
    s.forEach((d) => { b.delete(d.ref); removed++; });
    await b.commit();
  }
  return removed;
}

/* ---------- admin: members and login log ---------- */
export async function listMembers() {
  if (state.demo) return demo.users();
  const s = await fb.fs.getDocs(fb.fs.collection(fb.db, 'users'));
  const out = [];
  s.forEach((d) => { const x = d.data(); out.push({ ...x, uid: d.id, firstSeen: ts(x.firstSeen), lastSeen: ts(x.lastSeen) }); });
  return out;
}

export async function listLogins(n = 300) {
  if (state.demo) return demo.logins().slice(0, n);
  const { fs, db } = fb;
  const s = await fs.getDocs(fs.query(fs.collection(db, 'logins'), fs.orderBy('at', 'desc'), fs.limit(n)));
  const out = [];
  s.forEach((d) => { const x = d.data(); out.push({ ...x, id: d.id, at: ts(x.at) }); });
  return out;
}

// Admin > Analytics: rows of 'logins' or 'asks' newer than afterIso, oldest first (the tab keeps its own copy in the
// admin's browser and asks only for what is new, so an open costs a handful of reads, not thousands)
export async function listSince(col, afterIso, n = 5000) {
  if (!['logins', 'asks'].includes(col)) return [];
  if (state.demo) return (col === 'logins' ? demo.logins() : LS('skd.demo.asks') || []).filter((x) => !afterIso || x.at > afterIso).reverse();
  const { fs, db } = fb;
  const after = fs.Timestamp.fromDate(afterIso ? new Date(afterIso) : new Date(Date.now() - 400 * 86400000));
  const s = await fs.getDocs(fs.query(fs.collection(db, col), fs.where('at', '>', after), fs.orderBy('at', 'asc'), fs.limit(n)));
  const out = [];
  s.forEach((d) => { const x = d.data(); out.push({ uid: x.uid, at: ts(x.at), device: x.device || '', web: !!x.web }); });
  return out;
}

/* ---------- my watchlist (stock-watch screen): saved on the member's own users/{uid} record ---------- */
// The users rule lets a member update only their own record and keeps its email, so a merge with email is enough.
const WL_MAX = 200;
export async function getWatchlist() {
  const u = state.user;
  if (!u) return [];
  if (state.demo) return LS('skd.demo.wl') || [];
  try { const s = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', u.uid)); const w = s.exists() ? s.data().watchlist : null; return Array.isArray(w) ? w.filter((x) => typeof x === 'string') : []; }
  catch { return LS('skd.wl.' + u.uid) || []; }
}
export async function saveWatchlist(list) {
  const u = state.user;
  if (!u) return;
  const clean = [...new Set((list || []).map((x) => String(x).toUpperCase()).filter(Boolean))].slice(0, WL_MAX);
  LS('skd.wl.' + u.uid, clean);
  if (state.demo) { LS('skd.demo.wl', clean); return; }
  await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', u.uid), { email: u.email || '', watchlist: clean, watchlistAt: fb.fs.serverTimestamp() }, { merge: true });
}

/* ---------- my portfolio (Portfolio X-ray tab): lots of { s: symbol, q: quantity, p: buy price, d: buy date } ----------
   Saved on users/{uid}.portfolio so it follows the member to every device. */
const PF_MAX = 300;
const cleanLots = (a) => (a || []).filter((x) => x && x.s && +x.q > 0).slice(0, PF_MAX)
  .map((x) => ({ s: String(x.s).toUpperCase().slice(0, 20), q: +(+x.q).toFixed(4), p: +x.p > 0 ? +(+x.p).toFixed(4) : null, d: /^\d{4}-\d{2}-\d{2}$/.test(x.d || '') ? x.d : null }));
export async function getPortfolio() {
  const u = state.user;
  if (!u) return [];
  if (state.demo) return cleanLots(LS('skd.demo.pf'));
  try { const s = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', u.uid)); return cleanLots(s.exists() ? s.data().portfolio : []); }
  catch { return cleanLots(LS('skd.pf.' + u.uid)); }
}
export async function savePortfolio(lots) {
  const u = state.user;
  if (!u) return;
  const clean = cleanLots(lots);
  LS('skd.pf.' + u.uid, clean);
  if (state.demo) { LS('skd.demo.pf', clean); return; }
  await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', u.uid), { email: u.email || '', portfolio: clean, portfolioAt: fb.fs.serverTimestamp() }, { merge: true });
}

/* ---------- named watchlists (Sagar 2026-11-16: members can make their own lists) ----------
   users/{uid}.watchlists = [{ name, syms }]; the first list is also written to `watchlist` so older code keeps working.
   A member who only ever had the single list sees it as "My watchlist". */
const LISTS_MAX = 20;
const cleanSyms = (a) => [...new Set((a || []).map((x) => String(x).toUpperCase()).filter(Boolean))].slice(0, WL_MAX);
export async function getWatchlists() {
  const u = state.user;
  if (!u) return [];
  let d = null;
  if (state.demo) d = { watchlists: LS('skd.demo.wls'), watchlist: LS('skd.demo.wl') };
  else {
    try { const s = await fb.fs.getDoc(fb.fs.doc(fb.db, 'users', u.uid)); d = s.exists() ? s.data() : {}; }
    catch { d = { watchlists: LS('skd.wls.' + u.uid) }; }
  }
  const ls = Array.isArray(d?.watchlists) ? d.watchlists.filter((x) => x && typeof x.name === 'string').map((x) => ({ name: x.name.slice(0, 40), syms: cleanSyms(x.syms) })) : [];
  if (ls.length) return ls;
  return [{ name: 'My watchlist', syms: cleanSyms(Array.isArray(d?.watchlist) ? d.watchlist : []) }];
}
export async function saveWatchlists(lists) {
  const u = state.user;
  if (!u) return;
  const clean = (lists || []).filter((x) => x && x.name).slice(0, LISTS_MAX).map((x) => ({ name: String(x.name).trim().slice(0, 40), syms: cleanSyms(x.syms) }));
  LS('skd.wls.' + u.uid, clean);
  if (state.demo) { LS('skd.demo.wls', clean); LS('skd.demo.wl', clean[0]?.syms || []); return; }
  await fb.fs.setDoc(fb.fs.doc(fb.db, 'users', u.uid), { email: u.email || '', watchlists: clean, watchlist: clean[0]?.syms || [], watchlistAt: fb.fs.serverTimestamp() }, { merge: true });
}
