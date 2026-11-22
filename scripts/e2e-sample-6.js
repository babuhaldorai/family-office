// Tea → Payments: quick buttons on every Tea tab, who is waiting (agents and
// workers) with one tap to pay, the list of agent and worker payments, and
// coming back to Tea after saving. Runs against a REACT_APP_DEMO=1 build on 4173.
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('ok  ', m); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  page.on('dialog', (d) => d.accept());
  const nav = async (h) => { await page.evaluate((x) => { window.location.hash = x; }, h); await page.waitForTimeout(300); };
  const text = () => page.locator('.v2-main').innerText();
  const hash = () => page.evaluate(() => window.location.hash);
  await page.goto('http://localhost:4173/#/tea'); await page.waitForSelector('.v2-h');

  for (const tab of ['harvest', 'fields', 'people']) {
    await nav('/tea/' + tab);
    assert(await page.getByRole('link', { name: '+ Agent payment' }).isVisible() && await page.getByRole('link', { name: '+ Pay a worker' }).isVisible(), `Tea → ${tab}: both payment buttons are at the top`);
  }
  await page.getByRole('link', { name: '+ Pay a worker' }).click(); await page.waitForTimeout(300);
  assert(/Record a payment/.test(await page.locator('.v2-h').innerText()) && /Earned and not yet paid/.test(await text()), '+ Pay a worker opens the wages form');
  await page.getByRole('link', { name: /Back/i }).first().click().catch(() => {});
  await nav('/tea/harvest');
  await page.getByRole('link', { name: '+ Agent payment' }).click(); await page.waitForTimeout(300);
  assert(/Which deliveries is this payment for/i.test(await text()), '+ Agent payment opens the agent form');

  await nav('/tea');
  await page.getByRole('tab', { name: 'Payments' }).click(); await page.waitForTimeout(300);
  let t = await text();
  assert(/AGENTS TO PAY US/i.test(t) && /WORKERS TO PAY/i.test(t), 'Payments tab shows agents and workers waiting');
  const firstWorker = page.locator('.v2-card', { hasText: /Workers to pay/i }).locator('a.v2-row').first();
  const name = (await firstWorker.locator('strong').first().innerText()).trim();
  await firstWorker.click(); await page.waitForTimeout(300);
  const sel = await page.getByLabel('Worker').evaluate((s) => s.options[s.selectedIndex].text);
  assert(sel.startsWith(name), `tapping ${name} opens their wages with them chosen`);
  await page.getByRole('button', { name: 'Save payment' }).click(); await page.waitForTimeout(400);
  assert((await hash()) === '#/tea/payments', 'after saving, back on Tea → Payments');
  t = await text();
  assert(new RegExp(`${name} · Wages`).test(t), 'the new wage payment is in the list');
  assert(!(await page.locator('.v2-card', { hasText: /Workers to pay/i }).first().innerText()).includes(name), `${name} is no longer in Workers to pay`);

  await page.getByLabel('Agents or workers').selectOption('agent');
  t = await text();
  assert(!/· Wages/.test(t), 'Agents only hides the wages');
  await page.getByLabel('Agents or workers').selectOption('worker');
  await page.locator('.v2-row', { hasText: `${name} · Wages` }).first().click(); await page.waitForTimeout(300);
  assert(/Edit payment/.test(await page.locator('.v2-h').innerText()), 'tapping a payment opens it to change');
  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 700)); process.exit(1); });
