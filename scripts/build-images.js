#!/usr/bin/env node
/*
 * 共有用プレビュー画像(OGP 1200×630)とホーム画面アイコン(180/192/512)を作る
 *   npm run images
 * 同梱フォント(index.html の fonts.css)で、ブラウザの Canvas に描いて PNG に保存する。
 * 個人の情報は入れない。Playwright(Chromium)が必要。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright が見つかりません。'); process.exit(1); }
const ROOT = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
  const out = await page.evaluate(async () => {
    const JA = '"Zen Kaku Gothic New"', EN = '"Space Grotesk"';
    const C = { bg: '#0B0B0B', lime: '#C8F03C', gold: '#E9C46A', white: '#F4F4F1', muted: '#B9B9B2' };
    const allText = 'KAKUU LAB / COMPASS 生まれた日の暦と、あなたの答えで作る戦略レポート 西洋占星術×数秘術×九星気学×性格の自己チェック 無料・入力内容は送信されません 北南東西';
    for (const f of ['400 30px ' + JA, '700 30px ' + JA, '700 30px ' + EN, '500 30px ' + EN]) await document.fonts.load(f, allText);
    await document.fonts.ready;

    function compass(ctx, cx, cy, r, opts) {
      opts = opts || {};
      ctx.save();
      // うっすら金色の光と円の模様
      const g = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 2.2);
      g.addColorStop(0, 'rgba(233,196,106,0.28)'); g.addColorStop(1, 'rgba(233,196,106,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2); ctx.fill();
      if (opts.rings) [1.25, 1.55, 1.85].forEach((k, i) => { ctx.strokeStyle = 'rgba(233,196,106,' + (0.28 - i * 0.07) + ')'; ctx.lineWidth = Math.max(1, r * 0.012); ctx.beginPath(); ctx.arc(cx, cy, r * k, 0, Math.PI * 2); ctx.stroke(); });
      ctx.strokeStyle = C.lime; ctx.lineWidth = r * 0.08; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = 'rgba(244,244,241,0.35)'; ctx.lineWidth = Math.max(1, r * 0.02);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 - Math.PI / 2; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78); ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); ctx.stroke(); }
      // 金色の針(北を指す)
      ctx.fillStyle = C.gold;
      ctx.beginPath(); ctx.moveTo(cx, cy - r * 0.72); ctx.lineTo(cx + r * 0.16, cy); ctx.lineTo(cx - r * 0.16, cy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(233,196,106,0.45)';
      ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.72); ctx.lineTo(cx + r * 0.16, cy); ctx.lineTo(cx - r * 0.16, cy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(cx, cy, r * 0.07, 0, Math.PI * 2); ctx.fill();
      if (opts.labels) {
        ctx.font = '700 ' + Math.round(r * 0.16) + 'px ' + JA; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillStyle = C.white; ctx.fillText('北', cx, cy - r * 1.12);
        ctx.fillStyle = C.muted; ctx.fillText('南', cx, cy + r * 1.12); ctx.fillText('東', cx + r * 1.12, cy); ctx.fillText('西', cx - r * 1.12, cy);
      }
      ctx.restore();
    }

    // ---- OGP 1200×630 ----
    const og = document.createElement('canvas'); og.width = 1200; og.height = 630;
    let ctx = og.getContext('2d');
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, 1200, 630);
    compass(ctx, 930, 315, 150, { rings: true, labels: true });
    ctx.strokeStyle = 'rgba(233,196,106,0.85)'; ctx.lineWidth = 2; ctx.strokeRect(24, 24, 1152, 582);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.font = '700 34px ' + EN; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px';
    const p1 = 'KAKUU LAB', p2 = '  /  ';
    ctx.fillStyle = C.white; ctx.fillText(p1, 80, 118);
    const w1 = ctx.measureText(p1).width, w2 = ctx.measureText(p2).width;
    ctx.fillStyle = C.muted; ctx.fillText(p2, 80 + w1, 118);
    ctx.fillStyle = C.lime; ctx.fillText('COMPASS', 80 + w1 + w2, 118);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.font = '700 54px ' + JA; ctx.fillStyle = C.white;
    ctx.fillText('生まれた日の暦と、', 80, 248);
    ctx.fillText('あなたの答えで作る', 80, 322);
    ctx.font = '700 64px ' + JA; ctx.fillStyle = C.lime;
    ctx.fillText('戦略レポート', 80, 404);
    ctx.font = '400 26px ' + JA; ctx.fillStyle = C.gold;
    ctx.fillText('西洋占星術×数秘術×九星気学×性格の自己チェック', 80, 482);
    ctx.font = '400 24px ' + JA; ctx.fillStyle = C.muted;
    ctx.fillText('無料・入力内容は送信されません', 80, 530);

    // ---- アイコン(正方形) ----
    function icon(size) {
      const cv = document.createElement('canvas'); cv.width = size; cv.height = size;
      const c = cv.getContext('2d');
      c.fillStyle = C.bg; c.fillRect(0, 0, size, size);
      compass(c, size / 2, size / 2, size * 0.3, {});
      return cv.toDataURL('image/png');
    }
    return { og: og.toDataURL('image/png'), i180: icon(180), i192: icon(192), i512: icon(512) };
  });
  const save = (name, dataUrl) => { fs.writeFileSync(path.join(ROOT, name), Buffer.from(dataUrl.split(',')[1], 'base64')); console.log('保存しました:', name); };
  save('og-image.png', out.og);
  save('apple-touch-icon.png', out.i180);
  save('icon-192.png', out.i192);
  save('icon-512.png', out.i512);
  await browser.close();
})();
