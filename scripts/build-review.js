#!/usr/bin/env node
/*
 * docs/REVIEW.md を生成するスクリプト
 *   npm run review
 * 文章パーツ(data/texts.js)を直したら、これを実行すると REVIEW.md が最新になります。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const texts = require(path.join(ROOT, 'data/texts.js'));
const R = require(path.join(ROOT, 'js/core/report.js'));
const kyusei = require(path.join(ROOT, 'js/core/kyusei.js'));

// サンプルの基準日(固定。実際の画面は「開いた日」が基準日)
const NOW = new Date('2026-11-01T12:00:00+09:00');

const SAMPLES = [
  {
    label: 'サンプル1:1985-02-03・時刻不明(立春の前日生まれ)',
    input: { nickname: 'アオイ', birth: { y: 1985, m: 2, d: 3, timeKnown: false }, birthPref: null, homePref: '大阪府', theme: 'career' },
    answers: [6, 3, 5, 4, 6, 2, 5, 4, 5, 2]
  },
  {
    label: 'サンプル2:1990-07-15 14:30・東京都生まれ',
    input: { nickname: 'ハル', birth: { y: 1990, m: 7, d: 15, hh: 14, mm: 30, timeKnown: true }, birthPref: '東京都', homePref: '東京都', theme: 'relation' },
    answers: [3, 2, 6, 6, 4, 6, 6, 2, 3, 5]
  },
  {
    label: 'サンプル3:2001-12-22・時刻不明(冬至=太陽の星座が変わる日)',
    input: { nickname: 'ミナト', birth: { y: 2001, m: 12, d: 22, timeKnown: false }, birthPref: null, homePref: '福岡県', theme: 'move' },
    answers: [5, 5, 3, 3, 7, 3, 4, 6, 4, 2]
  }
];

function esc(s) { return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' '); }

// ---------- 1. 文章パーツ一覧 ----------
function partsSection() {
  const out = [];
  out.push('## 1. 全文章パーツの一覧');
  out.push('');
  out.push('- 文章はすべて `data/texts.js` にあります。直したいときは **「ID[番号]」** で指定してください(例:「`SIGN-leo[2]` をもっと柔らかく」「`CAU-EL-fire[1]` の3つ目の注意を差し替えて」)。');
  out.push('- `[1]` `[2]` … は同じ内容の言い回し違いです。入力内容から1つが自動で選ばれます(同じ入力なら毎回同じ文)。');
  out.push('- `{name}` などの `{…}` は差し込み文字です(ニックネームや星座名などが入ります)。');
  out.push('');

  out.push('### 1-1. 性格の質問(10問)');
  out.push('');
  out.push('| ID | 因子 | 逆転 | 質問文 |');
  out.push('| --- | --- | --- | --- |');
  const FN = { E: '外向性', A: '協調性', C: '勤勉性', N: '神経症傾向', O: '開放性' };
  texts.questions.forEach((q) => out.push(`| ${q.id} | ${FN[q.factor]} | ${q.reverse ? '逆転' : ''} | ${esc(q.text)} |`));
  out.push('');
  out.push('回答の目盛り(1→7):' + texts.scaleLabels.map((s, i) => `${i + 1}=${s}`).join(' / '));
  out.push('');

  out.push('### 1-2. 見出し・固定の文');
  out.push('');
  out.push('| ID | 文 |');
  out.push('| --- | --- |');
  Object.entries(texts.sectionTitles).forEach(([k, v]) => out.push(`| sectionTitles.${k} | ${esc(v)} |`));
  Object.entries(texts.frameworks).forEach(([k, v]) => out.push(`| frameworks.${k} | ${esc(v)} |`));
  texts.themes.forEach((t) => out.push(`| themes.${t.id} | ${esc(t.name)} |`));
  out.push(`| disclaimer | ${esc(texts.disclaimer)} |`);
  out.push('');

  // カテゴリ順にまとめる
  const cats = [];
  const byCat = {};
  Object.entries(texts.parts).forEach(([id, p]) => {
    if (!byCat[p.cat]) { byCat[p.cat] = []; cats.push(p.cat); }
    byCat[p.cat].push([id, p]);
  });
  let n = 3;
  cats.forEach((cat) => {
    out.push(`### 1-${n++}. ${cat}`);
    out.push('');
    out.push('| ID | 文 |');
    out.push('| --- | --- |');
    byCat[cat].forEach(([id, p]) => {
      if (p.title) out.push(`| ${id}.title | **${esc(p.title)}** |`);
      if (p.kw) out.push(`| ${id}.kw | **${esc(p.kw)}**(キーワード) |`);
      p.v.forEach((s, i) => out.push(`| ${id}[${i + 1}] | ${esc(s)} |`));
      (p.hedge || []).forEach((s, i) => out.push(`| ${id}.hedge[${i + 1}] | リスクヘッジ:${esc(s)} |`));
    });
    out.push('');
  });
  return out.join('\n');
}

// ---------- 2. サンプルレポート ----------
function sampleSection() {
  const out = ['## 2. サンプルレポート(3人分・全文)', ''];
  out.push(`基準日はすべて **${NOW.getFullYear()}年${NOW.getMonth() + 1}月${NOW.getDate()}日(日本時間 正午)** に固定しています。実際の画面では「ページを開いた日」が基準日になります。ニックネーム・現在の都道府県・相談テーマ・質問の回答は、確認用に仮で決めたものです。`);
  out.push('');
  SAMPLES.forEach((s) => {
    const answers = Object.fromEntries(texts.questions.map((q, i) => [q.id, s.answers[i]]));
    const rep = R.build({ ...s.input, answers }, texts, NOW);
    const b = s.input.birth;
    out.push(`### ${s.label}`);
    out.push('');
    out.push('| 入力項目 | 値 |');
    out.push('| --- | --- |');
    out.push(`| ニックネーム | ${s.input.nickname}(仮名) |`);
    out.push(`| 生年月日 | ${b.y}-${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')} |`);
    out.push(`| 出生時刻 | ${b.timeKnown ? `${b.hh}:${String(b.mm).padStart(2, '0')}` : '不明'} |`);
    out.push(`| 出生地 | ${s.input.birthPref || '不明'} |`);
    out.push(`| 現在の都道府県 | ${s.input.homePref} |`);
    out.push(`| 相談テーマ | ${texts.themes.find((t) => t.id === s.input.theme).name} |`);
    out.push(`| 回答(Q1〜Q10) | ${s.answers.join(', ')} |`);
    out.push('');
    out.push('<details open><summary>レポート全文</summary>');
    out.push('');
    out.push(R.toText(rep, true));
    out.push('');
    out.push('**「AIに相談する」ボタンでコピーされる文章の先頭:**');
    out.push('');
    out.push('> ' + rep.aiPrompt);
    out.push('');
    out.push('(この後ろに、上のレポート全文がテキストで続きます)');
    out.push('');
    out.push('</details>');
    out.push('');
    out.push('<details><summary>このレポートで使われた文章パーツID</summary>');
    out.push('');
    out.push(rep.usedParts.map((x) => '`' + x + '`').join(' '));
    out.push('');
    out.push('</details>');
    out.push('');
  });
  return out.join('\n');
}

// ---------- 3. 計算方式・テスト ----------
function runTests() {
  try {
    const res = execFileSync(process.execPath, ['--test', '--test-reporter=tap', ...fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.test.js')).map((f) => path.join(ROOT, 'tests', f))], { encoding: 'utf8' });
    return res;
  } catch (e) {
    return (e.stdout || '') + (e.stderr || '');
  }
}

function testSection() {
  const tap = runTests();
  const lines = tap.split('\n');
  const results = [];
  lines.forEach((l) => {
    const m = /^\s*(ok|not ok) \d+ - (.+)$/.exec(l);
    if (m && !/^\s{4,}/.test(l) && !/\.test\.js$/.test(m[2])) results.push([m[1], m[2]]);
  });
  const pass = (/# pass (\d+)/.exec(tap) || [])[1];
  const fail = (/# fail (\d+)/.exec(tap) || [])[1];
  const out = [];
  out.push(`### 3-6. テスト結果(このファイルの生成時に自動実行)`);
  out.push('');
  out.push(`**合計 ${Number(pass) + Number(fail)} 件中 ${pass} 件成功 / ${fail} 件失敗**(\`npm test\` で誰でも再実行できます)`);
  out.push('');
  out.push('| 結果 | テスト内容 |');
  out.push('| --- | --- |');
  results.forEach(([r, name]) => out.push(`| ${r === 'ok' ? '✅' : '❌'} | ${esc(name)} |`));
  out.push('');
  return out.join('\n');
}

function fmt(d) {
  const j = new Date(d.getTime() + 9 * 3600e3);
  return `${j.getUTCFullYear()}/${j.getUTCMonth() + 1}/${j.getUTCDate()} ${String(j.getUTCHours()).padStart(2, '0')}:${String(j.getUTCMinutes()).padStart(2, '0')}:${String(j.getUTCSeconds()).padStart(2, '0')}`;
}

function methodSection() {
  const risshun = [1985, 2001, 2021, 2024, 2025, 2026, 2027].map((y) => `| ${y} | ${fmt(kyusei.risshun(y))} |`).join('\n');
  return `## 3. 計算方式・採用したルール・出典

### 3-1. 西洋占星術
- **計算方法**:天文計算ライブラリ [astronomy-engine](https://github.com/cosinekitty/astronomy) v2.1.19(MIT License、\`vendor/astronomy-engine/\` に同梱)で、太陽・月・水星・金星・火星・木星・土星の **地心黄経(その日の春分点基準=トロピカル方式)** を計算し、30°ごとに12サインへ割り当てています。
- **時刻**:出生時刻は日本時間(UTC+9)として扱います。
- **時刻不明のとき**:正午(12:00)で計算します。さらにその日の 0:00 と 23:59:59 のサインを比べ、違えば「AまたはB」と両方を表示します(月は約2.5日ごとにサインが変わるため、時刻不明だと「AまたはB」になりやすい天体です)。
- **扱わないもの**:ハウス・ASC(上昇宮)。そのため出生地はサインの計算には使っていません(画面とレポートにはそう明記)。
- **精度の確認**:国立天文台の暦(春分・冬至の時刻)と1分以内で一致すること、日食の瞬間に太陽と月の黄経が一致することをテストで確認しています。

### 3-2. 数秘術(ピタゴラス式)
- **ライフパスナンバー**:生年月日 8桁(YYYYMMDD)の数字を **1桁ずつ全部足し**、2桁以上ならさらに各桁を足す、を繰り返します。**途中または最初の合計が 11・22・33 になったら、そこで止めてマスターナンバー**とします(日本の数秘術の入門書・Webサイトで広く使われている「全桁加算」方式)。
  - 例:1985-02-03 → 1+9+8+5+0+2+0+3 = 28 → 10 → **1** / 2000-01-08 → 11 → **11** / 1990-01-09 → 29 → **11**
- **バースデーナンバー**:生まれた日(1〜31)を各桁足して1桁にします。11日・22日(と、29日→11)はマスターナンバーとして残します。
- 方式はコード(\`js/core/numerology.js\` の冒頭コメント)にも同じ内容を書いています。

### 3-3. 九星気学
- **年の区切り**:立春(太陽黄経 315°)の瞬間。それより前の生まれは前年扱い。
- **月の区切り**:二十四節気の「節」(立春・啓蟄・清明・立夏・芒種・小暑・立秋・白露・寒露・立冬・大雪・小寒)の瞬間。立春〜啓蟄の前を寅月とします。
- **立春・節入りの日時は表を持たず、毎回 astronomy-engine で太陽黄経を計算して求めています**(1900年〜未来まで同じ方法で計算)。
- **本命星**:(11 −(気学上の年 ÷ 9 の余り))÷ 9 の余り。0 は九紫。
- **月命星**:一白・四緑・七赤の年は寅月=八白、三碧・六白・九紫の年は寅月=五黄、二黒・五黄・八白の年は寅月=二黒。以後1か月ごとに1つずつ減ります(九紫の次は八白…一白の次は九紫)。
- **立春・節入りの当日生まれで時刻不明のとき**:節入り「後」として計算し、「節入り前ならこの星」という別の候補をレポートに表示します。
- **方位盤**:後天定位盤(中央に五黄、北に一白…)を基準に、その年・月の中宮の星に合わせてずらします。
- **方位の区切り**:東西南北は各30°、北東・南東・南西・北西は各60°。**真北(地図の北)基準**で、磁北への補正はしていません。
- **凶方位**:五黄殺(五黄のいる方位)、暗剣殺(その反対)、歳破/月破(その年・月の十二支の反対側の方位)、本命殺(本命星のいる方位)、本命的殺(その反対)。五黄や本命星が中宮にあるときは、その凶方位はありません。
- **吉方位**:凶方位を除いた方位のうち、そこにいる星の五行が本命星と「相生」または「比和」の方位。本命星を生む星(例:一白水星にとっての六白・七赤=金)の方位を「最大吉方」と表示します。五黄土星のいる方位と本命星自身のいる方位は吉にしません。
- **地域例**:現在の都道府県の県庁所在地から、ほかの46都道府県の県庁所在地への方位角(大圏コース)と距離を計算して、8方位に振り分けています(座標は \`js/core/geo.js\` に同梱した、都道府県庁所在地のおおよその経緯度。国土地理院などが公開している値を参考にした概略値で、8方位の判定には十分な精度です)。距離は 100km 未満=近場、400km 未満=中距離、それ以上=遠方。
- **注意テーマ**:今年・今月の盤の中心の星の五行と本命星の五行の関係(相生・比和・相剋など)と、中心の星の五行に応じた生活の注意(木・火・土・金・水)を表示します。
- **季節フェーズ**:本命星が年盤・月盤のどの宮にあるかで判定します(本サービス独自の割り当て)。

| 宮(方位) | フェーズ |
| --- | --- |
| 坤宮(南西)・震宮(東) | 種まき(春) |
| 巽宮(南東)・中宮(中央) | 拡大(夏) |
| 乾宮(北西)・兌宮(西)・離宮(南) | 収穫(秋) |
| 艮宮(北東)・坎宮(北) | 整備(冬) |

  さらに「今年×2+今月」の点数(種まき1・拡大2・収穫1・整備0)で、今の戦略を「攻め(4以上)」「中間(2〜3)」「整える(0〜1)」に分けています。本命星が年盤の中宮(八方塞がり)にある年は、「攻め」にならないよう「中間」までに抑えています。

### 3-4. 性格の自己チェック(Big Five・簡易版)
- **TIPI-J(日本語版 Ten Item Personality Inventory)は使っていません。** 小塩・阿部・カトローニ(2012)『パーソナリティ研究』21巻1号で発表された尺度で、論文はJ-STAGEで無料公開されています。ただし、論文が無料で読めることと、尺度を無料公開のWebツールで使ってよいことは別の話です。公開情報を調べても、**無料公開のWebツールでの利用を許可する明確な記載は見つかりませんでした**(英語版TIPIのGosling研究室のページも作業環境から確認できませんでした)。指示に従い、**KAKUU LABオリジナルの10問**を作り、画面・レポートに「簡易版の自己チェック(学術的な検査ではない)」と明記しています。
- 各因子2問(1問は逆転項目)、7段階。因子の値 =(順項目 +(8 − 逆転項目))÷ 2(1.0〜7.0)。3.5未満=低め、3.5〜4.5=中くらい、4.5超=高め。
- 判断の罠(認知バイアス)は、5因子の高低・相談テーマ・今の戦略から点数をつけて上位2つを選び、最後に必ず「バーナム効果」を加えています。

### 3-5. 出典・確認に使った資料
| 内容 | 出典 | 使い方 |
| --- | --- | --- |
| 立春・節気・春分・冬至の日時 | 国立天文台 暦計算室「暦要項」(各年の二十四節気の日時、分単位) | テストで、計算結果を四捨五入した分の値が一致することを確認 |
| 日食の時刻 | NASA Eclipse Web Site(2024年4月8日の皆既日食。新月の時刻 18:21 UTC) | 月の位置が正しいかの確認 |
| 惑星の星座の滞在期間 | 一般に公開されている天文暦(エフェメリス)の各惑星のサイン入りの日付 | 滞在期間の真ん中の日で星座を確認 |
| 九星の年盤・月盤 | 市販の九星暦(高島暦など)で一般的な、本命星・月命星の早見表と同じ規則 | 2026年=一白中宮、1985年=六白 などの値をテストで確認 |
| 数秘術 | 日本で一般的な「全桁加算・11/22/33 を残す」方式 | 境界ケース(最初の合計が11/22/33、途中で11)をテスト |
| TIPI-J | 小塩真司・阿部晋吾・カトローニ ピノ(2012)「日本語版Ten Item Personality Inventory(TIPI-J)作成の試み」パーソナリティ研究 21(1), 40–52 | 利用条件を確認できなかったため不採用 |

astronomy-engine で計算した立春の日時(日本時間、秒まで):

| 年 | 立春 |
| --- | --- |
${risshun}

国立天文台の発表(分単位)は、1985年 6:12、2021年 23:59、2024年 17:27、2025年 23:10、2026年 5:02 で、四捨五入するとすべて一致します。

> ※作業環境のネットワーク制限のため、国立天文台・NASA・国土地理院のページを開いて1件ずつ照合する作業はできていません。表の値は広く公表されている数値をもとにしています。公開前に、上の立春の日時を国立天文台「暦要項」で数件だけ見比べていただくと安心です。
`;
}

function decisionsSection() {
  return `## 4. 判断に迷った点と、こちらで決めた内容

| # | 迷った点 | 決めた内容 | 変更したいとき |
| --- | --- | --- | --- |
| 1 | TIPI-J を使えるか | 無料公開ツールでの利用条件を確認できなかったため **不採用**。オリジナル10問+「簡易版の自己チェック(学術的な検査ではない)」と明記 | 開発者(小塩真司先生)の許可が取れたら、質問文を差し替え可能(\`data/texts.js\` の questions) |
| 2 | マスターナンバーの扱い | 「全桁加算」で、最初または途中の合計が11・22・33なら残す方式 | 「年・月・日を別々に足す」方式などに変更可能 |
| 3 | 時刻不明の人が立春・節入りの当日生まれ | 節入り「後」として計算し、「節入り前なら〇〇」と別の候補を表示 | 「前」扱いにすることも可能 |
| 4 | 時刻不明時の基準時刻 | 正午(12:00)。その日のうちにサインが変わる天体は全部「AまたはB」表示(月以外も対象) | — |
| 5 | 日本の夏時間(1948〜1951年) | 考慮せず、すべて UTC+9 として計算 | 必要なら補正を追加可能 |
| 6 | 方位の基準 | 真北(地図の北)。東西南北30°・四隅60° | 磁北(西偏約7°)や、全方位45°区分に変更可能 |
| 7 | 歳破・月破の範囲 | 十二支の方位を含む「宮」全体(例:丑・寅はどちらも北東)で表示 | 15°単位の細かい表示に変更可能 |
| 8 | 吉方位の判定 | 凶方位を除き、本命星と相生・比和の星がいる方位を吉、本命星を生む星の方位を「最大吉方」。月命星との組み合わせ(同会・傾斜など)は使っていない | 月命星も加味する流派に変更可能 |
| 9 | 季節フェーズの割り当て | 本命星の宮で決める(坤・震=春/巽・中=夏/乾・兌・離=秋/艮・坎=冬)。流派によって離宮を「頂点」とする考えもあるため、ここは本サービス独自 | 割り当て表を変えるだけで修正可能 |
| 10 | 中宮(八方塞がり)の年の扱い | 「拡大(夏)」フェーズだが、戦略は「攻め」にせず「中間」までに抑え、方位・注意テーマで説明を追加 | — |
| 11 | 地域例の代表地点 | 都道府県庁所在地。東京都から大阪府は方位角 約255°で、南西と西の境目(南西側)に入る | 主要都市を追加するなども可能 |
| 12 | 注意テーマの選び方 | 盤の中心の星の五行で「生活の注意」を出し、本命星との五行の関係を添える(健康・事故などの予言はしない) | — |
| 13 | 文章データの形式 | ブラウザでファイルを直接開いても動くよう、JSON に近い書き方の \`data/texts.js\` にした(サーバー不要) | — |
| 14 | 外部への送信防止 | Content-Security-Policy で外部通信と外部ファイル読み込みをブラウザ側で禁止。localStorage・cookie・アクセス解析は不使用 | — |
| 15 | 「AIに相談する」ボタン | 相談用の文章+レポート全文をコピーするだけ。どのAIにも送信しない | 文面は \`AI-PROMPT\` で修正可能 |
| 16 | 生年月日の範囲 | 1900年1月1日〜今日 | — |
| 17 | 禁止表現のチェック | 「病気・ケガ・事故・死・必ず・絶対に・確実に・運命」が文章に入っていないことを自動テストで確認 | 単語の追加可能(\`tests/report.test.js\`) |
`;
}

const md = [
  '# COMPASS 公開前の確認ページ(REVIEW)',
  '',
  '> このファイルは `npm run review` で自動生成しています。文章を直すときは `data/texts.js` を直し、もう一度生成してください。',
  '',
  '## 目次',
  '1. [全文章パーツの一覧](#1-全文章パーツの一覧)',
  '2. [サンプルレポート(3人分・全文)](#2-サンプルレポート3人分全文)',
  '3. [計算方式・採用したルール・出典](#3-計算方式採用したルール出典)',
  '4. [判断に迷った点と、こちらで決めた内容](#4-判断に迷った点とこちらで決めた内容)',
  '',
  partsSection(),
  sampleSection(),
  methodSection(),
  testSection(),
  decisionsSection()
].join('\n');

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs/REVIEW.md'), md);
console.log('docs/REVIEW.md を生成しました(' + md.length + ' 文字)');
