#!/usr/bin/env node
/*
 * サンプル3人分のカード画像を docs/cards/ に保存する(確認用)
 *   npm run cards
 * ブラウザでの描画が必要なため Playwright(Chromium)を使います。
 * 画面と同じ index.html を読み込み、同じ js/card.js で描くので、実際のボタンと同じ画像になります。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright が見つかりません。カード画像の生成には Playwright が必要です。');
  process.exit(1);
}
const ROOT = path.join(__dirname, '..');
const { NOW, SAMPLES } = require('./samples.js');

(async () => {
  const outDir = path.join(ROOT, 'docs', 'cards');
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
  for (const s of SAMPLES) {
    const dataUrl = await page.evaluate(async ({ s, NOW }) => {
      const TX = window.COMPASS_TEXTS;
      const answers = Object.fromEntries(TX.questions.map((q, i) => [q.id, s.answers[i]]));
      const rep = window.Compass.report.build({ ...s.input, answers }, TX, new Date(NOW));
      const canvas = document.createElement('canvas');
      await window.Compass.card.draw(canvas, rep.card, TX.card, { includeBirth: false });
      if (!window.Compass.card.lastCheck.ok) throw new Error('はみ出し: ' + JSON.stringify(window.Compass.card.lastCheck.problems));
      return canvas.toDataURL('image/png');
    }, { s, NOW });
    const file = path.join(outDir, s.file + '.png');
    fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('保存しました:', path.relative(ROOT, file));
  }
  await browser.close();
  if (errors.length) { console.error(errors); process.exit(1); }
})();
