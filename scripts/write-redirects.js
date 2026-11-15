// Runs after the build. Sign-in on phones needs the sign-in helper pages to be
// served from this site's own address, so the site passes them through to this
// site's own Firebase project. The project differs between the test site and
// the real one, so the rule is written here from the environment.
const fs = require("fs");
const path = require("path");

const project = process.env.REACT_APP_FIREBASE_PROJECT_ID;
if (!project) { console.error("write-redirects: REACT_APP_FIREBASE_PROJECT_ID is not set."); process.exit(1); }
const lines = [
  `/__/auth/*      https://${project}.firebaseapp.com/__/auth/:splat      200!`,
  `/__/firebase/*  https://${project}.firebaseapp.com/__/firebase/:splat  200!`,
  "",
];
fs.writeFileSync(path.join(__dirname, "..", "build", "_redirects"), lines.join("\n"));
console.log(`Sign-in pass-through written for ${project}.`);
