/* webtest.js — uji web full di Chromium headless (Playwright)
 * Hasil: shots/*.png + asserts. Jalan: node webtest.js [baseUrl]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'http://127.0.0.1:8901';
const SHOT = process.argv[3] || 'shots';
fs.mkdirSync(SHOT, { recursive: true });

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log('  OK  ' + name);
  else { console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); fails++; }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e).split('\n')[0]));

  console.log('== buka ' + BASE + ' ==');
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });

  // 1. splash + progress jalan
  await page.waitForTimeout(2500);
  await page.screenshot({ path: SHOT + '/1-splash.png' });
  const spct = await page.textContent('#spnum').catch(() => '');
  check('splash % bergerak', /%/.test(spct || ''), 'spnum=' + JSON.stringify(spct));

  // 2. tunggu chat siap (overlay hilang / hello muncul)
  await page.waitForFunction(
    () => !document.getElementById('splash') || document.querySelector('#chat .msg, #hello'),
    { timeout: 30000 }
  ).catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SHOT + '/2-chat-siap.png' });

  // 3. kirim pesan (mode offline canned)
  const inp = await page.$('#inp');
  check('input ada', !!inp);
  if (inp) {
    await inp.fill('harga emas hari ini berapa?');
    await page.click('#go');
  }
  await page.waitForFunction(
    () => document.querySelectorAll('.msg.ai').length > 0 &&
      /Rp|Emas|Harga|Sumber/i.test(document.querySelectorAll('.msg.ai')[0].textContent || ''),
    { timeout: 60000 }
  ).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SHOT + '/3-jawaban.png' });
  const aiText = await page.evaluate(() => {
    const a = document.querySelectorAll('.msg.ai');
    return a.length ? a[a.length - 1].textContent.slice(0, 200) : '';
  });
  check('AI jawab', aiText.length > 20, aiText.slice(0, 60));
  const cites = await page.evaluate(() => document.querySelectorAll('.msg.ai .cite').length);
  check('sitasi [1][2]', cites >= 1, 'cite=' + cites);
  const src = await page.evaluate(() => document.querySelectorAll('.search-sources .src-link').length);
  check('footer sumber', src >= 1, 'src=' + src);

  // 4. drawer + game menu
  await page.click('#bmenu').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT + '/4-drawer.png' });
  const hasGame = await page.evaluate(() => !!document.getElementById('dgame'));
  check('tombol Game', hasGame);
  if (hasGame) {
    await page.click('#dgame');
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOT + '/5-game.png' });
    const n = await page.evaluate(() => document.querySelectorAll('.gopt').length);
    check('5 kartu game', n === 5, 'n=' + n);
    // main ludo sekilas
    const ludo = await page.$('.gopt[data-g="ludo"]');
    if (ludo) {
      await ludo.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: SHOT + '/6-ludo.png' });
      const toks = await page.evaluate(() => document.querySelectorAll('.lutok').length);
      check('ludo 16 bidak', toks === 16, 'toks=' + toks);
    }
  }

  check('tanpa JS error', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails === 0 ? 'WEBTEST-OK' : 'WEBTEST-GAGAL: ' + fails);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
