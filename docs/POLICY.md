# cadloom 方針

## 1. 目的と範囲

cadloomは、[SolidCraft](https://github.com/tangency-labs/solidcraft)（Rust、MIT OR Apache-2.0）の**CADカーネル部分**を、ピュアTypeScriptでゼロから再実装するプロジェクトです。参照するupstreamのコミットは`41ee3e5`（2026-11-17）です。

SolidCraftのカーネルは`solidcore/`です。solidcoreはNVIDIA USD BRepのSMLib・SM_APIをRustへ移植し、独自に発展させたものです（Apache-2.0）。cadloomの範囲は、upstreamの`solidcore/docs/layers.md`が定めるsolidcoreのレイヤーに限ります。

| upstreamのレイヤー | 役割 | cadloom |
|---|---|---|
| `solidcore`（kernel） | 構築・評価・計測・交差・フィットなど、すべての幾何計算 | **範囲内**（中心） |
| `solidcore-record` | データとしての幾何。構造検証、中立STEPモデル | **範囲内** |
| `solidcore-convert` | recordとkernelの相互変換 | **範囲内** |
| `solidcore-ops` | モデリング操作API（kernel呼び出しの手順） | **範囲内** |
| `solidcore-tess` | 表示用メッシュ化 | **範囲内** |
| STEPの入出力 | 中立形式の交換 | **範囲内**（後期） |
| SolidCraftのアプリ層（`doc`、`engine`、`ui-*`、`render`、`gpu`、`mcp`、`viewport*`、`dynamics`、プラグイン、ブランド資産） | 文書・履歴・UI・描画・AI連携 | **範囲外** |
| `crates/sketch`の拘束ソルバー | アプリ層のスケッチ | **範囲外**（カーネルにはプロファイル入力だけを持たせる） |

アプリ層とブランド・インターフェース資産（`LICENSE-BRAND`）は移植しません。

## 2. 「ゼロベース」の意味

- 以前のcadloom（有理数による2D線分アレンジメントと押し出し）は引き継ぎません。git履歴にだけ残します。
- upstreamのRustコードを機械的に翻訳しません。モジュール境界・不変条件・アルゴリズムを読み、TypeScriptらしい形で書き直します。参照したupstreamのファイルは各モジュールの冒頭コメントに記録します（帰属表示はApache-2.0とMITの要件に従います）。
- 実行時の依存はゼロです。WASM・ネイティブアドオン・外部ライブラリは使いません。開発時の依存はTypeScriptとNodeの型定義だけです。

## 3. 設計原則（upstreamから継承）

1. **グローバル状態なし。** 許容誤差などは`Kernel`値に持たせ、操作に渡します。
2. **アリーナ型のトポロジー。** `Brep`はフラットな配列で、要素を型付きID（数値インデックス）で参照します。ポインター参照は使いません。
3. **エラーは値。** 入力に由来する失敗では例外を投げず、`Result<T>`を返します。例外を使うのはプログラミングエラー（不変条件違反）だけです。
4. **決定性。** 時計・`Math.random`・挿入順に依存しない反復を使いません。乱数が必要なときは`Kernel`の種付き乱数を使います。
5. **一つの仕事は一つの場所で。** 幾何量はkernelでだけ計算します。opsは手順を組み立てるだけで、内積も計算しません。
6. **イミュータブル。** 公開する値は`readonly`型で、構築後は凍結します。

## 4. 数値方針

- 一般の幾何（NURBS、曲面、交差）は`number`（IEEE倍精度）と、upstreamと同じ許容誤差（`zone = 1e-5`）で計算します。
- 位相を決める判定（向き、内外、交差の有無）は、可能な限り**厳密な述語**で判定します。有限の倍精度値はすべて二進有理数なので、`bigint`で厳密に評価できます。
- 浮動小数点による近似値と、厳密値に対する主張とを、型と文書で区別します。

## 5. Leanによる証明の方針

- `formal/`はcore Lean 4（`v4.24.0`）だけで検査します。**Mathlibには依存しません。**使うのは`Rat`・`Int`・`Nat`・`List`と`grind`・`omega`です。ビルドは数秒で終わり、再現性があります。
- 証明の対象は、各アルゴリズムの**有理数上の数学モデル**です。TypeScriptの実行コードそのもの（倍精度の丸め、配列、例外）は証明しません。この境界はモジュールごとの文書に明記します。
- 証明する性質は、実装の正しさの核になるものです。例として、de Boorの点は制御点の凸結合であること（単位の分割）、ノット挿入で曲線が変わらないこと、Euler–Poincaréの関係、発散定理による体積公式、厳密な述語の符号の性質があります。
- `npm run prove`（`formal/scripts/verify.mjs`）で次を確認します。
  - `sorry`・`admit`・`axiom`・`native_decide`・`extern`を使っていないこと
  - `lake build`が成功すること
  - 全定理の`#print axioms`が標準公理（`propext`、`Classical.choice`、`Quot.sound`）だけであること
- TypeScriptのテストは、各Lean定理に対応する性質を実装でも確認します（同じ名前で対応づけます）。

## 6. 進め方（dynamic workflow）

各マイルストーンを、次の段階からなるワークフローで進めます。

1. **調査**：対応するupstreamのモジュールを読み、不変条件とAPIを整理する
2. **並列実装**：ファイルが重ならない単位で、TypeScript・テスト・Leanモデルを同時に書く
3. **統合**：`npm run check`（型検査、テスト、Lean）が通るまで修正する
4. **敵対的レビュー**：Leanの定理が実装の主張と本当に対応しているか、テストが自明すぎないかを、独立したエージェントが反証を試みて確認する

マイルストーンは[ROADMAP.md](ROADMAP.md)にまとめています。

## 7. 品質ゲート

`npm run check`がマージの条件です。内容は`tsc`（strict、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`）、`node --test`、`npm run prove`です。
