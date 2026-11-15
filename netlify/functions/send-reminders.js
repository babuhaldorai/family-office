// Runs once a day (see the schedule in netlify.toml) and emails whoever is
// listed under Settings → Reminders about rent that has not been logged.
// It stops by itself once the rent is recorded.
//
// Netlify environment variables:
//   FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY  a Firebase service account (or the whole key file in FIREBASE_SERVICE_ACCOUNT)
//   BREVO_API_KEY, REMINDER_FROM_EMAIL           the email service and a sender address verified in it
//   REMINDER_FROM_NAME                           optional
const { runReminders } = require('../lib/run-reminders');

exports.handler = async () => {
  try {
    const result = await runReminders();
    console.log('reminders:', JSON.stringify(result));
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (e) {
    console.error('reminders failed:', e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
