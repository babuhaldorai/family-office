// Buying several manure types at once, mixing, applying to two fields in a
// day, the buy plan, the idea on Home, every day accounted for, and one
// worker's earnings. Runs against a REACT_APP_DEMO=1 build served on 4173.
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  const pick = async (label, re) => { const sel = page.getByLabel(label); const opts = await sel.locator('option').allInnerTexts(); const o = opts.find((x) => re.test(x)); if (!o) throw new Error(`no option ${re} in ${label}: ${opts.join(' | ')}`); await sel.selectOption({ label: o }); };
  const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h); await page.waitForTimeout(300); };
  const text = () => page.locator('.v2-main').innerText();
  await page.goto('http://localhost:4173/#/'); await page.waitForSelector('.v2-h');
  let t = await text();
  assert(/IDEA FOR TODAY/i.test(t), 'Home shows an idea for today');
  const first = await page.locator('.v2-card', { hasText: /Idea for today/i }).locator('strong').first().innerText();
  await page.getByRole('button', { name: 'Another idea' }).click();
  assert(first !== await page.locator('.v2-card', { hasText: /Idea for today/i }).locator('strong').first().innerText(), '"Another idea" shows a different one');

  // buy plan, while Road field is due
  await nav('/reports/plan');
  t = await text();
  assert(/MANURE TO BUY, BY TYPE/i.test(t) && /Road field[\s\S]*?\d+ bags/.test(t) && /By type[\s\S]*?Urea[\s\S]*?Buy \d+/.test(t), 'Plan ahead shows bags for the due field and what to buy by type');

  // one purchase, three types, one transport charge
  await nav('/stock');
  await page.getByLabel('Line 1 type').fill('NPK'); await page.getByLabel('Line 1 bags').fill('10'); await page.getByLabel('Line 1 price per bag').fill('1400');
  await page.getByRole('button', { name: '+ Another type' }).click();
  await page.getByLabel('Line 2 type').fill('Dolomite'); await page.getByLabel('Line 2 bags').fill('5'); await page.getByLabel('Line 2 price per bag').fill('300');
  await page.getByLabel(/transport for the whole load/).fill('750');
  t = await text();
  assert(/15 bags · ₹15,500 \+ ₹750 transport\s*₹16,250/.test(t), 'purchase total: 15 bags, 15,500 + 750 transport = 16,250');
  assert(/₹1,450 a bag delivered/.test(t), 'each type shows its price with its share of transport');
  await page.getByRole('button', { name: 'Save purchase' }).click(); await page.waitForTimeout(400);

  // mix 6 NPK + 3 Dolomite into 10 bags
  await nav('/mix');
  await pick('Mix line 1 from', /^NPK · 21 Nov · 10 left/);
  await page.getByLabel('Mix line 1 bags').fill('6');
  await pick('Mix line 2 from', /^Dolomite/);
  await page.getByLabel('Mix line 2 bags').fill('3');
  await page.getByLabel(/Filled back into how many bags/).fill('10');
  t = await text();
  assert(/Mix ratio\s*NPK 2 : Dolomite 1/.test(t) && /NPK 67% · Dolomite 33%/.test(t), 'the mix ratio is shown as 2 : 1 (67% / 33%)');
  assert(/Value of each mixed bag\s*₹975/.test(t), 'each mixed bag is valued at 975');
  await page.getByRole('button', { name: 'Save mix' }).click(); await page.waitForTimeout(400);

  // apply to two fields in one day
  await nav('/apply');
  await page.getByLabel('Line 1 field').selectOption({ label: 'Upper field' });
  await pick('Line 1 manure', /^Mix: Mix of NPK \+ Dolomite/);
  await page.getByLabel('Line 1 bags applied').fill('6');
  await page.getByRole('button', { name: '+ Another field' }).click();
  await page.getByLabel('Line 2 field').selectOption({ label: 'Road field' });
  await page.getByLabel('Line 2 bags applied').fill('5');
  t = await text();
  assert(/That is 1 bags more than are left/.test(t), 'applying more than is left is flagged');
  await page.getByLabel('Line 2 bags applied').fill('4');
  await page.getByRole('textbox', { name: '₹ per bag to apply' }).fill('200');
  t = await text();
  assert(/10 bags × ₹200 to apply\s*₹2,000/.test(t) && /already paid\s*₹9,750/.test(t), 'labour 2,000 for 10 bags, plus 9,750 of mix from stock');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(400);
  await nav('/tea/fields');
  t = await text();
  assert(/Mix of NPK \+ Dolomite[\s\S]*?NPK 6 \+ Dolomite 3 bags → 10 mixed bags[\s\S]*?0 left/.test(t), 'the mix is listed with what went in, and none left');
  assert(/NPK · bought[\s\S]*?4 left/.test(t), 'NPK has 4 left after the mix');
  await nav('/field/f2/work');
  assert(/Manuring[\s\S]*?4 bags/.test(await text()), 'Road field shows its 4 bags');
  await nav('/settings/checks');
  assert(/All agree/.test(await text()), 'all totals agree');

  await nav('/reports/plan');
  assert(/No field is due for manuring now/.test(await text()), 'after manuring both fields, the buy plan says none are due');

  // every day accounted for
  await nav('/reports/entries');
  await page.getByRole('button', { name: 'Harvests', exact: true }).click();
  await page.getByRole('button', { name: 'This month' }).click();
  t = await text();
  const m = t.match(/(\d+) not logged/);
  assert(m && Number(m[1]) > 0, `days not logged are counted (${m && m[1]})`);
  await page.getByRole('button', { name: /^Sat 14 Nov$/ }).click(); await page.waitForTimeout(300);
  t = await text();
  assert(new RegExp(`${Number(m[1]) - 1} not logged`).test(t), 'marking a day "no harvest" takes it off the not-logged list');
  assert(/Sat 14 Nov · no harvest/.test(t), 'and the day shows in the list as no harvest');

  // a worker's earnings by date range
  await nav('/tea/people');
  await page.locator('a.v2-row', { hasText: 'Lakshmi' }).click(); await page.waitForTimeout(300);
  t = await text();
  assert(/Lakshmi/.test(await page.locator('.v2-h').innerText()) && /DAY BY DAY/i.test(t) && /Earned/.test(t), 'tapping a worker opens their earnings day by day');
  await page.getByRole('button', { name: 'This week' }).click();
  t = await text();
  assert(/Earned\s*₹[\d,]+\s*\d+ days? · [\d.]+ kg/.test(t), 'the period changes the totals');
  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 700)); process.exit(1); });
