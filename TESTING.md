# Testing the new screens on staging

Everything here is for the **staging** site and the **staging** database
(`manage-my-tea`). Production is not touched until you say so.

## One-time setup (about 10 minutes)

The new screens keep their data in new collections (names starting `fo_`).
The database refuses them until the new rules are published.

1. **Publish the database rules**
   Firebase console → project `manage-my-tea` → Firestore Database → Rules.
   Replace the text with the contents of [`firestore.rules`](firestore.rules) and press Publish.
   (Or from a computer with the Firebase tools: `firebase deploy --only firestore:rules --project manage-my-tea`.)
2. **Publish the storage rules** (for backups to the bucket)
   Firebase console → Storage → Rules. Replace with [`storage.rules`](storage.rules) and Publish.
   Firebase will ask to let Storage rules read Firestore; say yes (the rules look up your role).
3. **GitHub backup** (optional, can be done later)
   - Create a private repository, for example `family-office-backups`.
   - GitHub → Settings → Developer settings → Fine-grained tokens → new token limited to that
     repository with **Contents: Read and write**.
   - Netlify (staging site) → Site configuration → Environment variables:
     `GITHUB_BACKUP_TOKEN` = the token, `GITHUB_BACKUP_REPO` = `yourname/family-office-backups`.
   - Redeploy the site.

Until step 1 is done the app shows "Almost there" and offers the old app.

## First run

1. Open the staging site and sign in. You land on the new **Home**.
2. Settings → **Bring in data from the old app** → "Read the old app and compare".
   You get a table of old totals against new totals. Every line should say **Same**.
   If one says **Differs**, stop and tell me which.
3. Press **Copy into the new app**. The old records are not changed.
4. Settings → **Totals check**. Every line should say OK.
5. Settings → **Backup and restore** → **Back up now**. Both lines should say Saved
   (GitHub says Failed until step 3 above is done; the bucket alone is enough to start).

The old app stays available under Settings → "Open the old app" so you can compare any figure.

## What to try (tick as you go)

| # | Try this | You should see |
|---|---|---|
| 1 | Home → **+ Today's harvest**: three bags of 50, deduction 5 + 5 | 150 weighed, 140 kg net, wages shared by weight picked |
| 2 | Save it without a rate | In Tea → Harvest it shows "Rate not known" and no amount |
| 3 | Home → the agent's "has not paid yet" line → enter rate and amount | Amount due fills in on those harvests everywhere; rate appears in Tea → Tea account → Rate history |
| 4 | Record an agent payment that is ₹50 short | The app refuses to save until you pick a reason; "Settle next time" keeps ₹50 owed, any other reason closes it |
| 5 | Record a payment → Worker → Give an advance; then Pay wages | The advance can be taken back from wages; "To pay" drops by that amount |
| 6 | Pay a worker ₹100 extra, reason "Gift or help", with a comment | It shows in Tea account → Differences with your comment; nothing is carried forward |
| 7 | Tea → Fields → **+ New purchase** (manure with transport), then **+ Field work → Manuring** using that stock | Bags left goes down; the field is charged the manure cost including transport |
| 8 | Field → Lease → lease it as **Deposit, returned** | Not counted as income; Home reminds you before it ends; harvest on that field is refused |
| 9 | Field → Lease → "Try an offer" | Rent and deposit compared against keeping the field |
| 10 | Rentals → a property → add tenant, rent, an increase; record rent | Month tiles turn Paid; Home lists unpaid months |
| 11 | Edit any harvest or payment, then Settings → **History of changes** | The old and new values, with **Undo** |
| 12 | Delete a payment, then Settings → **Recycle bin** → Bring back | It returns, and totals return with it |
| 13 | Reports → Summary | "Why profit and cash differ" ends with "These lines add up exactly" |
| 14 | Reports → Every entry → Download for Excel | A file that opens in Excel |
| 15 | Phone: turn on aeroplane mode, add a harvest, turn it off | A banner says entries are waiting; they are sent when the signal returns |
| 16 | Settings → Backup → Download a copy; change something; Restore from that file | A preview of what would change, with totals before and after, before anything happens |
| 17 | Settings → Who can use the app → give someone "Data entry" | They can log harvests but see no money and no Reports |

## What is not built yet

- **Email reminders.** Reminders appear on Home. Sending email needs a mail account and a scheduled server job.
- **Reading a photo of the agent's slip.** Not built.
- **Restore directly from GitHub.** Backups go to GitHub; to restore from one, download the file from the
  repository and use "restore from a file". Restore from the bucket works in the app.
- **Automatic WhatsApp or SMS.** Only the "Remind on WhatsApp" button on a rental (opens WhatsApp with the message written).

## For whoever maintains the code

```bash
npm ci
```

```bash
CI=true npx react-scripts test --watchAll=false src/v2
```

Runs the calculation tests (harvest maths, balances, profit-and-cash reconciliation, old-data import, backup and restore).

```bash
REACT_APP_DEMO=1 npx react-scripts start
```

Runs the new screens on made-up data held in memory. Nothing is saved and Firebase is not loaded.
Add `?role=entry`, `?role=viewer` or `?empty=1` to the address to see those cases.
`scripts/e2e-sample.js` and `scripts/smoke-sample.js` click through this mode with Playwright (serve a
`REACT_APP_DEMO=1` build on port 4173 first).

Layout of the new code, all under `src/v2/`:

- `core/books.js` — the one calculation every screen reads from. `core/insights.js` — advice and forecasts.
  `core/migrate.js` — old data to new. `core/backup.js` — backup, restore plan, CSV.
- `data/` — the cloud store, the in-memory store, and `actions.js` (what each form saves, as one batch).
- `screens/` — the eight screens. `ui/` — shared pieces.
