# 平面切断の境界の由来

`planarBodySplitProvenance3(split)` は、`splitPlanarBodyByPlane3` が返した所有された結果について、実際の親と子の境界を照合します。コピーした切断オブジェクトは受理しません。必要時だけ計算し、同じ結果には不変の解析結果を再利用します。

```ts
const split = splitPlanarBodyByPlane3(body, plane3(1n, 0n, 0n, '-1/2'));
const origins = planarBodySplitProvenance3(split);
const origin = origins.negative.faces[faceId];
```

`negative` と `positive` はそれぞれ `body` と、子の実際の位相ID順の `faces`・`edges`・`coedges`・`vertices` を持ちます。親IDは `split.parent.topology` のIDです。元の材料生成レシピの多角形番号ではありません。

## 面と有限領域

面は同じ支持平面上の親面との正の面積の交差を `fragments` に保持し、その親面IDを `parentFaces` にまとめます。穴付き・非凸の親面は有理数の厳密な三角形分割を通して照合します。継承面は断片の向きと面積による完全な被覆を検査します。単一の代表点による由来判定ではありません。

`kind:'cut'` は新しい材料内部の切断界面で、親面の正の面積の断片を持ちません。元の空洞の壁が切断平面と一致して残った場合は `kind:'parent'` です。

## 辺とcoedge

辺の `parentEdges` は正の長さを持つ共線重複、`parentFaces` は親の有限面内にある正の長さの区間です。辺のパラメータは実際の `edge.start` から `edge.end` の正規化パラメータ `[0,1]` です。親側の対応も正確な有理数で返し、向きが逆なら `parentStart > parentEnd` になります。

coedgeは辺と別に照合します。`parentCoedges` は親の辺の使用を、その親面と子面の正の面積の断片で制限します。子・親のパラメータはそれぞれcoedgeの `origin` から `target` の `[0,1]` です。`direction` はこの対応の向きです。同じ幾何辺を共有していても、新しいcapに追加したcoedgeには親のcoedgeを割り当てません。

`created` は継承した辺またはcoedgeの区間で覆われない部分です。端点を共有する正の長さの区間として表し、端点単独の所属は頂点情報で扱います。面の分割で新しくできた辺も含むため、切断平面上かどうかを示す `onCutPlane` とは意味が異なります。

## 頂点と保証の範囲

頂点には同座標の全親頂点、点を含む全親辺とそのパラメータ、点を含む全親有限面を返します。辺と面の境界は閉じた集合として判定します。`created` は同座標の親頂点がないことを表します。

これは有理平面Body切断の正の面積・長さの由来解析です。任意の下次元交差点を新しい位相頂点として挿入する処理、永続的な名前、異なる操作間の安定ID、切断メタデータの保存復元、一般曲面への対応は含みません。両子間のcoedgeの一対一対応表も返しません。任意の輸入BRepの認定やTypeScript実行コード全体の形式証明ではありません。解析には追加の時間とメモリが必要です。
