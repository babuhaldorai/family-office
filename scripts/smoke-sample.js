const { chromium } = require('playwright');
const out = process.argv[2];
const routes = ['/', '/harvest', '/harvest/d5', '/pay', '/pay?type=worker&party=w3', '/pay?type=worker&party=w1', '/pay?type=tenant&tenancy=tn1', '/pay?type=bill', '/pay?type=other', '/pay?entry=sale-nov', '/pay?entry=pay-w1',
 '/tea', '/tea/account', '/tea/fields', '/tea/people', '/tea/equipment', '/field/f2', '/field/f1/work', '/field/f1/work?add=manure', '/field/f1/money', '/field/f3/lease', '/field/f1/lease', '/stock', '/stock/s1',
 '/rentals', '/homes', '/property/p1', '/property/p3', '/reports', '/reports/better', '/reports/fields', '/reports/agents', '/reports/workers', '/reports/rentals', '/reports/entries',
 '/settings', '/settings/lists', '/settings/users', '/settings/backup', '/settings/checks', '/settings/history', '/settings/bin', '/settings/import', '/settings/reminders'];
(async () => {
  const browser = await chromium.launch();
  let bad = 0;
  for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desk', { width: 1360, height: 900 }]]) {
    const page = await browser.newPage({ viewport: vp });
    const errs = [];
    page.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/open-meteo|Failed to load resource|ERR_/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0, 300)); });
    await page.goto('http://localhost:4173/#/');
    await page.waitForSelector('.v2-h');
    for (const r of routes) {
      errs.length = 0;
      await page.evaluate((h) => { window.location.hash = h; }, r);
      await page.waitForTimeout(350);
      const title = await page.locator('.v2-h').first().textContent().catch(() => 'NO TITLE');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const nan = await page.evaluate(() => /NaN|undefined|Infinity|\[object/.test(document.querySelector('.v2-main').innerText));
      const flag = errs.length || overflow > 2 || nan;
      if (flag) { bad++; console.log(`${name} ${r} -> "${title}" overflow=${overflow} nan=${nan}`, errs.join(' | ')); }
      await page.screenshot({ path: `${out}/${name}${r.replace(/[\/?=&]/g, '_')}.png`, fullPage: true });
    }
    await page.close();
  }
  console.log('routes with problems:', bad);
  await browser.close();
})();
