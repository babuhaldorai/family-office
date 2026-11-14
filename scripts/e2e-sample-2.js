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

  // the receipt of 13 Nov: two columns, each with its own deduction
  await nav('/harvest');
  const col1 = [25, 28, 28, 22, 27, 32, 29], col2 = [24, 25, 23, 17, 26, 23, 26];
  let n = 1;
  for (const kg of col1) { await page.getByLabel(`Bag ${n} weight in kg`).fill(String(kg)); await page.getByLabel(`Bag ${n} weight in kg`).press('Enter'); n++; }
  for (const kg of col2) { await page.getByLabel(`Bag ${n} weight in kg`).fill(String(kg)); await page.getByLabel(`Bag ${n} picked by`).selectOption({ label: 'Selvi' }); if (n < 14) await page.getByLabel(`Bag ${n} weight in kg`).press('Enter'); n++; }
  await page.getByRole('button', { name: 'The slip gives a deduction for each worker' }).click();
  await page.getByLabel('Lakshmi', { exact: true }).fill('7');
  await page.getByLabel('Selvi', { exact: true }).fill('6');
  let t = await text();
  assert(/355\.0 weighed − 13\.0 deducted/.test(t) && /342\.0 kg/.test(t), 'receipt: 355 weighed, 13 deducted, 342 net');
  assert(/Lakshmi · 184\.0 kg × ₹6[\s\S]*?₹1,104/.test(t), 'column 1: 184 kg x 6 = 1,104 as on the slip');
  assert(/Selvi · 158\.0 kg × ₹6[\s\S]*?₹948/.test(t), 'column 2: 158 kg x 6 = 948 as on the slip');
  await page.getByRole('button', { name: 'Save harvest' }).click(); await page.waitForTimeout(400);
  await nav('/settings/checks');
  assert(/All agree/.test(await text()), 'totals check passes with per-worker deductions');

  // usual agent for a field, with dates
  await nav('/settings/lists');
  await page.getByRole('button', { name: 'Fields', exact: true }).click();
  await page.locator('button.v2-row.tap', { hasText: 'Upper field' }).click();
  await page.getByRole('button', { name: '+ Set the usual agent' }).click();
  await page.getByLabel('Agent').first().selectOption({ label: 'Agent B' });
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(300);
  await nav('/harvest');
  await page.getByLabel('Field').first().selectOption({ label: 'Upper field' }); await page.waitForTimeout(200);
  assert(await page.locator('select').nth(1).evaluate((el) => el.options[el.selectedIndex].text) === 'Agent B', 'choosing Upper field fills in Agent B');
  assert(/Usual agent for this field/.test(await text()), 'and says it is the usual agent');
  await page.getByLabel('Field').first().selectOption({ label: 'Road field' }); await page.waitForTimeout(200);
  assert(await page.locator('select').nth(1).evaluate((el) => el.options[el.selectedIndex].text) === 'Agent B', 'a field with no usual agent leaves the agent as it was');

  // location pasted from Google Maps
  await nav('/settings/lists');
  await page.getByRole('button', { name: 'Fields', exact: true }).click();
  await page.locator('button.v2-row.tap', { hasText: 'Road field' }).click();
  await page.getByLabel('Position from Google Maps').fill('https://www.google.com/maps/place/X/@11.30,76.70,17z/data=!3d11.3412!4d76.7821');
  await page.getByRole('button', { name: 'Use', exact: true }).click();
  assert(/11\.34, 76\.78/.test(await text()), 'a pasted Google Maps address sets the position');
  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 600)); process.exit(1); });
