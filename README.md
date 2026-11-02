# KAKUU LAB / COMPASS

西洋占星術・数秘術・九星気学の基礎データをプログラムで計算し、性格の質問10問と組み合わせて「戦略プロファイリングレポート」を表示する、無料公開用の Web ツールです(KAKUU STUDIO「KAKUU LAB」シリーズ)。

- **静的サイトのみ**(HTML / CSS / JavaScript)。サーバー・外部API・AI API は使いません。
- **入力データは保存・送信しません**(localStorage・cookie・アクセス解析なし。Content-Security-Policy で外部通信も禁止)。
- ライブラリとフォントはリポジトリ内に同梱(`THIRD_PARTY_NOTICES.md`)。

## 公開前の確認
**[docs/REVIEW.md](docs/REVIEW.md)** に、全文章パーツ(ID付き)・サンプルレポート3人分・計算方式・テスト結果・判断した点をまとめています。

## 試験運用(限定公開)中の設定 — 正式公開時に外すもの
今は「URLを知っている人だけが試す」段階のため、検索エンジンに載らない設定を入れています。**正式公開するときは、次の2つを消してください。**

1. `index.html` の上のほうにある次の2行(コメント行と meta タグ)を削除
   ```html
   <!-- 試験運用中のみ: 検索エンジンに載せない設定。正式公開時はこの行を削除(README参照) -->
   <meta name="robots" content="noindex, nofollow">
   ```
2. リポジトリ直下の `robots.txt` を削除

消さずに残すもの:
- `.nojekyll`:GitHub Pages がファイルを加工せず、そのまま配信するための空ファイルです。
- Content-Security-Policy の meta タグ:外部への送信を防ぐための設定です。

> 注意:`noindex` と `robots.txt` は「検索エンジンに載せない」ための設定で、アクセス制限ではありません。URL を知っていれば誰でも開けます。また、`https://studio-kakuu.github.io/kakuu-compass/robots.txt` のようにサイトの下の階層に置いた robots.txt は、検索エンジンの決まり上は読まれません(読まれるのはドメイン直下の robots.txt だけ)。実際に効くのは `index.html` の meta タグのほうです。

## GitHub Pages の設定
- `index.html` はリポジトリ直下にあるので、フォルダは **`/ (root)`** を選びます(`/docs` には REVIEW.md しかありません)。
- CSS・JavaScript・フォント・データはすべて相対パスで読み込むため、`https://studio-kakuu.github.io/kakuu-compass/` のような下の階層でもそのまま動きます。

## フォルダ構成
| 場所 | 中身 |
| --- | --- |
| `index.html` | 画面(入力 → 質問10問 → レポート) |
| `css/` | デザイン(`style.css`)・フォント定義(`fonts.css`) |
| `data/texts.js` | **レポートの文章パーツ・質問文**(文章だけ直すときはここ) |
| `js/core/` | 計算(`astro.js` 西洋占星術 / `numerology.js` 数秘術 / `kyusei.js` 九星気学 / `geo.js` 都道府県と方位 / `bigfive.js` 性格 / `persona.js` 人物像の4軸 / `report.js` レポート組み立て) |
| `js/app.js` | 画面の動き(入力・質問・レポート表示・コピー/共有) |
| `js/card.js` | 共有用カード画像(1080×1920)の描画 |
| `vendor/`, `fonts/` | 同梱ライブラリ・フォント |
| `tests/` | 自動テスト |
| `scripts/build-review.js` | `docs/REVIEW.md` を作るスクリプト |
| `scripts/build-cards.js` / `scripts/samples.js` | サンプルのカード画像を作るスクリプト / サンプル3人分の入力 |

## 手元で動かす
`index.html` をブラウザで直接開くだけで動きます。

## テスト・確認ページの再生成(Node.js 18 以上)
```bash
npm test
```
```bash
npm run review
```

サンプル3人分のカード画像(`docs/cards/`)の再生成(Playwright が必要):
```bash
npm run cards
```
