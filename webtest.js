/* webtest.js — uji web full di Chromium headless (Playwright)
 * Target: web REAL (GitHub Pages), bukan localhost.
 * Hasil: shots/*.png + asserts. Jalan: node webtest.js [baseUrl]
 */
const { chromium } = require('playwright');
const fs = require('fs');

const BASE = process.argv[2] || 'https://nemoobc.github.io/opencode-android-web/';
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
  // tunggu jawaban SELESAI (markdown render = onDone kelar), bukan kata pertama
  await page.waitForFunction(
    () => {
      const a = document.querySelectorAll('.msg.ai');
      if (!a.length) return false;
      const last = a[a.length - 1];
      return last.querySelector('.md') && /Rp|Emas|Harga|Sumber/i.test(last.textContent || '');
    },
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

  // 4. AI gambar (AI kirim gambar)
  await inp.fill('buatkan gambar kucing astronot');
  await page.click('#go');
  await page.waitForSelector('.msg.ai .aimg', { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: SHOT + '/4-gambar.png' });
  const imgSrc = await page.evaluate(() => {
    const im = document.querySelector('.msg.ai .aimg');
    return im ? im.src : '';
  });
  check('AI kirim gambar', imgSrc.includes('pollinations'), imgSrc.slice(0, 60));

  // 5. AI file (tanya dulu chat/file)
  await inp.fill('buatkan file kode python kalkulator');
  await page.click('#go');
  await page.waitForSelector('.fchoice', { timeout: 15000 }).catch(() => {});
  const choiceBtns = await page.evaluate(() => document.querySelectorAll('.fchoice button').length);
  check('pilihan chat/file', choiceBtns === 2, 'btn=' + choiceBtns);
  await page.screenshot({ path: SHOT + '/5-pilihan.png' });
  await page.click('.fchoice [data-pick="file"]').catch(() => {});
  await page.waitForSelector('.fcard', { timeout: 60000 }).catch(() => {});
  await page.screenshot({ path: SHOT + '/6-file.png' });
  const fname = await page.evaluate(() => {
    const f = document.querySelector('.fcard .fname');
    return f ? f.textContent : '';
  });
  check('kartu file', /\.py|\.txt/.test(fname), fname);
  await page.click('.fcard [data-vw]').catch(() => {});
  await page.waitForTimeout(500);
  const mdBack = await page.evaluate(() => document.querySelectorAll('.msg.ai .md').length);
  check('lihat = markdown', mdBack >= 1, 'md=' + mdBack);

  // 6. drawer + game menu
  await page.click('#bmenu').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOT + '/7-drawer.png' });
  const hasGame = await page.evaluate(() => !!document.getElementById('dgame'));
  check('tombol Game', hasGame);
  if (hasGame) {
    await page.click('#dgame');
    await page.waitForTimeout(600);
    await page.screenshot({ path: SHOT + '/8-game.png' });
    const n = await page.evaluate(() => document.querySelectorAll('.gopt').length);
    check('5 kartu game', n === 5, 'n=' + n);
    // ludo
    const ludo = await page.$('.gopt[data-g="ludo"]');
    if (ludo) {
      await ludo.click();
      await page.waitForTimeout(1200);
      await page.screenshot({ path: SHOT + '/9-ludo.png' });
      const toks = await page.evaluate(() => document.querySelectorAll('.lutok').length);
      check('ludo 16 bidak', toks === 16, 'toks=' + toks);
      await page.click('#gback');
      await page.waitForTimeout(400);
    }
    // quiz: jawab 1 soal
    const quiz = await page.$('.gopt[data-g="quiz"]');
    if (quiz) {
      await quiz.click();
      await page.waitForTimeout(800);
      await page.click('.qopt').catch(() => {});
      await page.waitForTimeout(500);
      await page.screenshot({ path: SHOT + '/10-quiz.png' });
      const answered = await page.evaluate(() => document.querySelectorAll('.qopt.right,.qopt.wrong').length);
      check('quiz jawab', answered >= 1, 'marked=' + answered);
      await page.click('#gback');
      await page.waitForTimeout(400);
    }
    // puzzle
    const puzzle = await page.$('.gopt[data-g="puzzle"]');
    if (puzzle) {
      await puzzle.click();
      await page.waitForTimeout(800);
      const tiles = await page.evaluate(() => document.querySelectorAll('.pztile').length);
      check('puzzle 8 ubin', tiles === 8, 'tiles=' + tiles);
      await page.click('#gback');
      await page.waitForTimeout(400);
    }
    // snake (canvas ada)
    const snake = await page.$('.gopt[data-g="snake"]');
    if (snake) {
      await snake.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: SHOT + '/11-snake.png' });
      const cv = await page.evaluate(() => !!document.getElementById('snk'));
      check('snake canvas', cv);
      await page.click('#gback');
      await page.waitForTimeout(400);
    }
    // tic: langkah pertama
    const tic = await page.$('.gopt[data-g="tic"]');
    if (tic) {
      await tic.click();
      await page.waitForTimeout(800);
      const cells = await page.evaluate(() => document.querySelectorAll('.tcell').length);
      check('tic 9 sel', cells === 9, 'cells=' + cells);
      await page.click('.tcell[data-i="4"], .tcell');
      await page.waitForTimeout(1500);
      const marked = await page.evaluate(() => {
        let c = 0;
        document.querySelectorAll('.tcell').forEach((el) => { if (el.querySelector('svg')) c++; });
        return c;
      });
      check('tic jalan', marked >= 1, 'marked=' + marked);
      await page.screenshot({ path: SHOT + '/12-tic.png' });
      await page.click('#gback');
      await page.waitForTimeout(400);
    }
    await page.click('#gclose').catch(() => {});
  }

  // 7. toggle web + modal model
  const t0 = await page.evaluate(() => document.getElementById('bsearch').classList.contains('active'));
  await page.click('#bsearch');
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => document.getElementById('bsearch').classList.contains('active'));
  check('toggle web', t0 !== t1);
  await page.click('#mchip');
  await page.waitForTimeout(500);
  const mopen = await page.evaluate(() => document.getElementById('mmodel').classList.contains('show'));
  check('modal model', mopen);
  await page.screenshot({ path: SHOT + '/13-model.png' });
  await page.click('#mclose').catch(() => {});

  check('tanpa JS error', errs.length === 0, errs.slice(0, 3).join(' | '));
  await browser.close();
  console.log(fails === 0 ? 'WEBTEST-OK' : 'WEBTEST-GAGAL: ' + fails);
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
