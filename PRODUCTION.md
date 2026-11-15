# Going live: moving to production

Staging holds the records you want to keep. This moves them into production,
after first saving what production has today.

Nothing here is automatic. Each step says who does it and what to check.

## Before anything: two backups (you)

1. **Production as it is today.** Open the production site (it still runs the old app) →
   User Management → Backup → download the file. Keep it somewhere safe. This is your way back.
2. **Staging.** Open the staging site → Settings → Backup and restore → **Download a copy to this device**.
   This file is what goes into production. Open Settings → Totals check first and make sure every line says OK.

After step 2, **stop entering new records on staging**. Anything entered there later will not be in the file.

## Put the new app on production (me, when you say go)

The code moves from the `staging` branch to `main`. The production Netlify site rebuilds from `main`.
Until the steps below are done, production will show "Almost there" with a button to the old app; nothing is lost.

## Set up production (you, about 20 minutes)

Firebase console, project `family-office-b8b36`:

1. Firestore Database → Rules → paste [`firestore.rules`](firestore.rules) → Publish.
2. Storage → Rules → paste [`storage.rules`](storage.rules) → Publish. (Create the bucket first if Storage shows "Get started".)
3. Project settings → Service accounts → Generate new private key. Note `client_email` and `private_key`.

Netlify, the **production** site → Environment variables:

| Name | Value |
|---|---|
| `EXPECTED_FIREBASE_PROJECT` | `family-office-b8b36` |
| `REACT_APP_FIREBASE_*` (6 of them) | already there for the old app; leave them. Change `REACT_APP_FIREBASE_AUTH_DOMAIN` to the production site's own address for phone sign-in |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | from the production key file (not the staging one) |
| `BREVO_API_KEY`, `REMINDER_FROM_EMAIL` | same as staging |
| `GITHUB_BACKUP_TOKEN`, `GITHUB_BACKUP_REPO` | a **separate** repository for production backups, for example `family-office-backups-live`, so test and real backups never mix |
| `ANTHROPIC_API_KEY` | only if you want AI summaries on production |

On the **staging** site add `EXPECTED_FIREBASE_PROJECT` = `manage-my-tea`.

Google Cloud console, project `family-office-b8b36` → Credentials → Web client → Authorized redirect URIs:
add `https://<production site address>/__/auth/handler`.

Then trigger a deploy of the production site.

## Bring the records in (you)

1. Open production and sign in. You should see the new Home with "Getting started".
2. Settings → Backup and restore → **restore from a file on this device** → choose the staging file.
3. Read the preview. Every part should say "Put back"; nothing should say "Moved to bin". Net kg and money in/out should
   match what staging's Reports show.
4. Press Restore.
5. Settings → Totals check: every line OK.
6. Compare three figures with staging: Reports → Summary profit for this year, Tea → Tea account for last month,
   and one tenant's rent tiles.
7. Settings → Backup and restore → Back up now. Both lines should say Saved.

What does **not** come across, and has to be set again on production:
- Who can use the app (each site has its own list). You are already Owner there from the old app.
- Reminder email addresses are kept; when each person was last emailed is not.
- AI summaries on/off and who may use them.
- Photos of slips. The harvests keep their numbers, but "View" will not find the photo.

## After that

- Enter records **only on production**.
- Staging becomes the place where changes are tried first. To make it match production again:
  production → Download a copy; staging → restore from that file.
- If something is badly wrong in the first days, the old app is still under Settings → "Open the old app",
  and the old records in production were never changed.
