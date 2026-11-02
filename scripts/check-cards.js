#!/usr/bin/env node
/*
 * カード画像のストレステスト(はみ出しの自動検出)
 *   npm run cards:check
 * すべてのテーマ×状況の答え×本命星(一白〜九紫)×複数の月で、長いニックネーム・生年月日ありも含めてカードを描き、
 * 文字や色の丸が「左右のカードの枠」「外枠」からはみ出していないか、下の注意書きに重なっていないかを調べます。
 * さらに、わざと長くした文章でも収まる(縮小・折り返し・カードの高さ調整が働く)ことを確かめます。
 * Playwright(Chromium)が必要です。
 */
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.error('Playwright が見つかりません。'); process.exit(1); }
const ROOT = path.join(__dirname, '..');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(ROOT, 'index.html')).href);
  const result = await page.evaluate(async () => {
    const TX = window.COMPASS_TEXTS, C = window.Compass;
    const answers = Object.fromEntries(TX.questions.map((q) => [q.id, 4]));
    const nows = ['2026-11-02T12:00:00+09:00', '2027-02-10T12:00:00+09:00', '2027-06-20T12:00:00+09:00'];
    const fails = []; let count = 0;
    async function check(card, opts, label) {
      const cv = document.createElement('canvas');
      await C.card.draw(cv, card, TX.card, opts);
      count++;
      const r = C.card.lastCheck;
      if (!r.ok) fails.push({ label, problems: r.problems.slice(0, 3) });
    }
    for (const t of TX.themes) {
      const qs = TX.situations[t.id];
      const combos = qs.length ? qs[0].options.flatMap((o) => qs[1].options.map((o2) => ({ S1: o.id, S2: o2.id }))) : [{}];
      for (const sit of combos) for (let y = 1981; y <= 1989; y++) for (const now of nows) {
        const rep = C.report.build({ nickname: 'あいうえおかきくけこさしすせそたちつてと', birth: { y, m: 5, d: 10, timeKnown: false }, homePref: '北海道', theme: t.id, situation: sit, answers }, TX, new Date(now));
        await check(rep.card, { includeBirth: y % 2 === 0 }, `${t.id}/${sit.S1 || '-'}/${sit.S2 || '-'}/${y}/${now.slice(0, 7)}`);
      }
    }
    // わざと長くした文章
    const rep = C.report.build({ nickname: 'あいうえおかきくけこさしすせそたちつてと', birth: { y: 1983, m: 5, d: 10, timeKnown: false }, homePref: '東京都', theme: 'career', situation: { S1: 'change', S2: 'balance' }, answers }, TX, new Date(nows[0]));
    const long = Object.assign({}, rep.card, {
      guideDesc: rep.card.guideDesc.repeat(3),
      doThere: 'とても長いおすすめの文章を入れて、折り返しと縮小が働くかを確かめるためのテストです',
      caution: 'とても長い注意の文章を入れて、カードの高さが中身に合わせて伸びるかを確かめるためのテストの文章です',
      actions: rep.card.actions.map((a) => a + 'そしてさらに長い文章を足して二行を超えるかどうかを確かめる'),
      goodDirs: [{ id: 'N', name: '北' }, { id: 'NE', name: '北東' }, { id: 'E', name: '東' }, { id: 'SE', name: '南東' }, { id: 'S', name: '南' }],
      color: { name: 'ラベンダーとミントの中間の色', hex: '#B5A8E0' },
      badMore: true
    });
    await check(long, { includeBirth: true }, 'long-text');
    await check(Object.assign({}, long, { goodDirs: [], needle: null }), { includeBirth: false }, 'long-text-no-good');
    return { count, fails };
  });
  await browser.close();
  console.log(`カードを ${result.count} 枚描いて確認しました。はみ出し: ${result.fails.length} 件`);
  if (result.fails.length) { console.error(JSON.stringify(result.fails.slice(0, 5), null, 2)); process.exit(1); }
  if (errors.length) { console.error(errors); process.exit(1); }
})();
