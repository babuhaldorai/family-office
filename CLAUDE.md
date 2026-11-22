# Family Office — notes for whoever works on this next

Book-keeping for a family in India: tea fields (hand-picked leaf sold to agents),
rental properties, and their own homes. All money in Indian rupees, all dates in
India time. The owner is not a developer; all changes are made by an AI tool.

## Who uses it, and how
- The owner, Ragu and Mom. These three names are the "who handled the money" choices.
- Mostly on iPhones, added to the home screen. Users are in India and the US.
- Explain things in plain language. Say what was tested and what was not.
- Keep running costs free or near free. Ask before adding anything paid.

## Where things are
- Repository branches: work on `staging`. `main` feeds the production site. Do not push to `main`
  unless the owner says to go live.
- Two Netlify sites built from the same code: staging (`*-staging.netlify.app`, Firebase project
  `manage-my-tea`) and production (Firebase project `family-office-b8b36`). `scripts/check-env.js`
  refuses to build if a site points at the wrong project (`EXPECTED_FIREBASE_PROJECT`).
- The new app is in `src/v2/`. The old app (`src/pages/`, old collections such as `tea_harvest`)
  is still there, reachable from Settings → "Open the old app", and is never written to.
- New collections are named `fo_*`. Rules: `firestore.rules`, `storage.rules`.
- Server jobs: `netlify/functions/` (backup to GitHub, nightly backup, reminder emails,
  test email, AI summary) with shared code in `netlify/lib/`.

## How the app is built
- `src/v2/core/books.js` is the single calculation every screen reads. Records are stored once;
  every total is derived there, and its self-checks are shown in Settings → Totals check.
  Keep it that way: never store a total.
- `src/v2/core/` is plain logic with tests (`*.test.js`). `src/v2/data/actions.js` turns a form
  into the changes to save, as one batch. Screens are in `src/v2/screens/`.
- Deleting moves a record to the recycle bin; every change is kept in `fo_history`.
- Roles: admin (Owner), manager, entry (Data entry — no money), viewer. Enforced in the rules.

## Testing before pushing
```bash
CI=true npx react-scripts test --watchAll=false src/v2
```
```bash
REACT_APP_DEMO=1 CI=true npx react-scripts build
```
Then serve `build/` on port 4173 and run `scripts/smoke-sample.js` and `scripts/e2e-sample*.js`
with Playwright. Sample mode uses made-up data in memory and never touches Firebase.
`scripts/rules-emulator-test.js` checks the database rules on the Firestore emulator.
Sample tests: `smoke-sample.js`, `e2e-sample.js` to `e2e-sample-5.js`.

## Decisions the owner made (do not undo without asking)
- Harvest form is laid out like the paper slip: one block per worker with bags, then that worker's
  deduction split into water, bags and other (other needs a comment). Wages are on net kg.
- The agent rate is usually unknown at harvest time; it is entered when the agent pays.
- Differences between what was due and what was paid need a reason, and can carry a comment.
- Each field can have a usual agent with dates; changing it warns about past harvests that disagree.
- Manure: one purchase can hold several types sharing one transport charge; mixes record what went in
  and how many bags came out; one day's application can cover several fields at a rate per bag.
- Reading numbers from slip photos was removed (it would cost money). Photos are only stored.
- Harvests and payments can carry several photos: `photos: [{ path, at, by }]` (`at` is the upload time;
  shown in India time). Older records with one `slipPath`/`photoPath` are read as the first photo
  (`core/photos.js`) and rewritten as `photos` on the next save. Lists show "📷 N · last <date>".
  Payment photos are stored under
  `payments/` in the bucket. Only Owner and manager can add it; viewers can see it; Data entry cannot.
  storage.rules is published by hand in the Firebase console; until the `payments/` rule is published,
  the app keeps payment photos under `slips/<month>/payments-…` instead (already allowed).
- Agent payment: the delivery list has a period filter (All, week, last week, month, last month,
  dates) and Tick all / Untick all. Only ticked deliveries inside the shown dates are paid for.
- Rent months on a house run from the move-in date to today, plus any month with rent recorded
  (so no payment is hidden when the move-in date is missing, after today, or later than payments).
  Such tenancies are flagged "Check the move-in date" on Home.
- Harvest form has "To do from this harvest": each to-do is a `fo_notes` todo for a chosen person
  (default: the person picked on Home, else the first handler), naming field, day and optional worker,
  linked to `/harvest/<id>`; open ones show on that harvest with Done.
- AI summaries: off by default; the Owner switches them on and picks who may use them; at most 2 a day.
- Backups: every night, only if something changed, to the storage bucket and a private GitHub repo.
- Reminder emails: per address, each person gets one combined email (rent not logged, their action
  items, optionally everything else that needs attention).

## Where things stood (20 Nov 2026)
- Staging holds the records the owner wants to keep. Next step is going live: see `PRODUCTION.md`.
  The owner is taking two backups first (production old app, and staging) and will say "go".
- Working on staging: GitHub backup, reminder emails.
- Not confirmed yet: rentals fix on the real staging data (all 3 houses should now list their months;
  any with a wrong move-in date show "Check the move-in date"), payment photo upload on the real staging site (owner reported it not saving on 22 Nov; the
  likely cause is the unpublished storage rule, now worked around; the exact error was not seen),
  the iPhone status-bar fix (needs the app re-added to the home screen),
  phone sign-in through the site's own address, AI summaries with a real key.
