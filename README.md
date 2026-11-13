# cadloom

ピュアTypeScriptのCADカーネルに向けた最初の基盤です。現在は **有理数による厳密な2D閉線分の交差と、線分群の交点分割・重複統合** を実装しています。完全なCADカーネルや商用CADファイルのインポーターではありません。

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

別途、[Leanによる機械検証](formal/README.md)を追加しました。有理数演算の公式、非平行交差、区間分割などの補題と、TypeScriptから抽出した交点式を検査します。**TypeScript実行コード全体の形式検証は未完了**で、未解決の証明義務がある間は完全検証ゲートが失敗する構成です。

カーネルの演算に浮動小数点やepsilonは使いません。有限の有理数入力に対して、有理数の四則演算で交差を計算します。SVGへの投影だけを近似し、結果の計算には戻しません。極端な縮尺ではSVG上で異なる点が重なる可能性があり、JSONが正確な結果です。

テストは境界事例、独立したBigInt判定との全組合せ照合、入力交換・反転、平行移動・正負の拡大縮小、交点の所属を検査します。これらは数学的な形式証明ではありません。入力サイズが非常に大きい場合にはBigIntの時間・メモリ制限があります。

## 次の段階

1. 平面上の接続順序・半稜線構造と領域の復元。
2. 穴を持つ2D領域の和・差・積。
3. 平面多面体の位相構造と3D演算。

曲面、3Dソリッド、CAD形式の読み書き、GUIはまだ含みません。

## ライセンス

MIT。詳細は[LICENSE](./LICENSE)を参照してください。
