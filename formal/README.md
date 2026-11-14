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

`triangle-topology.ts`の共有・接続・リンク・シェル・境界ループはテストと手書きの不変条件で検査します。Mapや探索の形式証明を追加せず、既存の幾何学的Lean補題の保証と区別します。

`CoplanarProjection.lean`では非零の平面係数から省略座標を復元する式が平面を満たすことと一意性を検査します。三角形交差の候補列挙・凸包・全ペア埋め込み検査全体は手書きの証明と比較テストの範囲です。

内外判定のキャッシュに関して、`PlaneGeometry.lean`の`cached_edge_halfplane`は元の外積による辺の判定式と事前計算した一次式の一致を、`ray_parameter_rescale`は非零係数で平面を正規化しても非平行な半直線の交点パラメータが変わらないことを証明します。平面のグループ化・座標範囲による除外・Mapや配列の実行全体を機械検証したものではありません。

`CircleGeometry.lean`は直線を円へ代入した二次式、2円の式の差と根軸上での所属の同値性、有理数の外心の一次方程式を証明します。前3件は一般の可換環上の恒等式であり、実代数的なパラメータにも適用できます。根の分離や交差関数全体のTypeScript実行を機械検証したものではありません。

`CircleGeometry.lean`の`Cadloom.circle_same_x_half_unique`は、同じ円の同じ垂直半面では同じx座標がy座標も一意に定めることを順序体上で証明します。円弧の巡回順序や端点セルの交差アルゴリズム全体の機械検証ではありません。

`Cadloom.canonical_line_frame`は非垂直な有理直線のx座標をパラメータにした標準形が元の直線と一致することを体上で証明します。混合曲線の全ペア分割、値による頂点統合、共有辺・入力方向の復元全体は機械検証していません。

`Cadloom.circle_tangent_cross_linear`は共有点での円の接線の外積が一次式になる恒等式を、`Cadloom.circle_germ_normal_offset`は接触点のまわりの小円との交点の法線方向変位が`rho²/(2*r)`になる関係を証明します。接線・曲率による巡回順序と半辺構築全体を機械検証したものではありません。

円弧を含む面の分類・垂直レイによる位置判定・代数的実数の非負平方根は、[構成の議論と比較テスト](../docs/proofs/curve-faces.md)で検証します。これらのアルゴリズム全体をLeanで機械検証したものではありません。

円弧を含む領域の巻き数伝播・正則化集合演算・境界再構築・塗りつぶし領域の位置判定は、[構成の議論と独立テスト](../docs/proofs/curve-booleans.md)で検証します。アルゴリズム全体のLean検証は主張しません。

`SurfaceGeometry.lean`は円柱の射影式・軸の移動とスケール・直線代入の二次式・法線の直交性と長さの6恒等式を検証します。[対応と制限](../docs/proofs/analytic-surfaces3.md)のとおり、交点列挙やB-rep全体の実行検証ではありません。

3Dの平面座標写像・境界曲線・全曲線の支持面への所属・閉路の接続検査は、[構成の議論と独立テスト](../docs/proofs/brep-curves3.md)で検証します。新しいアルゴリズムの機械検証や、閉路からB-repの面・シェルの妥当性までは主張しません。

空間円について`SurfaceGeometry.lean`に球への直線代入・二平面のGram連立式・円の基底の向きの3恒等式を追加しました。[空間円の構成と検証範囲](../docs/proofs/spatial-circles3.md)のとおり、円弧のセル列挙やTypeScript全体の機械検証ではありません。

B-repの共有辺・コエッジ・面・シェルと頂点リンクの接続検査は、[グラフの不変条件と独立テスト](../docs/proofs/brep-topology3.md)で検証します。閉じた向き付き接続は、面の領域や幾何学的埋め込み、立体としての妥当性の証明ではありません。

`Cadloom.strict_sum_squares_iff`は、非負の長さの厳密な三角不等式と平方値だけの判定の同値性を検証します。円形の穴の包含・分離に用います。[平面の面領域の構成と制限](../docs/proofs/planar-face3.md)のとおり、面構築全体の実行検証ではありません。

`Cadloom.cylinder_tangent_axis_cross`は円柱の円周接線と軸方向の外積が外向き非単位法線になる恒等式を検証します。[円柱面の構成と検証範囲](../docs/proofs/cylinder-face3.md)のとおり、領域構築・二分探索・TypeScript全体の機械検証ではありません。

解析的B-repの垂直押し出しは[直積による埋め込みの構成証明と独立テスト](../docs/proofs/extruded-brep3.md)で検証します。新たな全プログラムの機械検証や、任意のB-repの埋め込み検証は主張しません。既存のスコープ付きLean恒等式を引き続き確認します。
