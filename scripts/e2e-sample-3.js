const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h); await page.waitForTimeout(300); };
  const text = () => page.locator('.v2-main').innerText();
  await page.goto('http://localhost:4173/#/settings/lists'); await page.waitForSelector('.v2-h');

  // location: chosen once, kept without pressing Save
  await page.getByRole('button', { name: 'Fields', exact: true }).click();
  await page.locator('button.v2-row.tap', { hasText: 'Road field' }).click();
  await page.getByLabel('Village or town').fill('11.3412, 76.7821');
  await page.getByRole('button', { name: 'Search' }).click(); await page.waitForTimeout(300);
  assert(/Location saved/.test(await page.locator('.v2-toast').innerText()), 'numbers typed in the town box are taken as a position and saved at once');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.locator('button.v2-row.tap', { hasText: 'Road field' }).click();
  assert(/11\.34, 76\.78/.test(await text()), 'the position is still there after leaving without pressing Save');
  assert(/Changing the location does not change harvests already saved/.test(await text()), 'the form says past harvests keep their rain');

  // manuring done by the lessee on a leased field
  await nav('/field/f3/work?add=manure');
  let t = await text();
  assert(/Done and paid for by the lessee \(Kumar\)/.test(t) && !/To pay for this work/.test(t) && !/LABOUR/i.test(t.split('WHAT THEY USED')[0].split('One-time')[1] || ''), 'leased field: lessee work is ticked, with no cost or payment boxes');
  await page.getByRole('button', { name: '+ Add manure' }).click();
  await page.getByRole('textbox', { name: 'What' }).fill('NPK mix');
  await page.getByLabel('Bags', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Save field work' }).click(); await page.waitForTimeout(400);
  t = await text();
  assert(/Manuring[\s\S]*?done by the lessee · 10 bags · NPK mix[\s\S]*?No cost to you/.test(t), 'it is listed as done by the lessee, 10 bags, no cost');
  await nav('/field/f3/plan');
  assert(/Manuring[\s\S]*?Last done 21 Nov 2026/i.test(await text()), 'and the plan now counts it as the last manuring');
  await nav('/settings/checks');
  assert(/All agree/.test(await text()), 'totals still agree');

  // ask Ragu about a payment
  await nav('/pay?entry=e1');
  await page.getByRole('button', { name: 'Not sure' }).first().click();
  await page.getByRole('button', { name: /Not sure about something here/ }).click();
  await page.getByRole('button', { name: 'Ragu' }).last().click();
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(400);
  await nav('/');
  t = await text();
  assert(/How was this received, and who received it\?[\s\S]*?For Ragu/.test(t), 'the question shows on Home for Ragu');
  await page.locator('.v2-row', { hasText: 'How was this received' }).getByRole('link', { name: 'Open' }).click(); await page.waitForTimeout(400);
  t = await text();
  assert(/Edit payment/.test(await page.locator('.v2-h').innerText()) && /QUESTION FOR RAGU/i.test(t), 'Open goes to that payment, which shows the question');
  await page.getByRole('button', { name: 'UPI' }).click();
  await page.getByRole('button', { name: 'Mark as answered' }).click(); await page.waitForTimeout(300);
  await nav('/');
  assert(!/How was this received/.test(await text()), 'answered questions leave Home');

  // reminder settings
  await nav('/settings/reminders');
  await page.getByLabel('Send to these email addresses').fill('me@example.com, nope');
  await page.getByRole('button', { name: 'Save addresses' }).click(); await page.waitForTimeout(200);
  assert(/does not look like an email address: nope/.test(await page.locator('.v2-toast').innerText()), 'a bad email address is refused');
  assert(/1 property has rent not logged: Shop 2/.test(await text()), 'the screen says what would be sent');
  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 700)); process.exit(1); });
