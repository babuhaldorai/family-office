const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { throw new Error('ASSERT: ' + m); } console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h); await page.waitForTimeout(300); };
  const text = () => page.locator('.v2-main').innerText();
  await page.goto('http://localhost:4173/#/'); await page.waitForSelector('.v2-h');
  let t = await text();
  assert(/Agent B has not paid yet/.test(t) && /265\.0 kg/.test(t), 'Home shows Agent B unpaid 265 kg');
  assert(/Wages due/.test(t) && /₹1,210/.test(t), 'Home shows wages due 1,210');

  // 1. harvest day: 3 bags of 50, one deduction of 10
  await nav('/harvest');
  await page.getByRole('button', { name: 'One for the whole delivery' }).click();
  await page.getByLabel('Worker 1 bag 1 kg').fill('50');
  await page.getByLabel('Worker 1 bag 1 kg').press('Enter');
  await page.getByLabel('Worker 1 bag 2 kg').fill('50');
  await page.getByRole('button', { name: '+ Add another worker' }).click();
  await page.getByLabel('Worker 2 name').selectOption({ label: 'Selvi' });
  await page.getByLabel('Worker 2 bag 1 kg').fill('50');
  await page.getByLabel('For bags (kg)').fill('5');
  await page.getByLabel('For water (kg)').fill('5');
  t = await text();
  assert(/150\.0 weighed − 10\.0 deducted/.test(t) && /140\.0 kg/.test(t), 'harvest form: 150 weighed, 10 deducted, 140 net');
  assert(/93\.3 kg × ₹6[\s\S]*?₹560/.test(t) && /46\.7 kg × ₹6[\s\S]*?₹280/.test(t), 'wages preview 560 and 280');
  assert(/Not known yet/.test(t), 'rate not known yet');
  await page.getByRole('button', { name: 'Save harvest' }).click(); await page.waitForTimeout(400);
  t = await text();
  assert(/Sat 21 Nov/.test(t) && /Rate not known/.test(t), 'new harvest is in the log without a rate');

  // 2. agent B pays: rate entered at payment time
  await nav('/pay?type=agent&party=a2');
  t = await text();
  assert(/265\.0 kg/.test(t), 'agent B: the two unpaid deliveries are ticked (265 kg)');
  await page.getByLabel('Rate the agent is paying (₹ per kg)').fill('23');
  t = await text();
  assert(/265\.0 kg × ₹23\.00 should be[\s\S]*₹6,095/.test(t), 'expected 6,095');
  assert(await page.getByLabel('Amount actually received (₹)').inputValue() === '6095', 'amount prefilled with 6095');
  await page.getByRole('button', { name: 'Bank transfer' }).click();
  await page.getByRole('button', { name: 'Save payment' }).click(); await page.waitForTimeout(400);
  await nav('/');
  t = await text();
  assert(!/Agent B has not paid yet/.test(t), 'Home no longer lists Agent B');
  await nav('/tea');
  t = await text();
  assert(/Tue 10 Nov · Road field · Agent B[\s\S]{0,120}₹23\.00 = ₹2,806/.test(t), 'delivery of 10 Nov now carries rate 23.00 and an amount');

  // 3. paying a different amount demands a reason
  await nav('/reports/entries');
  await page.locator('button.v2-row.tap', { hasText: 'Agent B' }).first().click(); await page.waitForTimeout(300);
  await page.getByLabel('Amount actually received (₹)').fill('6000');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(300);
  assert(/Choose why/.test(await page.locator('.v2-toast').innerText()), 'saving a different amount without a reason is refused');
  await page.getByRole('button', { name: 'Rounded off' }).click();
  await page.getByLabel('Comment on the difference').fill('Agent rounded down');
  await page.getByRole('button', { name: 'Save changes' }).click(); await page.waitForTimeout(400);
  await nav('/tea/people');
  t = await text();
  assert(/Agent B[\s\S]*?Paid/.test(t) && !/Agent B[^\n]*\n[^\n]*owed/.test(t), 'Agent B shows as paid after a closed difference');

  // 4. pay a worker with an advance taken back
  await nav('/pay?type=worker&party=w3');
  t = await text();
  assert(/₹1,210/.test(t) && /Still owes ₹8,500/.test(t), 'Murugan: 1,210 due, 8,500 advance owed');
  await page.getByLabel('Advance to take back now').fill('200');
  t = await text();
  assert(/To pay\s*₹1,010/.test(t), 'to pay is 1,010 after taking back 200');
  await page.getByRole('button', { name: 'Save payment' }).click(); await page.waitForTimeout(400);
  await nav('/');
  t = await text();
  assert(/Wages due\s*2 workers\s*₹840/.test(t), 'Home wages due is now only today\'s new harvest: 2 workers, 840');
  await nav('/tea/people');
  assert(/advance owed ₹8,300/.test(await text()), 'Murugan advance is now 8,300');

  // 5. manure applied from stock
  await nav('/field/f2/work?add=manure');
  await page.getByRole('link', { name: 'Apply manure from stock' }).click(); await page.waitForTimeout(300);
  { const sel = page.getByLabel('Line 1 manure'); const o = (await sel.locator('option').allInnerTexts()).find((x) => /^NPK mix/.test(x)); await sel.selectOption({ label: o }); }
  await page.getByLabel('Line 1 bags applied').fill('4');
  await page.getByRole('textbox', { name: '₹ per bag to apply' }).fill('200');
  t = await text();
  assert(/4 bags × ₹200 to apply\s*₹800/.test(t) && /already paid\s*₹5,760/.test(t), 'applying 4 bags: 800 to pay, 5,760 of manure from stock');
  await page.getByRole('button', { name: 'Save', exact: true }).click(); await page.waitForTimeout(400);
  await nav('/tea/fields');
  assert(/NPK mix[\s\S]*?8 left/.test(await text()), 'NPK stock went from 12 to 8 left');

  // 6. a harvest that is part of a payment cannot be deleted
  await nav('/harvest/d2');
  await page.getByRole('button', { name: 'Delete this harvest' }).click(); await page.waitForTimeout(300);
  assert(/part of Agent B's payment/.test(await page.locator('.v2-toast').innerText()), 'deleting a paid delivery is refused');

  // 7. delete a payment -> recycle bin -> bring back
  await nav('/pay?entry=pay-w1');
  await page.getByRole('button', { name: 'Delete this payment' }).click(); await page.waitForTimeout(300);
  await nav('/tea/people');
  assert(/Lakshmi[\s\S]*?due/.test(await text()), 'after deleting her payment Lakshmi is owed wages again');
  await nav('/settings/bin');
  assert(/payment: wages 2026-11-13/.test(await text()), 'deleted payment is in the recycle bin');
  await page.getByRole('button', { name: 'Bring back' }).click(); await page.waitForTimeout(300);
  assert(/recycle bin is empty/.test(await text()), 'bin is empty after bringing it back');

  // 8. history and totals
  await nav('/settings/history');
  assert(/Brought back payment/.test(await text()), 'history lists the change');
  await nav('/settings/checks');
  t = await text();
  assert(/All agree/.test(t) && !/\bCheck\b\n/.test(t), 'every totals check passes after all of the above');
  await nav('/reports');
  assert(/These lines add up exactly/.test(await text()), 'profit and cash reconcile on the report');

  // 9. data-entry access sees no money
  await page.goto('http://localhost:4173/?role=entry#/'); await page.waitForSelector('.v2-h');
  t = await page.locator('.v2').innerText();
  assert(!/Needs attention/i.test(t) && !/Reports/.test(t) && !/Money in/.test(t), 'data entry role: no money on Home, no Reports');
  await nav('/reports'); assert(/not available/.test(await text()), 'data entry role cannot open Reports');
  await nav('/pay'); assert(/not change/.test(await text()), 'data entry role cannot record payments');
  // 10. viewer cannot edit
  await page.goto('http://localhost:4173/?role=viewer#/harvest'); await page.waitForSelector('.v2-h');
  assert(/not change/.test(await text()), 'viewer cannot add a harvest');
  // 11. empty app
  await page.goto('http://localhost:4173/?empty=1#/'); await page.waitForSelector('.v2-h');
  assert(/Nothing has been entered/.test(await text()), 'empty app shows getting started');
  await browser.close();
  console.log('ALL PASSED');
})().catch((e) => { console.log(e.message); process.exit(1); });
