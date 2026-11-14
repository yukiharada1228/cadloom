# cadloom

ピュアTypeScriptのCADカーネルに向けた最初の基盤です。現在は **有理数による2D線分交差・領域の集合演算・三角形分割と、平面領域の3D押し出し** を実装しています。完全なCADカーネルや商用CADファイルのインポーターではありません。

このREADMEはソース版のAPIを対象とし、公開済みnpmパッケージに未収録の機能を含みます。

## 実行

Node.js 24以上を使用します。

```sh
npm ci
npm test
npm run typecheck
npm run example
```

`npm test`はビルド後にテストを実行します。`npm run example`は、入力と厳密な結果を`artifacts/intersection.json`に、表示用のSVGを`artifacts/intersection.svg`に保存します。実行時の外部ライブラリ・WASM・ネイティブアドオンはありません。TypeScriptとNodeの型定義は開発用依存です。

## インストール

```sh
npm install cadloom
```

ES ModulesとBigIntを利用します。Node.jsは24以上をサポートします。

## API

```ts
import { point2, segment2, intersectSegments } from 'cadloom';

const a = segment2(point2('0', '0'), point2('1', '1'));
const b = segment2(point2('0', '1'), point2('2', '0'));
const result = intersectSegments(a, b);
// { kind: 'point', point: { x: Rational(2/3), y: Rational(2/3) } }
console.log(JSON.stringify(result));
// {"kind":"point","point":{"x":"2/3","y":"2/3"}}
```

座標は`bigint`、`Rational`、正確な文字列を受け取ります。`number`は型と実行時の両方で拒否します。文字列は整数、小数（例`'-0.125'`）、整数の分数（例`'2/3'`）に対応します。指数表記、`.5`、非有限値は受け付けません。

`Rational`は約分済み・正の分母・不変の値です。`add`、`sub`、`mul`、`div`、`neg`、`sign`、`compare`、`equals`を提供します。分母ゼロとゼロ除算は`RangeError`です。

`orient2d(a,b,c)`は反時計回りなら`1`、時計回りなら`-1`、同一直線なら`0`を返します。

`intersectSegments(a,b)`は次のいずれかを返します。

- `{ kind: 'none' }`
- `{ kind: 'point', point }`
- `{ kind: 'overlap', segment }`

線分は両端を含みます。長さゼロの線分は点として扱います。重複区間の端点はx、次いでyの辞書順で正規化されるため、入力の順序や向きを変えても同じ結果になります。`pointOnSegment`も同じ閉線分の意味を持ちます。

## 線分群の分割（開発版）

`splitSegments`は入力端点、交点、重複区間の端点ですべての線分を分割し、同一座標の頂点と同一の辺を統合します。このAPIは次回リリース向けの開発版で、npmの`0.1.0`には含まれません。

```ts
import { point2, segment2, splitSegments } from 'cadloom';

const result = splitSegments([
  segment2(point2('-1', '0'), point2('1', '0')),
  segment2(point2('0', '-1'), point2('0', '1')),
]);
// result.vertices.length === 5
// result.edges.length === 4
// 中央の頂点: { point: (0,0), sources: [0,1] }
```

- `vertices`：`{ point, sources }`の配列。座標のx、次いでyの厳密な辞書順です。
- `edges`：`{ start, end, sources }`の配列。`start`と`end`は`vertices`へのインデックスで、`start < end`です。配列全体も`start`、次いで`end`で整列します。
- `sources`：入力線分配列の0始まりのインデックス。頂点ではその点を含む全入力、辺ではその辺全体を覆う全入力を、重複なし・昇順で記録します。
- 同じ入力集合を並べ替えたり端点を反転しても、頂点・辺の座標とインデックスは変わりません。`sources`は新しい入力順序に対応して変わります。
- 長さゼロの入力は頂点として保持し、その点を通る線分も分割します。長さゼロの辺は生成しません。
- 出力の辺同士は共有端点以外では交差・重複せず、出力頂点が辺の内部に残ることもありません。
- 出力は深くfreezeされ、入力オブジェクトから独立しています。面・半稜線・接続順序の情報はまだ生成しません。

総当たりで全線分ペアを調べます。入力数をn、辺を切る点の総数をkとすると、ペア検査はO(n²)、点の整列はO(k log k)以内、作業メモリはO(n+k)です。BigIntのビット長による演算コストは別途増大します。大規模データ向けの高速化は未実装です。

ソースをビルド後、図とJSONを生成できます。

```sh
npm run build
node examples/arrangement-to-svg.ts
```

`artifacts/arrangement.json`に正確な入力・結果を、`artifacts/arrangement.svg`に頂点・辺の番号付きの図を保存します。保存したJSONまたは`{ "segments": [[["0","0"],["1","1"]]] }`形式のファイルを再実行できます。

```sh
node examples/arrangement-to-svg.ts artifacts/arrangement.json artifacts/arrangement-replay
```

## 保存した入力の再実行

次のJSONを`case.json`に保存します。JSON数値ではなく文字列を使います。

```json
{
  "a": [["0", "0"], ["1", "1"]],
  "b": [["0", "1"], ["2", "0"]]
}
```

```sh
npm run example -- case.json artifacts/replay
```

保存された診断ファイル自体も再実行できます。

```sh
npm run example -- artifacts/intersection.json artifacts/replay
```

## 正しさの範囲

有理数演算、二線分交差、線分群分割について、前提・形式仕様・不変条件を明示した[正当性証明](docs/proofs/segment-arrangement.md)を用意しています。これは手書きの演繹証明であり、証明支援系による機械検証やTypeScript実行コードの形式検証ではありません。

別途、[Leanによる機械検証](formal/README.md)を追加しました。有理数演算の公式、退化・平行を含む線分交差、分割点の完全性と隣接辺、およびTypeScriptから抽出した交点式を検査します。検証対象は重要な数学的モデルに限定し、**TypeScript実行コード全体の形式検証は行っていません**。

カーネルの演算に浮動小数点やepsilonは使いません。有限の有理数入力に対して、有理数の四則演算で交差を計算します。SVGへの投影だけを近似し、結果の計算には戻しません。極端な縮尺ではSVG上で異なる点が重なる可能性があり、JSONが正確な結果です。

テストは境界事例、独立したBigInt判定との全組合せ照合、入力交換・反転、平行移動・正負の拡大縮小、交点の所属を検査します。これらは数学的な形式証明ではありません。入力サイズが非常に大きい場合にはBigIntの時間・メモリ制限があります。

## 次の段階

1. 平面上の接続順序・半稜線構造と領域の復元。
2. 穴を持つ2D領域の和・差・積。
3. 平面多面体の位相構造と3D演算。

曲面、3Dソリッド、CAD形式の読み書き、GUIはまだ含みません。

## ライセンス

MIT。詳細は[LICENSE](./LICENSE)を参照してください。

## 半辺と境界成分

`buildHalfEdges(segments)`は交点で分割した線分から、反転・次・前の接続を持つ半辺、頂点周りの反時計回りの出辺、閉じた境界巡回を返します。方向の比較と符号付き面積は有理数で計算します。

境界巡回はまだ面にグループ化していません。橋や重複頂点を含む場合があり、面積の符号だけで穴の所属を決定できません。[アルゴリズムの正当性と前提](docs/proofs/half-edges.md)を参照してください。

## 面の構築

`buildFaces(segments)`は境界成分を面にまとめます。`faces[0]`は非有界面で、残りは外側境界と穴・木状境界を持つ有界面です。`boundaryFaces`・`halfEdgeFaces`で所属先を参照できます。孤立頂点も面ごとに保持し、有界面の`twiceArea`は穴を差し引いた面積の2倍を厳密に返します。

```sh
npm run build
node examples/faces-to-svg.ts
# artifacts/faces.json と artifacts/faces.svg を生成
```

既定の例では交差する2つの四角形から面積1・3・3の領域を色分けします。所属判定も有理数で行い、固定の許容誤差は使いません。SVG表示への射影だけを近似します。[正当性と保証の範囲](docs/proofs/faces.md)を参照してください。面抽出は全ペアによる線分分割に加え、各境界の包含判定を行う実装で、大規模データ向けの空間索引は未実装です。

## ポリゴンの集合演算

```ts
import { booleanPolygons, point2 } from "cadloom";
const a = [[point2(0n, 0n), point2(2n, 0n), point2(2n, 2n), point2(0n, 2n)]];
const b = [[point2(1n, 1n), point2(3n, 1n), point2(3n, 3n), point2(1n, 3n)]];
const result = booleanPolygons(a, b, "intersection");
console.log(result.twiceArea.toString()); // "2"（面積1）
```

`union`・`intersection`・`difference`（aからbを引く）・`xor`を指定できます。入力は暗黙に閉じる環の配列で、各環には3点以上必要です。既定の塗り規則は`even-odd`、第4引数に`nonzero`も指定できます。自己交差・重複・退化環を扱います。

結果の`rings`は選択領域を左に持つ向きで、外側は反時計回り、穴は時計回りです。穴を差し引いた面積の2倍を`twiceArea`に保持し、`arrangement`・`selectedFaces`で元の面を参照できます。環が単純であることは保証せず、接触頂点を共有する場合があります。

これは面積領域の正則化演算です。点・線だけの交差は出力しません。[仕様と正当性](docs/proofs/polygon-booleans.md)を参照してください。

```sh
npm run build
node examples/polygon-booleans-to-svg.ts
# artifacts/polygon-booleans.{json,svg} に4演算の比較を生成
```

## 点の内外・境界判定

```ts
import { preparePolygon, locatePointInPolygon, point2 } from "cadloom";
const region = [[point2(0n, 0n), point2(4n, 0n), point2(4n, 4n), point2(0n, 4n)]];
const polygon = preparePolygon(region); // 正規化は一度だけ
polygon.locate(point2(1n, 1n)); // "inside"
polygon.locate(point2(0n, 1n)); // "boundary"
polygon.locate(point2(-1n, 1n)); // "outside"
locatePointInPolygon(point2(1n, 1n), region); // 単発の問い合わせ
```

既定は偶奇規則で、`preparePolygon(region, "nonzero")`も使えます。判定対象は正則化後の塗り領域です。打ち消された環や内部の共有辺は境界とは扱わず、面積0の入力曲線だけなら全ての点が外部になります。準備済みオブジェクトは入力から独立し、繰り返し判定は正規化後の辺数に対して線形です。[正当性と前提](docs/proofs/polygon-location.md)を参照してください。

## 厳密アフィン変換

```ts
import { affine2, transformPoint, composeAffine2, invertAffine2, point2 } from "cadloom";
const move = affine2(1n, 0n, 0n, 1n, 10n, 20n);
const scale = affine2(2n, 0n, 0n, 3n);
const t = composeAffine2(move, scale); // 先にscale、次にmove
transformPoint(t, point2(1n, 2n)); // (12, 26)
const inverse = invertAffine2(t);
```

係数順は`a,b,c,d,tx,ty`で、`x'=a*x+b*y+tx, y'=c*x+d*y+ty`です。引数を省略すると恒等変換になります。`transformSegment`・`transformPolygon`も使え、結果は不変です。反転・せん断・有理数係数の回転も表せます。

`affineDeterminant`が0なら逆変換は例外になります。特異変換の適用自体は可能ですが、面が潰れる場合があります。任意角度の回転は一般に無理数を要するため、有理数係数だけで厳密には表せません。[証明と制約](docs/proofs/affine-transforms.md)を参照してください。

## 穴を含む領域の三角形分割

```ts
import { triangulatePolygon } from "cadloom";
const mesh = triangulatePolygon(region); // 第2引数に"nonzero"も指定可能
// mesh.vertices: 厳密な有理数座標
// mesh.triangles: verticesを参照する反時計回りの3頂点インデックス
// mesh.twiceArea: 正規化後の領域の面積の2倍
```

凹形状・穴・自己交差を正規化してから、有理数の補助頂点を追加して分割します。隣接三角形の辺を揃え、辺の途中に頂点が接するT字接続を避けます。接触成分が頂点だけを共有する場合はあります。入力頂点だけを使う分割やDelaunay分割ではありません。[正当性と制約](docs/proofs/triangulation.md)を参照してください。

```sh
npm run build
node examples/triangulation-to-svg.ts
# artifacts/triangulation.{json,svg} に穴と島を含むメッシュを生成
```

## 2D領域の3D押し出し

```ts
import { extrudePolygon, inspectMesh } from "cadloom";
const solid = extrudePolygon(region, "3/2", { baseZ: "-1/3" });
console.log(solid.volume.toString()); // 正確な体積
const report = inspectMesh(solid);
// closed / consistentlyOriented / nondegenerate / manifoldVertices / signedVolume
```

穴・島・離れた複数成分を持つ領域から、外向きの閉じた三角形メッシュを作ります。`height`と`baseZ`はbigint・厳密な文字列・Rationalを受け付けます。負の高さにも対応し、`zMin`・`zMax`を返します。塗り規則は`fillRule`で指定します。高さ0と点接触による非多様体の境界は拒否します。空領域は体積0の空メッシュになります。

`inspectMesh`は辺の接続と向き・頂点リンク・非退化・符号付き体積を調べます。任意のメッシュの空間的な自己交差を検出するものではなく、閉じた適切な向きの境界という前提なしに符号付き体積を幾何学的体積として使うことはできません。[正当性と検査範囲](docs/proofs/extrusion.md)を参照してください。

```sh
npm run build
node examples/extrusion-viewer.ts
open artifacts/extrusion.html
```

穴のある板を回転・拡大縮小できる単独HTMLと、厳密なJSONを生成します。WebGL対応ブラウザーが必要です。表示だけ浮動小数点を使い、カーネルの座標・体積は有理数のままです。曲面・3D集合演算・商用CAD互換はまだ対象外です。

## 厳密な3D向き判定と平面交差

```ts
import { point3, segment3, plane3, orient3d, intersectSegmentPlane } from "cadloom";
const plane = plane3(1n, 1n, 1n, -1n); // x+y+z-1=0
const result = intersectSegmentPlane(
  segment3(point3(0n, 0n, 0n), point3(1n, 1n, 1n)), plane,
);
// {kind:"point", parameter:1/3, point:(1/3,1/3,1/3)} （各座標・パラメーターはRational）
```

`planeFromPoints(a,b,c)`は3点から平面を作り、重複・同一直線など法線が0になる入力は拒否します。`evaluatePlane3`は`normal·point+offset`、`classifyPointToPlane3`はその符号を返します。法線は単位化しないため、評価値は距離ではありません。

`orient3d(a,b,c,d)`の規約は`((b-a)×(c-a))·(d-a)`の符号で、退化・同一平面では0です。ベクトルの`dot3`・`cross3`・`subtract3`も有理数で計算します。

線分と平面の結果は`none`・`point`・`coplanar`です。端点接触と零長線分を扱い、平面上の非零長線分は共通部分全体を返します。返却点・線分は入力から独立した不変値です。

```sh
npm run build
node examples/segment-plane-intersection.ts
```

[数学的仕様・証明・比較テスト](docs/proofs/plane3.md)を参照してください。これは3Dカーネルの基礎であり、BRepや3Dソリッド集合演算はまだ未実装です。

## 三角形面と平面の交差・分割

```ts
import { point3, triangle3, plane3, splitTriangleByPlane } from "cadloom";
const face = triangle3(point3(0n,0n,0n), point3(2n,0n,0n), point3(0n,2n,0n));
const result = splitTriangleByPlane(face, plane3(1n,0n,0n,-1n)); // x=1
// positive: 1三角形、negative: 2三角形、coplanar: null
// intersection: (1,0,0)→(1,1,0)の線分
```

`intersectTrianglePlane`は共通部分を`none`・`point`・`segment`・`coplanar`で返します。`pointOnTriangle3`は辺・頂点を含む三角形所属を判定します。三角形の重複・同一直線の頂点は拒否します。

分割は元の向きを保ち、正側・負側には非零面積の三角形だけを返します。面全体が同一平面なら`coplanar`へ一度だけ返し、両側へ複製しません。点や線だけの接触は`intersection`で保持します。[仕様と証明](docs/proofs/triangle-plane-split.md)を参照してください。

```sh
npm run build
node examples/triangle-plane-split.ts
```
