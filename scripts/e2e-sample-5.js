// Ticking agent deliveries by date (Tick all, Untick all, week, month, dates), and
// optional photo on payments: the card is there for agent and worker payments,
// sample mode refuses to store a photo, and a payment still saves without one.
// Runs against a REACT_APP_DEMO=1 build served on 4173.
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h); await page.waitForTimeout(300); };
  const text = () => page.locator('.v2-main').innerText();
  await page.goto('http://localhost:4173/#/'); await page.waitForSelector('.v2-h');

  await nav('/pay?type=agent');
  let t = await text();
  assert(/PHOTOS, KEPT FOR REFERENCE \(OPTIONAL\)/i.test(t) && /agent's bill/.test(t), 'agent payment offers an optional photo');
  await page.getByRole('button', { name: 'Take or choose a photo' }).click(); await page.waitForTimeout(200);
  assert(/Photos cannot be stored on sample data/.test(await page.locator('body').innerText()), 'sample mode says photos are not stored');

  // ticking deliveries by date before entering the rate
  await nav('/pay?type=agent');
  const ticked = async () => { const m = (await text()).match(/(\d+) of (\d+) ticked/); return m ? [Number(m[1]), Number(m[2])] : null; };
  let [on, shown] = await ticked();
  assert(shown > 1 && on === shown, `all unpaid deliveries listed and ticked to start (${on} of ${shown})`);
  await page.getByRole('button', { name: 'Untick all' }).click();
  assert((await ticked())[0] === 0 && !/Net kg being paid for/.test(await text()), 'Untick all clears every tick');
  await page.getByRole('button', { name: 'Tick all', exact: true }).click();
  assert((await ticked())[0] === shown, 'Tick all ticks them again');
  await page.getByRole('button', { name: 'This week' }).click();
  const week = await ticked();
  assert(week[1] < shown && /outside these dates/.test(await text()), `This week shows only this week's deliveries (${week[1]} of ${shown})`);
  await page.getByRole('button', { name: 'Dates' }).click();
  await page.locator('input[type=date]').nth(0).fill('2000-01-01'); await page.locator('input[type=date]').nth(1).fill('2000-01-31');
  assert((await ticked())[1] === 0 && /No unpaid deliveries in these dates/.test(await text()), 'custom dates with no deliveries show none');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  assert((await ticked())[1] === shown, 'All shows every unpaid delivery again');

  await nav('/pay?type=worker');
  await page.getByRole('button', { name: 'Give an advance' }).click();
  t = await text();
  assert(/PHOTOS, KEPT FOR REFERENCE \(OPTIONAL\)/i.test(t) && /signed wage slip/.test(t), 'worker payment offers an optional photo');
  await page.getByLabel(/Amount actually paid/).fill('300');
  await page.getByRole('button', { name: 'Save payment' }).click(); await page.waitForTimeout(400);
  assert(/Payment saved/.test(await page.locator('body').innerText()), 'a payment saves without a photo');

  // harvest: photos box, and to-dos for yourself or someone else
  await nav('/harvest');
  t = await text();
  assert(/PHOTOS OF THE SLIP/i.test(t) && /more than one/.test(t), 'harvest form offers more than one slip photo');
  await page.getByRole('button', { name: 'One for the whole delivery' }).click();
  await page.getByLabel('Worker 1 bag 1 kg').fill('40');
  await page.getByLabel('Worker 1 name').selectOption({ label: 'Lakshmi' });
  await page.getByRole('button', { name: '+ Add a to-do' }).click();
  await page.getByRole('button', { name: 'Check the deduction' }).click();
  await page.getByLabel('To do 1 worker').selectOption({ label: 'Lakshmi' });
  await page.getByRole('button', { name: '+ Add a to-do' }).click();
  await page.getByLabel('To do 2', { exact: true }).fill('Ask Mom about the bags');
  await page.getByLabel('To do 2 for').selectOption({ label: 'Mom' });
  await page.getByRole('button', { name: 'Save harvest' }).click(); await page.waitForTimeout(400);
  assert(/Harvest saved with 2 to-dos/.test(await page.locator('body').innerText()), 'harvest saves with its two to-dos');
  await nav('/');
  t = await text();
  assert(/Check the deduction\s*Harvest · [^·]+ · \w{3} \d+ \w{3} · Lakshmi · For Me/.test(t), 'Home lists the to-do for me with the field, day and worker');
  assert(/Ask Mom about the bags\s*Harvest · [^\n]* · For Mom/.test(t), 'and the one for Mom');
  await page.locator('.v2-row', { hasText: 'Check the deduction' }).getByText('Open').click(); await page.waitForTimeout(400);
  t = await text();
  assert(/Edit harvest/.test(await page.locator('.v2-h').innerText()) && /TO DO FROM THIS HARVEST[\s\S]*Check the deduction/i.test(t), 'Open goes to the harvest, which shows its open to-dos');
  await page.locator('.v2-row', { hasText: 'Ask Mom about the bags' }).getByText('Done').click(); await page.waitForTimeout(300);
  assert(!/Ask Mom about the bags/.test(await text()), 'Done there marks it done');

  // 📷 on entries that have photos
  await nav('/tea');
  assert(/Tue 10 Nov · [^\n]*📷/.test(await text()), 'harvest log shows 📷 on the harvest with slip photos');
  await nav('/harvest/d2');
  t = await text();
  assert(/PHOTOS OF THE SLIP, KEPT FOR REFERENCE · 2/i.test(t) && /Photo 1\s*Added 10 Nov 2026, 6:00 pm by Ragu/.test(t) && /Photo 2\s*Added 11 Nov 2026, 9:30 am by Ragu/.test(t), 'the harvest lists each photo with the India date and time it was added');
  await page.locator('.v2-row', { hasText: 'Photo 2' }).getByRole('button', { name: 'Remove' }).click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(400);
  assert(/Tue 10 Nov · [^\n]*📷/.test(await text()), 'removing one and saving still shows 📷');
  await nav('/harvest/d2');
  assert(/KEPT FOR REFERENCE · 1/i.test(await text()), 'and the harvest now has one photo');

  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 700)); process.exit(1); });
