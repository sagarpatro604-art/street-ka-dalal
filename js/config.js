// Firebase web config (Firebase console → Project settings → Your apps → Web app). Safe to publish.
// While projectId is empty the site runs in local demo mode: a pretend sign-in, posts kept in this browser.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Only these Google accounts see the admin terminal (publisher, members, login log). The Firestore
// rules enforce the same list, so editing it here alone does not grant access.
export const ADMIN_EMAILS = ['sagarpatro604@gmail.com'];

export const SITE = {
  name: 'Street ka Dalal',
  tagline: 'Screeners, sector views and market intelligence for our community.',
};
