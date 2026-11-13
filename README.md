# exact-cad

ピュアTypeScriptのCADカーネルに向けた最初の基盤です。現在は **有理数による厳密な2D閉線分の交差** を実装しています。完全なCADカーネルや商用CADファイルのインポーターではありません。

## 実行

Node.js 24以上を使用します。

```sh
npm ci
npm test
npm run typecheck
npm run example
```

`npm test`はビルド後にテストを実行します。`npm run example`は、入力と厳密な結果を`artifacts/intersection.json`に、表示用のSVGを`artifacts/intersection.svg`に保存します。実行時の外部ライブラリ・WASM・ネイティブアドオンはありません。TypeScriptとNodeの型定義は開発用依存です。

## API

```ts
import { point2, segment2, intersectSegments } from './dist/index.js';

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

カーネルの演算に浮動小数点やepsilonは使いません。有限の有理数入力に対して、有理数の四則演算で交差を計算します。SVGへの投影だけを近似し、結果の計算には戻しません。極端な縮尺ではSVG上で異なる点が重なる可能性があり、JSONが正確な結果です。

テストは境界事例、独立したBigInt判定との全組合せ照合、入力交換・反転、平行移動・正負の拡大縮小、交点の所属を検査します。これらは数学的な形式証明ではありません。入力サイズが非常に大きい場合にはBigIntの時間・メモリ制限があります。

## 次の段階

1. 線分群の交点と分割。
2. 平面上の接続構造と領域の復元。
3. 穴を持つ2D領域の和・差・積。
4. 平面多面体の位相構造と3D演算。

曲面、3Dソリッド、CAD形式の読み書き、GUIはまだ含みません。
