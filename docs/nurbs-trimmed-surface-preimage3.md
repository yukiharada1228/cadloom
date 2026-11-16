# トリム領域へ制限したNURBS曲面の点の逆像

`trimNurbsSurfacePointPreimages3(source, domain)` は、所有された全逆像の計算結果をトリム領域へ制限します。`nurbsTrimmedSurfacePointPreimages3(surface, domain, point)` は、全逆像を計算してから同じ処理を行う入口です。

```ts
const source = nurbsSurfacePointPreimages3(surface, target);
const inverse = trimNurbsSurfacePointPreimages3(source, domain);
const belongsToTrimmedImage = !inverse.empty;
```

domainは境界曲線・穴・向きから再検査し、独自のlocate/sampleを信用しません。sourceは元の所有された結果であることを要求します。幾何や根をラベルだけで採用しません。

## 選択した逆像だけを処理する

有限点はパラメータ領域への所属で絞り込みます。共有多項式の候補グラフには共役座標へ写る枝もありますが、sourceの選択済み頂点・辺だけを処理します。捨てた共役成分がトリム内にあっても、指定点の逆像へ加えません。

選択済みの逆像の辺は、元の代数曲線とトリム境界の有理NURBS spanを正確に交差させ、全境界イベントで分けます。これは平面断面のarc分割と同じ内部のパラメータ空間処理です。境界区間の一致、穴、孤立した接触を保持し、外側だけを除きます。既存の個別arc APIと全断面APIも同じ処理へ接続しています。

## パッチと由来

patchesは非空の逆像を持つ一側パッチだけを保持し、`sourcePatch` はsource.patches内の番号です。これは元曲面のuSpan番号ではありません。異なるパラメータや一側パッチを空間点の一致だけで共有しません。

- `vertices` は(u,v)、実際に写した空間point、トリム領域に対するinside/boundary、およびsourcePoints・sourceVertices・sourceEdgesを持ちます。sourcePointsは元の有限解の番号、sourceVerticesは元locusの選択済みraw頂点ID、sourceEdgesは元の選択済みlocusEdges配列内の順番です。
- `edges` は新しい頂点表へのfrom/to、元の選択済み辺の順番sourceEdge、昇順の有限lower/upper、開内部のlocationです。これらは**パラメータ空間の逆像の枝で、空間曲線ではありません**。全点が同じ対象点へ写ります。
- `region` は、元のwholePatchと閉トリム領域の共通部分の暗黙表現です。非空の正確なwitnessと、当該パッチ矩形との共通部分に対するlocateを返します。穴、複数成分、角や線だけの接触もあり得るため、正の面積や連結性は宣言しません。

新しい境界イベントが両側の外側片にはさまれる場合も、孤立したboundary頂点は残します。保持した辺の閉端点が領域外なら不整合として拒否します。元のsourceは変更しません。

## 評価

`trimmedNurbsSurfacePreimageEdgePoint3(report, patchIndex, edgeIndex, parameter)` は、結果のpatchesとedges内の番号を受け取り、元のuまたはvで評価します。切り出した範囲外は拒否します。

`trimmedNurbsSurfacePreimagePatchPoint3(report, patchIndex, u, v)` はregionがあり、その閉領域へ入る点だけを受理します。両評価は所有されたreportだけを受理し、元の逆像評価へ戻して、実際の空間点が対象点に一致することも確認します。

## 範囲

emptyは、元の閉じた一側パッチ群をトリムした像に対象点が存在しないことを表します。locationはパラメータ上の分類で、空間像の内外や境界を認定するものではありません。region.locateは当該閉パッチ矩形との共通部分であり、隣接パッチを合わせた全体の分類ではありません。

単射・正則性・空間埋め込み、節点をまたぐ全逆像位相、一般NURBS BRep・Bodyの認定、保存交換レコードは未実装です。速度・メモリの上限も未保証です。
