# Leanによる検証

このディレクトリは、幾何計算の数学的補題と、実装から抽出した一部の式をLean 4で検査します。**TypeScript実行コード全体の形式検証は未完了です。**

## 再現する

Leanは`lean-toolchain`、Mathlibとその依存は`lake-manifest.json`で固定しています。elanをインストールしてから実行してください。検証用依存はnpmパッケージのランタイムに入りません。

```sh
cd formal
MATHLIB_NO_CACHE_ON_UPDATE=1 lake update
lake exe cache get Mathlib.Data.Rat.Lemmas Mathlib.Data.Finset.Sort Mathlib.Tactic.FieldSimp Mathlib.Tactic.Ring Mathlib.Tactic.Linarith Mathlib.Tactic.LinearCombination
cd ..
node formal/scripts/verify.mjs
```

`verify.mjs`はelanの標準インストール先`~/.elan/bin`を子プロセスのPATHに追加します。ソースの棚卸しとハッシュ、式の抽出結果、Leanビルド、各定理の公理依存を確認します。ハッシュ一致そのものは正しさの証明ではなく、レビュー対象の変更を検知するためのものです。

完全検証を要求するゲートは、未検証の義務が残る現在の状態では**終了コード2で失敗**します。

```sh
node formal/scripts/verify.mjs --require-full
```

## ファイルと証明対象

| ファイル | 内容 |
|---|---|
| `Cadloom.lean` | 有理数演算の公式、自然数版Euclidループ、非平行交差の必要十分性、一般の全順序上の区間・隣接辺の定理 |
| `SourceArithmetic.lean` | TypeScriptの構文木から抽出した交点式とLeanモデルとの一致、および非平行分岐の交点の健全性 |
| `Audit.lean` | 公開した各証明の`#print axioms`による依存公理の監査 |
| `verification-status.json` | 検査対象、ソースの基準ハッシュ、未解決の証明義務 |
| `scripts/extract-arithmetic.mjs` | TypeScript ASTから限定された有理数算術式を抽出する、未検証の変換ツール |

## 証明の意味

`nonparallel_intersection_iff`は、**任意の**有理数座標の四端点と点pについて、行列式が非零なら、pが両線分に属することと、計算したt・uが閉区間[0,1]にありpが計算交点に一致することが同値だと示します。有限個の入力に対するテストではありません。

`adjacent_intersection_endpoints`は、任意の全順序と有限頂点集合において、その集合に対する相異なる隣接区間同士は共通端点以外で交差しないことを示します。ただし、具体的な`splitSegments`がその隣接関係を生成することまでをこの定理の結論には含めません。

`gcdLoop_correct`は自然数上でEuclidの反復が停止して最大公約数を返すことを示します。TypeScriptの絶対値化・BigInt剰余・ループの形式意味論との対応は別の義務です。

有理数の加減乗除と正規化の定理は数学的な値の保存を示します。実際のBigIntでの既約表現の維持、パースや例外送出の正しさを証明したものではありません。Leanの有理数の除算は零除算時も全域的に定義されていますが、非平行交点の定理では行列式の非零を明示し、その違いが隠れないようにしています。

## TypeScriptとの対応の限界

抽出器は`intersectSegments`の変数束縛と最後の`point2(...)`を読み、実際の`.add/.sub/.mul/.div`を数学上の有理数演算として解釈します。抽出された式が変わると`--check`が失敗し、再生成した式がモデルと一致しないとLeanの証明も失敗します。

この対応は、抽出器、TypeScriptパーサー、`.add`等のメソッドの意味を信頼しています。`sign()`の分岐、既約表現、Map、配列、ソート、凍結、コンパイル後のJavaScriptを含むプログラムの精緻化証明にはなりません。ソースハッシュを記録しても、この不足は埋まりません。

### 残る証明義務

1. 実際のBigInt表現と数学的有理数のシミュレーション関係。
2. パース、例外、比較とキーの生成の形式意味論。
3. 平行・同一直線・退化を含むTypeScript各分岐と、線分の集合的な共通部分との対応。
4. 全ペアの走査で具体的なMapに完全な分割点集合が入ること。
5. 具体的なソート・辺生成・Map統合で完全な入力元情報と隣接辺が生成されること。
6. TypeScriptから実行するJavaScriptまでの全体の精緻化。

Gillian-JSも検討しましたが、調査時点の公式パーサー`Gillian-JS/JS_Parser/src/OfFlow.ml`はBigIntリテラルに対し`BigInt not part of ES5`として拒否します。このため、既存のES2022実装全体をそのまま検証できると扱っていません。

## 信頼基盤

Leanカーネル、固定したMathlib、Leanの標準公理`propext`・`Classical.choice`・`Quot.sound`、実行環境を信頼します。監査対象の定理がこれ以外の公理（`sorryAx`を含む）に依存した場合は検証スクリプトが失敗します。これは標準公理そのものやLeanカーネルの正しさを証明するものではありません。

参照：[Leanの公式導入手順](https://lean-lang.org/install/manual/)、[Gillianの公式ソース](https://github.com/GillianPlatform/Gillian/blob/master/Gillian-JS/JS_Parser/src/OfFlow.ml)。
