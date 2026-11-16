# 共通Bodyの平面切断

`splitBodyByPlane3(body, plane)` は、所有された共通Bodyを入力平面の負側・正側へ分けます。切断面上の境界を含む正則化材料として `negative` と `positive` を返します。平面は呼出時に有理数でスナップショットし、法線を負にすると両側が交換されます。

```ts
const split = splitBodyByPlane3(body, plane3(1n, 0n, 1n));
const restored = restoreBody3(serializeBody3(split.negative));
const next = splitBodyByPlane3(restored, plane3(0n, 1n, 0n));
const joined = booleanMaterialBodies3(split.negative, split.positive, 'union');
```

## 経路と成立条件

- `representation:'planar'`：有理頂点・直線辺・平面のBody、または所有された平面CellularBody。既存の接触保持切断を使い、子はCellularBodyです。`planar` に元の詳細な切断結果を保持し、`planarBodySplitProvenance3(split.planar)` で由来を取得できます。
- `representation:'surface-material'`：既存の共通材料プログラムへ変換できるBody。完全な親の材料式へ半空間を積として追加し、[厳密な支持形状統合と式の簡約](compact-material-program3.md)を通して各子の有限境界を再計算します。曲面交線と面内トリム、辺の分割とsewing、閉じた幾何的多様体の採用検査は既存の材料境界処理を通します。結果は通常Bodyで、曲面を表示メッシュへ置き換えません。

平面経路の判定は共通Booleanと共有します。平面の支持面だけで判定せず、頂点の有理性と辺の種類も調べます。所有されていないBodyは、判定と演算の前に拒否します。片側が空でも空のBodyを返します。結果は既存の共通保存復元、再切断、Booleanへ渡せます。

曲面経路は平面・円柱および既存の厳密材料プログラムで対応する生成形状に限定されます。材料プログラムへ変換できない形状、未対応の交差、閉じた多様体として認定できない曲面結果はエラーです。平面CellularBodyと同様の一般曲面の接触保持は実装していません。

## 未提供の情報

曲面の両子の切断面・coedgeは、任意の追加解析 [`bodySplitInterface3`](body-split-interface3.md) で共通の有限曲線表へ対応できます。この切断入口自体は親境界の由来表を追加しません。追加解析は面を一対一にせず、異なる分割を持つ面群の境界を対応します。既存の円柱専用切断の詳細メタデータと同じ形式ではありません。`representation` は実行経路の区別であり、切断の有無や接触の種類を分類するフィールドではありません。任意BRep・一般NURBSの切断、永続名、切断メタデータの保存復元は後続です。時間・メモリの固定上限や実用性能は未保証です。
