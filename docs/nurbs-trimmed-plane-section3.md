# トリム付きNURBS曲面全体の平面断面

`intersectTrimmedNurbsSurfacePlane3(surface, domain, plane)` は、全パッチの平面交差とパラメータ境界の接続を計算し、検査済みのトリム領域へ制限します。戻り値は曲線グラフ・孤立した点・平面含有パッチの閉じた領域の和集合として断面を保持します。一般のNURBS Body認定ではありません。

```ts
const section = intersectTrimmedNurbsSurfacePlane3(surface, domain, plane);
const point = trimmedNurbsSectionEdgePoint3(section, edgeId, sourceParameter);
const regionPoint = trimmedNurbsSectionAreaPoint3(section, areaId, u, v);
```

入力domainは境界曲線・穴・向きから一度再検査します。偽のlocate/sampleは信用しません。内部の一括処理だけが、この既に検査した同じ領域を各有限枝で再利用します。個別の公開arc分割APIは従来どおり入力を再検査します。

## 曲線と孤立点

元の `source` は既存のパッチ境界接続後のsection complexです。同じ(u,v)かつ同じ空間点の場合だけ頂点を共有します。同じパラメータでも不連続パッチの別の空間像は共有せず、異なるパラメータの空間自己重複も共有しません。

元グラフの全辺を有限arcへ変換して、[トリム領域で完全分割](nurbs-section-arc-domain3.md)します。外側の開片を除き、内側・境界上の片を `edges` へ保持します。元の孤立接触点と、新しいトリム境界との孤立接触も `vertices` へ残します。保持した閉端点が領域外であれば不整合としてエラーにします。

- `vertices` は(u,v)、空間point、トリム領域に対するlocation、および元complexの `sourceVertices`・`sourceEdges` IDを持ちます。
- `edges` は頂点表への `from`・`to`、所有された有限 `arc`、元complexの `sourceEdge` ID、開内部のlocationを持ちます。パラメータは元のu/v座標です。
- 元complexのedge.usesから、同じ境界を使う全パッチ・枝へ戻れます。代表するarcが1つでも、その由来を失いません。
- `curveComponents` はこの頂点・辺グラフだけの連結成分です。領域を介した接続や空間の自己重複を含む断面全体の連結成分ではありません。

所有されたsectionだけが辺・領域評価APIで使えます。コピーした結果、不正なID、保持範囲外のパラメータは拒否します。

## 平面に含まれるパッチ

元から平面上にあるパッチは曲線へ変換せず、`areas` に `domain ∩ closed patch rectangle` として保持します。各項は `sourceArea`、元のpatch、非空の正確なwitnessと空間point、パラメータ領域に対するlocateを持ちます。元complexの含有パッチIDとの対応はsourceAreaです。

非空性は、トリム領域の正しい内点、矩形の4角、境界NURBS spanの両端、および全矩形辺との正確な交点を候補として検査します。単なる内点1つだけの包含判定ではありません。境界が交わらなければ一方が他方へ含まれる場合の候補があり、交わる場合は境界イベントが候補になります。矩形辺上に重なるspanは、端点またはもう一方の座標の境界イベントで検査します。穴に全て隠れる矩形は非空としません。

areasは正の面積や連結性を意味しません。トリム後に角1点、辺の一部、複数の成分だけが残る場合も、その閉じた共通部分を暗黙表現で保持します。元曲面のランク低下で空間像の次元が落ちる可能性もあります。含有パッチの切り出した境界の全列挙や、その内部の連結成分分解は行いません。

`area.locate` は当該パッチ矩形との共通部分に対するパラメータ空間の分類です。複数の隣接するareaを合わせた領域の分類ではありません。areaに含まれる曲線グラフ部分が重複して表現される場合もあり、全体の集合はその和集合です。

## 範囲

パッチ境界のパラメータ対応に基づく断面であり、空間像の埋め込み、一般BRepの採用、NURBS Bodyの切断、一般2曲面交差、含有領域全体の位相・境界の明示化は残ります。トリム領域が曲面の有効範囲外へ広がっていても、計算・評価するのは有効パッチ・有効arcとの共通部分だけです。速度・メモリの上限は未保証です。
