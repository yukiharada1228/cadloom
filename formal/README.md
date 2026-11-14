# 重要な幾何処理のLean検証

CADカーネルの土台となる数学的モデルをLean 4で検査します。対象は厳密演算、線分交差、線分分割です。**TypeScript実行コード全体の形式検証ではありません。** 全体実行検証のためのMap・配列・ヒープ・型消去などのモデルは削除しました。

## 実行方法

Leanは`lean-toolchain`、Mathlibと依存は`lake-manifest.json`で固定しています。elanとMathlibの依存を準備してから実行します。

```sh
cd formal
MATHLIB_NO_CACHE_ON_UPDATE=1 lake update
lake exe cache get Mathlib.Data.Rat.Lemmas Mathlib.Data.Finset.Sort Mathlib.Tactic.FieldSimp Mathlib.Tactic.Ring Mathlib.Tactic.Linarith Mathlib.Tactic.LinearCombination
cd ..
node formal/scripts/verify.mjs
```

既定のコマンドは、この文書の範囲の証明を検査し、成功時に終了コード0を返します。従来の`--partial`も同じ動作です。`--require-full`は、全体実行検証を提供していないため終了コード2を返します。

## 残す証明

| ファイル | 対象 |
|---|---|
| `Cadloom.lean` | 有理数演算の公式、自然数上のEuclid法、非平行交差の必要十分性、区間・隣接辺 |
| `SegmentMembership.lean` | 座標・辞書順による所属判定と、パラメーターによる線分定義の同値性 |
| `SourceArithmetic.lean` | TypeScriptから抽出した交点の算術式と数学モデルとの一致 |
| `IntersectionBranches.lean` | 退化・非平行・平行非同一直線の交差モデル |
| `CollinearOverlap.lean` | 同一直線の重複を含む全交差分岐の集合的な正しさ |
| `PairLoop.lean` | 全線分ペアから集める分割点の数学的モデルと健全性 |
| `CutCompleteness.lean` | 各線分上の分割対象頂点を取りこぼさないこと |
| `SortedAdjacency.lean` | 隣接辺の健全性・被覆、内部頂点の不在、入力元との対応 |

`FaceSampling.lean`では面の所属判定用の左側標本点と正の刻み幅の縮小に関する算術補題も検査します。面の包含・位相全体は機械検証の対象外です。

`Audit.lean`で登録定理の依存公理を監査し、`verification-status.json`に対象を記録します。定理は任意の有理数入力に関するもので、有限のテスト結果ではありません。

## 保証の境界

証明対象は数学的モデルです。実際のTypeScriptのパース、BigInt、例外、Map、配列、ソート、凍結、コンパイル・実行環境の動作を証明するものではありません。これらの実装は通常のテストで検査します。

`scripts/extract-arithmetic.mjs`は選択したTypeScript ASTの算術式を数学的有理数演算として解釈する未検証の抽出器です。`--check`で抽出結果の変更を検知しますが、パーサー・抽出器やRationalメソッドとの意味的対応は信頼します。

検証スクリプトはソース一覧・SHA-256、TypeScriptのビルド、式の抽出結果、Leanビルド、公理依存を確認します。ハッシュはレビュー基準の変更検知であり、実装の正しさの証明ではありません。ソース変更時には対応をレビューして基準を更新してください。

Leanカーネル、固定したMathlib、標準公理`propext`・`Classical.choice`・`Quot.sound`を信頼します。監査対象が` sorryAx `など許可外の公理に依存した場合は失敗します。

`AffineGeometry.lean`では有理数アフィン変換による外積の倍率、線形補間との可換性、非特異変換の逆写像と線分所属の同値性を検査します。TypeScriptとの全体精緻化や平面位相全体は対象外です。

`PrismVolume.lean`では三角柱の外向き8三角形の行列式寄与の和と底面積×高さの公式を検査します。メッシュ生成・接続検査全体の精緻化とは区別します。

`PlaneGeometry.lean`では有理数3D平面の評価、3点からの平面と向き判定の一致、線形補間、非平行交点パラメーターの一意性、線分と平面の交差存在条件を検査します。退化・平行・同一平面を数学的場合分けに含めます。TypeScriptの実行全体の証明ではありません。

`TriangleGeometry.lean`では重心座標での平面評価、頂点での評価範囲が三角形内部へ保存されること、四角形の扇状分割による面積ベクトル保存を検査します。切断ループ・配列や共有位相構造の完全性は対象外です。
