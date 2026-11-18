# cadloom

cadloomは、[SolidCraft](https://github.com/tangency-labs/solidcraft)のCADカーネル**solidcore**を、ピュアTypeScriptでゼロから再実装するプロジェクトです。対象はカーネル層だけで、SolidCraftのアプリ層（UI、描画、文書管理など）は含みません。

- 実行時の依存はゼロです（WASM、ネイティブアドオン、外部ライブラリなし）。
- 入力に由来するエラーは例外ではなく`Result`で返します。グローバル状態を持たず、許容誤差は`Kernel`値から受け取ります。
- 主要なアルゴリズムは、有理数による厳密なモデルをLean 4（Mathlibなし）で証明しています。

方針は[docs/POLICY.md](docs/POLICY.md)、計画は[docs/ROADMAP.md](docs/ROADMAP.md)を参照してください。

## 現状: M1（曲線・曲面）

| 領域 | 内容 | M |
|---|---|---|
| `core`、`math` | `Result`とエラー、`Kernel`と許容誤差、3Dベクトル、アフィン変換（合成、逆変換、回転） | M0 |
| `exact` | 倍精度値の二進有理数への厳密な変換、浮動小数点フィルター付きの厳密な`orient2d`と`orient3d` | M0 |
| `nurbs`（曲線） | ノットベクトル、基底関数とその導関数、B-spline/NURBS曲線の評価と導関数、ノット挿入、Bézierのde Casteljau法と分割 | M0 |
| `nurbs`（曲面） | テンソル積NURBS曲面の評価・偏微分（A3.6/A4.4）・法線、等パラメーター曲線、曲面のノット挿入、曲線・曲面の次数上げ（A5.9） | M1 |
| `curve` | 直線・円・楕円とNURBS曲線の評価、接線・曲率・Frenet標構、弧長、最近点、厳密なNURBS形式（A7.1）、アフィン変換 | M1 |
| `surface` | 平面・円柱・円錐・球・トーラスとNURBS曲面の評価、法線、第1・第2基本形式、Gauss・平均・主曲率、陰関数と射影、厳密なNURBS形式（回転面A8.1）、変換 | M1 |
| `topology`、`primitive`、`mass` | B-repのデータ構造と検証（Euler–Poincaré、多様体性）、箱、多面体の体積・面積・重心 | M0 |

まだ完全なCADカーネルではありません。表示用メッシュ、円柱などのB-repプリミティブ、交差、集合演算、STEPの入出力などは[ロードマップ](docs/ROADMAP.md)のM2以降で扱います。このREADMEはリポジトリのソース版を対象とします。

名前の約束: M0の`evaluateCurve`・M1の`evaluateSurface`はNURBSだけを扱う次元非依存の評価関数です。解析形状も含む3Dの曲線・曲面（`Curve3`、`Surface3`）の評価関数には接尾辞`3`が付きます（`evaluateCurve3`、`evaluateSurface3`、`surfaceNormal3`）。

## 使い方

```ts
import {
  createKernel, unwrap, vec2, vec3,
  makeBox, polyhedronMass,
  clampedUniformKnots, createBSplineCurve, evaluateCurve,
  orient2d,
  createSphereSurface, sphereToNurbs, evaluateSurface,
  createCylinderSurface, surfaceCurvature,
} from 'cadloom';

const kernel = createKernel();

// 箱を作り、体積を測る
const box = unwrap(makeBox(kernel, vec3(0, 0, 0), 2, 3, 4));
const mass = unwrap(polyhedronMass(kernel, box));
mass.volume; // 24
mass.area;   // 52

// 2次のB-spline曲線を評価する
const knots = unwrap(clampedUniformKnots(3, 2)); // [0, 0, 0, 1, 1, 1]
const curve = unwrap(createBSplineCurve(2, knots, [[0, 0], [1, 2], [2, 0]]));
unwrap(evaluateCurve(curve, 0.5)); // [1, 1]

// 厳密な向き判定: 1 = 反時計回り、-1 = 時計回り、0 = 同一直線上
unwrap(orient2d(vec2(0, 0), vec2(1, 0), vec2(0, 1))); // 1

// 半径2の球を厳密なNURBS曲面（2×2次の有理曲面）に変換して評価する
const sphere = unwrap(createSphereSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 2));
const nurbs = unwrap(sphereToNurbs(sphere, { u: [0, 2 * Math.PI], v: [-Math.PI / 2, Math.PI / 2] }));
const p = unwrap(evaluateSurface(nurbs, 1.0, 0.3)); // 球面上の点（|p| = 2）

// 半径4の円柱の曲率（法線は外向き、曲がる向きが負）
const cylinder = unwrap(createCylinderSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 4));
const k = unwrap(surfaceCurvature(kernel, cylinder, 0.7, 1.5));
k.gaussian;  // 0（-0になることがあります）
k.mean;      // -0.125
k.principal; // [0, -0.25]
```

`unwrap`はエラーのときに例外を投げます。アプリケーションでは`result.ok`を見て分岐してください。この例は`tests/index.test.ts`で実行しています。NURBS形式のノットは円弧の角度ですが、区間の内部ではパラメーターと角度は一致しません（`unitArcAngleOfParam`で変換します）。

## 検証

Node.js 24以上と、Lean 4（`elan`、`formal/lean-toolchain`のバージョン）が必要です。

```sh
npm ci
npm run check
```

`npm run check`は次の3つを順に実行します。

1. `npm run typecheck`: ソースとテストの型検査（strict）
2. `npm test`: `node --test`による全テスト（Nodeが`.ts`を直接実行します）
3. `npm run prove`: `lake build`によるLeanの証明の検査と、全定理の公理の監査（標準の3公理だけを許可し、`sorry`などを禁止）

各Leanの定理がどのTS関数・テストに対応し、何を保証し何を保証しないかは[docs/proofs/M0.md](docs/proofs/M0.md)と[docs/proofs/M1.md](docs/proofs/M1.md)にまとめています。

## 帰属とライセンス

cadloomはMITライセンスです（[LICENSE](LICENSE)）。

cadloomは次のプロジェクトのコードを読んで設計しています。コードの翻訳ではなく再実装ですが、参照したupstreamのファイルを各ソースファイルの冒頭コメントに記録しています。

- [SolidCraft](https://github.com/tangency-labs/solidcraft)とそのカーネルsolidcore（MIT OR Apache-2.0）
- solidcoreの基になったNVIDIA USD BRep（SMLib・SM_API、Apache-2.0）
