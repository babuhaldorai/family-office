// Optional photo on payments: the card is there for agent and worker payments,
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
  assert(/PHOTO, KEPT FOR REFERENCE \(OPTIONAL\)/i.test(t) && /agent's bill/.test(t), 'agent payment offers an optional photo');
  await page.getByRole('button', { name: 'Take or choose a photo' }).click(); await page.waitForTimeout(200);
  assert(/Photos cannot be stored on sample data/.test(await page.locator('body').innerText()), 'sample mode says photos are not stored');

  await nav('/pay?type=worker');
  await page.getByRole('button', { name: 'Give an advance' }).click();
  t = await text();
  assert(/PHOTO, KEPT FOR REFERENCE \(OPTIONAL\)/i.test(t) && /signed wage slip/.test(t), 'worker payment offers an optional photo');
  await page.getByLabel(/Amount actually paid/).fill('300');
  await page.getByRole('button', { name: 'Save payment' }).click(); await page.waitForTimeout(400);
  assert(/Payment saved/.test(await page.locator('body').innerText()), 'a payment saves without a photo');
  await browser.close(); console.log('ALL PASSED');
})().catch((e) => { console.log(e.message.slice(0, 700)); process.exit(1); });
