# KAKUU LAB / COMPASS

西洋占星術・数秘術・九星気学の基礎データをプログラムで計算し、性格の質問10問と組み合わせて「戦略プロファイリングレポート」を表示する、無料公開用の Web ツールです(KAKUU STUDIO「KAKUU LAB」シリーズ)。

- **静的サイトのみ**(HTML / CSS / JavaScript)。サーバー・外部API・AI API は使いません。
- **入力データは保存・送信しません**(localStorage・cookie・アクセス解析なし。Content-Security-Policy で外部通信も禁止)。
- ライブラリとフォントはリポジトリ内に同梱(`THIRD_PARTY_NOTICES.md`)。

## 公開前の確認
**[docs/REVIEW.md](docs/REVIEW.md)** に、全文章パーツ(ID付き)・サンプルレポート3人分・計算方式・テスト結果・判断した点をまとめています。

## フォルダ構成
| 場所 | 中身 |
| --- | --- |
| `index.html` | 画面(入力 → 質問10問 → レポート) |
| `css/` | デザイン(`style.css`)・フォント定義(`fonts.css`) |
| `data/texts.js` | **レポートの文章パーツ・質問文**(文章だけ直すときはここ) |
| `js/core/` | 計算(`astro.js` 西洋占星術 / `numerology.js` 数秘術 / `kyusei.js` 九星気学 / `geo.js` 都道府県と方位 / `bigfive.js` 性格 / `report.js` レポート組み立て) |
| `js/app.js` | 画面の動き |
| `vendor/`, `fonts/` | 同梱ライブラリ・フォント |
| `tests/` | 自動テスト |
| `scripts/build-review.js` | `docs/REVIEW.md` を作るスクリプト |

## 手元で動かす
`index.html` をブラウザで直接開くだけで動きます。

## テスト・確認ページの再生成(Node.js 18 以上)
```bash
npm test
```
```bash
npm run review
```
