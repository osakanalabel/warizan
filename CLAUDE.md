# CLAUDE.md

小学4年生向け「割り算のひっ算」練習 PWA。

## 大前提

- **ビルドなし・依存ゼロ。** npm install も transpile もしない。外部ライブラリ・CDN・フォント読み込みを追加しない。
- **ES Modules 統一。** ブラウザは `<script type="module">`、Node は `package.json` の `"type": "module"`。
  そのため `file://` では動かない。確認は必ず localhost 経由。
- **メインターゲットは iPhone 12 mini（375 × 812 CSS px）。** ここで崩れない・スクロールせずに使えることを最優先。
  タブレットの縦横にも対応するが、迷ったら 375px 幅を優先する。
- **画面の文字はすべてひらがな**（数字は算用数字）。ユーザー向け文字列に漢字を一切入れない
  （「わられる数」→「わられるかず」、「下に書く」→「したに かく」、「九九」→「くく」）。
  カタカナは外来語だけ（レベル / ヒント / マス / ノーミス / アプリ）。コード内のコメントは日本語の通常表記でよい。
  誤答メッセージは責めない言い方にする（「ちがうよ」ではなく「もう いちど」「〜だよ」）。

## アーキテクチャの鉄則

`src/core/` は**純粋関数のみ**。以下に触れてはいけない。

- `document` / `window` / DOM
- `localStorage`
- `Date.now()` / `Math.random()` の直接呼び出し（乱数は引数 `rng` で注入する）

理由: `node --test` から素のまま import してテストするため。UI 側（`src/ui/`, `src/app.js`）が
core の返すデータを描画するだけの関係を保つ。**筆算の知識を UI に持たせない** —
マスの配置も罫線も `core/steps.js` が返す `layout` から決まる。

```
src/core/problem.js   問題生成・ひっ算のトレース・境界ケース判定
src/core/steps.js     ステップ列とマス配置（layout）の生成
src/core/judge.js     1マスずつの判定、まちがい記録、レベル③の商の修正フロー
src/core/stats.js     成績の集計と壊れたデータの正規化
src/core/rng.js       たね付きの乱数（テストの再現用）
src/storage.js        localStorage の読み書き（core から分離）
src/ui/*.js           描画のみ
src/app.js            画面遷移と進行の司令塔
```

## コマンド

```bash
node --test                    # テスト（これが全件通ることが完了条件）
python -m http.server 8080     # ローカル確認 → http://localhost:8080/
node tools/make-icons.mjs      # アイコン PNG を作り直す（zlib のみ使用）
```

## 触るときの注意

- **`sw.js` を変更したら `CACHE_NAME` のバージョンを上げる。** 上げないと古いファイルが残る。
  ファイルを追加したら `PRECACHE` にも追加する。
- **`src/core/` を変更したら必ず `node --test` を流す。** 受け入れ基準に
  「各レベル1000問の検算」「ステップ列を正解入力で辿ると商とあまりが一致」が入っている。
- 端末キーボードを出さないため、`<input>` / `contenteditable` を使わない。数字入力はアプリ内キーパッドのみ。
- 保存は localStorage だけ。サーバー通信・外部送信を追加しない。

## ドメイン用語（コード内の識別子）

| 語 | 意味 |
|---|---|
| `stage` | 商が1桁立つごとの処理単位。`{col, partial, q, product, rest}` |
| `partial` | その段で割る対象の数（部分被除数） |
| `tateru` / `kakeru` / `hiku` / `orosu` | ステップの種類。この4語以外を増やさない |
| `step.cells` | **入力する順**の配列であって、けた順ではない。2けた以上は くりあがり・くりさがりがあるので**必ず1の位（右）から**。表示位置はマス id の `#<けた>` が決める |
| `needsFix` | 十の位だけで見積もった仮の商が大きすぎて、ひけずに修正が必要な問題 |
| `zeroInQuotient` / `shortLeadDigit` / `noRemainder` | 1回10問に必ず混ぜる境界ケースのタグ |
