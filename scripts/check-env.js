// Runs before every Netlify build. Stops the build if the site is not wired to
// the Firebase project it is supposed to use, so the test site can never be
// pointed at the real records by accident (or the other way round).
//
// Each Netlify site sets EXPECTED_FIREBASE_PROJECT to its own project id.
// A site that has not set it is treated as the staging site.
const expected = process.env.EXPECTED_FIREBASE_PROJECT || "manage-my-tea";

const required = [
  "REACT_APP_FIREBASE_API_KEY",
  "REACT_APP_FIREBASE_AUTH_DOMAIN",
  "REACT_APP_FIREBASE_PROJECT_ID",
  "REACT_APP_FIREBASE_STORAGE_BUCKET",
  "REACT_APP_FIREBASE_MESSAGING_SENDER_ID",
  "REACT_APP_FIREBASE_APP_ID",
];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing environment variable: ${key}`);
    process.exit(1);
  }
}

if (process.env.REACT_APP_FIREBASE_PROJECT_ID !== expected) {
  console.error(`BLOCKED: this site is set up for the Firebase project "${expected}" but REACT_APP_FIREBASE_PROJECT_ID is "${process.env.REACT_APP_FIREBASE_PROJECT_ID}".`);
  console.error("Set EXPECTED_FIREBASE_PROJECT on this Netlify site to the project it should use.");
  process.exit(1);
}

// The sign-in domain may be the Firebase one or this site's own address (the
// site passes /__/auth/ through to Firebase, which is what phones need).
if (/^https?:|\//.test(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN)) {
  console.error("BLOCKED: REACT_APP_FIREBASE_AUTH_DOMAIN must be a bare host name, like my-site.netlify.app.");
  process.exit(1);
}

console.log(`Firebase configuration verified for project "${expected}".`);
