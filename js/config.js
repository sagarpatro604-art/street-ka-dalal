// Firebase web config (Firebase console → Project settings → Your apps → Web app). Safe to publish.
// While projectId is empty the site runs in local demo mode: a pretend sign-in, posts kept in this browser.
export const firebaseConfig = {
  apiKey: 'AIzaSyBGckFlwyHPxrgfAJlAiHA1NtMi4UQjXHY',
  authDomain: 'street-ka-dalal.firebaseapp.com',
  projectId: 'street-ka-dalal',
  storageBucket: 'street-ka-dalal.firebasestorage.app',
  messagingSenderId: '649908482337',
  appId: '1:649908482337:web:8d027a288487ff6c07ce60',
};

// Only these Google accounts see the admin terminal (publisher, members, login log). The Firestore
// rules enforce the same list, so editing it here alone does not grant access.
export const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];

// Community links Dalal shares when he greets members. Leave a link empty to hide that button.
export const SOCIAL = {
  whatsapp: 'https://chat.whatsapp.com/DUdUxpofHqE9auMNtDyZYr',
  instagram: 'https://www.instagram.com/sagarpatro604/',
  linkedin: 'https://www.linkedin.com/in/sagarpps',
  telegram: '',
};

// Where Dalal's server lives (a Cloudflare Pages Function). The github.io copy of the site calls it there.
export const DALAL_API = 'https://street-ka-dalal.pages.dev/api/dalal';

export const SITE = {
  name: 'Street ka Dalal',
  tagline: 'Screeners, sector views and market intelligence for our community.',
};
