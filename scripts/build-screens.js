#!/usr/bin/env node
/*
 * 画面のスクリーンショット(スマホ幅375px・PC幅1280px)を docs/screens/ に保存する(確認用)
 *   npm run screens
 * 日付は 2026/11/2 に固定。サンプルの入力で、入力 → 質問 → レポートの順に実際に操作して撮る。
 * Playwright(Chromium)が必要。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright が見つかりません。'); process.exit(1); }
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'screens');
const URL0 = pathToFileURL(path.join(ROOT, 'index.html')).href;

async function run(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 500 ? 812 : 900 }, timezoneId: 'Asia/Tokyo' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+09:00'));
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const tag = width < 500 ? 'sp' : 'pc';
  const save = async (name) => { const f = path.join(OUT, `${tag}-${name}.png`); await page.screenshot({ path: f }); console.log('保存しました:', path.relative(ROOT, f)); };
  // 見出しの位置まで動かして撮る(上の固定ヘッダーの分だけずらす)
  const at = async (locator, name) => {
    await locator.first().evaluate((el) => {
      const head = document.querySelector('.site-header');
      const h = head ? head.getBoundingClientRect().height : 0;
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - h - 12, behavior: 'instant' });
    });
    await page.waitForTimeout(300);
    await save(name);
  };

  await page.goto(URL0);
  await page.fill('#nickname', 'ハル'); await page.fill('#birthdate', '1990-07-15');
  await page.selectOption('#homePref', '東京都');
  await page.click('#themes >> text=恋愛・パートナー');
  await page.click('#situation >> text=気になる人がいる'); await page.click('#situation >> text=安心・信頼');
  if (tag === 'sp') await at(page.locator('.remember-box'), '1-input-remember');
  await page.click('#form1 button[type=submit]');
  const vals = [3, 2, 6, 6, 4, 6, 6, 2, 3, 5];
  for (let i = 0; i < 10; i++) await page.click(`#q-Q${String(i + 1).padStart(2, '0')} .scale label:nth-child(${vals[i]})`);
  await page.click('#q-X1 >> text=頭ごなしに否定されたとき'); await page.click('#q-X2 >> text=準備を重ねたとき');
  await page.click('#form2 button[type=submit]');
  await page.waitForSelector('#r-themeswitch');
  await page.click('.panel .check-item label >> nth=0');
  await at(page.locator('.panel'), '2-summary-panel');
  if (tag === 'sp') await at(page.locator('.panel .checklist'), '3-summary-actions');
  await at(page.locator('#r-guide'), '4-chapter-point');
  await at(page.locator('h4', { hasText: '3-4' }), '5-checklist');
  await at(page.locator('h4', { hasText: '3-5' }), '6-luckydays');
  await at(page.locator('h4', { hasText: '3-6' }), '7-directions');
  await at(page.locator('#r-caution'), '8-caution');
  await page.check('#remember2');
  await at(page.locator('.memory-box'), '9-memory');
  if (tag === 'sp') {
    await page.reload();
    await at(page.locator('#resumeBox'), '10-resume');
    await page.click('#resumeNo');
  }
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  await run(browser, 375);
  await run(browser, 1280);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
