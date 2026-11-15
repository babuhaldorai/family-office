const expectedProject = "manage-my-tea";

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

if (process.env.REACT_APP_FIREBASE_PROJECT_ID !== expectedProject) {
  console.error("BLOCKED: This build is not connected to staging Firebase.");
  process.exit(1);
}

// The sign-in domain may be the Firebase one or this site's own address (the
// site passes /__/auth/ through to Firebase, which is what phones need).
const authDomain = process.env.REACT_APP_FIREBASE_AUTH_DOMAIN;
if (/^https?:|\//.test(authDomain)) {
  console.error("BLOCKED: REACT_APP_FIREBASE_AUTH_DOMAIN must be a bare host name, like my-site.netlify.app.");
  process.exit(1);
}

console.log("Staging Firebase configuration verified.");