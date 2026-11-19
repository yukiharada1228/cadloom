# cadloom

cadloomは、[SolidCraft](https://github.com/tangency-labs/solidcraft)のCADカーネル**solidcore**を、ピュアTypeScriptでゼロから再実装するプロジェクトです。対象はカーネル層だけで、SolidCraftのアプリ層（UI、描画、文書管理など）は含みません。

- 実行時の依存はゼロです（WASM、ネイティブアドオン、外部ライブラリなし）。
- 入力に由来するエラーは例外ではなく`Result`で返します。グローバル状態を持たず、許容誤差は`Kernel`値から受け取ります。
- 主要なアルゴリズムは、有理数による厳密なモデルをLean 4（Mathlibなし）で証明しています。

方針は[docs/POLICY.md](docs/POLICY.md)、計画は[docs/ROADMAP.md](docs/ROADMAP.md)を参照してください。

## 現状: M4（区間演算・交差・物体の問い合わせ）

| 領域 | 内容 | M |
|---|---|---|
| `core`、`math` | `Result`とエラー、`Kernel`と許容誤差、3Dベクトル、アフィン変換（合成、逆変換、回転） | M0 |
| `exact` | 倍精度値の二進有理数への厳密な変換、浮動小数点フィルター付きの厳密な`orient2d`と`orient3d`（M0）、`incircle`（M2）、線分の接触と環の向きの厳密な判定（M3）、閉じた式のための有理数と正しく丸めた倍精度への変換（M4、内部用） | M0、M2、M3、M4 |
| `nurbs`（曲線） | ノットベクトル、基底関数とその導関数、B-spline/NURBS曲線の評価と導関数、ノット挿入、Bézierのde Casteljau法と分割 | M0 |
| `nurbs`（曲面） | テンソル積NURBS曲面の評価・偏微分（A3.6/A4.4）・法線、等パラメーター曲線、曲面のノット挿入、曲線・曲面の次数上げ（A5.9） | M1 |
| `curve` | 直線・円・楕円とNURBS曲線の評価、接線・曲率・Frenet標構、弧長、最近点、厳密なNURBS形式（A7.1）、アフィン変換 | M1 |
| `surface` | 平面・円柱・円錐・球・トーラスとNURBS曲面の評価、法線、第1・第2基本形式、Gauss・平均・主曲率、陰関数と射影、厳密なNURBS形式（回転面A8.1）、変換 | M1 |
| `topology`、`primitive`、`mass` | B-repのデータ構造と検証（Euler–Poincaré、多様体性）、箱、多面体の体積・面積・重心 | M0 |
| `topology`（幾何） | 解析曲線・曲面を持つB-rep（継ぎ目のある円柱など）、幾何の検証（頂点・辺・面の一致、pcurveの持ち上げと向き、継ぎ目）、`(u, v)`への写像`surfaceUv` | M2 |
| `record`、`convert` | データとしてのB-rep（決定的な正準JSON、範囲検査、位相の語への符号化）と、recordとkernelの`Brep`の相互変換 | M2 |
| `tess` | 表示用メッシュ（辺の共有標本化、耳切りと穴の橋渡し、厳密な`incircle`によるDelaunay化、曲面の格子とたわみの細分、極・頂点の扇形）、水密性・向き・体積の検査 | M2、M3 |
| `primitive`（曲面） | 配置（原点・軸・x方向）つきの円柱・円錐（円錐台と頂点のある円錐）・球・トーラス。極は辺を持たない頂点（`uvGapCollapses`） | M3 |
| `profile` | 平面上の線分・円弧・NURBSのワイヤー、`createProfile`による検証（閉じていること、自己交差・接触、入れ子、向きの正規化）と領域への分割、面積・重心（Greenの定理）、矩形・円・スロット・バルジなどの作成関数 | M3 |
| `prism` | プロファイルの押し出し（法線方向・斜め・対称）、穴は貫通穴、側面は平面・円柱・NURBS。押し出しとスイープが共有する配置`buildPrismRegion` | M3 |
| `sweep` | 軸まわりの回転（全周・部分、軸に接するプロファイルの極）とPappusの体積、回転最小化標構（二重反射法）、パスに沿うスイープ（直線は押し出し、円は回転へ委譲、固定標構は厳密な平行移動、その他はNURBSで近似し誤差を報告） | M3 |
| `interval` | 外向き丸めの区間演算（TwoSum・TwoProductによる方向付き丸め）、区間ベクトルと箱、証明つきの区間`sin`・`cos`、曲線・曲面のパラメーター区間での証明つき包含箱（NURBSは部分曲線・部分曲面の制御点の凸包、解析形状は区間評価）と法線錐。交差の除外の土台 | M4 |
| `intersect` | 曲線/曲線（3Dと2Dのpcurve）、曲線/曲面、レイ、曲面/曲面。結果は必ず**exact**（閉じた式: 直線/平面、平面/平面、平面/球の円、同軸の回転面など）、**certified**（証明で枝刈りした細分とNewton、追跡した曲線と測った最大偏差、接触の種類）、**拒否**（理由を名指しした`Result`のエラー、`refusalReason`）のどれか。成分の数を黙って間違えない | M4 |
| `query` | 物体の準備と証明つきの包含箱、面の`(u, v)`領域での点の内外判定（半開の交差規則）、レイの投射と点の分類（内・外・上、決まらなければ名指しの拒否）、最近点と距離、辺の長さと面の面積 | M4 |

まだ完全なCADカーネルではありません。集合演算（ブール演算）、縫合、オフセット・フィレット、STEPの入出力などは[ロードマップ](docs/ROADMAP.md)のM5以降で扱います。このREADMEはリポジトリのソース版を対象とします。

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

M2のrecordと表示メッシュの例です。

```ts
import {
  createKernel, unwrap, vec3, makeBox,
  brepToRecord, stringifyRecord, parseRecordText, recordToBrep,
  tessellate, isWatertight, meshSignedVolume,
} from 'cadloom';

const kernel = createKernel();
const box = unwrap(makeBox(kernel, vec3(0, 0, 0), 2, 3, 4));

// B-repを正準JSONのテキストにし、読み戻す（同じ物体は同じバイト列になる）
const text = stringifyRecord(unwrap(brepToRecord(box)));
const back = unwrap(recordToBrep(kernel, unwrap(parseRecordText(text))));

// 表示用メッシュ（弦の許容誤差0.01）
const mesh = unwrap(tessellate(kernel, back, { chord: 0.01 }));
mesh.indices.length / 3;  // 12（三角形の数）
isWatertight(mesh);       // true
meshSignedVolume(mesh);   // 24
```

M3のプリミティブ・押し出し・回転の例です。

```ts
import {
  createKernel, unwrap, vec3, WORLD_PLACEMENT,
  makeCylinder, makeSphere,
  createPlaneSurface, createProfile, rectangleWire, circleWire, point2,
  extrude, prismVolume, revolve, revolveVolume,
  tessellate, isWatertight, meshSignedVolume,
} from 'cadloom';

const kernel = createKernel();
const cylinder = unwrap(makeCylinder(kernel, WORLD_PLACEMENT, 1, 2)); // 半径1、高さ2
const ball = unwrap(makeSphere(kernel, vec3(0, 0, 0), 1.5));

// 円の穴のある4×3の板を厚さ1で押し出す（種数1）
const xy = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0)));
const plate = unwrap(createProfile(kernel, xy, [unwrap(rectangleWire(0, 0, 4, 3)), unwrap(circleWire(point2(2, 1.5), 0.5))]));
const solid = unwrap(extrude(kernel, plate, 1));
unwrap(prismVolume(kernel, plate, 1)); // 12 − π/4

// xz平面の正方形[1, 2]×[0, 1]をz軸まわりに1周させた管
const xz = unwrap(createPlaneSurface(kernel, vec3(0, 0, 0), vec3(0, -1, 0), vec3(1, 0, 0)));
const ring = unwrap(createProfile(kernel, xz, [unwrap(rectangleWire(1, 0, 1, 1))]));
const axis = { origin: point2(0, 0), direction: point2(0, 1) }; // プロファイル平面の座標
const tube = unwrap(revolve(kernel, ring, axis, 2 * Math.PI));
unwrap(revolveVolume(kernel, ring, axis, 2 * Math.PI)); // 3π（Pappus）
const mesh = unwrap(tessellate(kernel, tube, { chord: 0.001 }));
isWatertight(mesh);     // true
meshSignedVolume(mesh); // 約3π（弦の許容誤差の分だけ小さい）
```

M4の交差と問い合わせ（`tests/index.test.ts`の`README example (M4)`で同じ内容を確かめています）:

```ts
import {
  createKernel, unwrap, vec3, WORLD_PLACEMENT, makeTorus,
  createPlaneSurface, createSphereSurface, createCylinderSurface,
  surfacePatch, intersectSurfaces, intersectRay, refusalReason,
  prepareBody, classifyPoint,
} from 'cadloom';

const kernel = createKernel();
const Z = vec3(0, 0, 1), X = vec3(1, 0, 0);

// 半径1.5の球と平面z = 0.5: 閉じた式による半径√2の円が1つ（class: 'exact'）
const sphere = unwrap(surfacePatch(unwrap(createSphereSurface(kernel, vec3(0, 0, 0), Z, X, 1.5))));
const plane = unwrap(surfacePatch(unwrap(createPlaneSurface(kernel, vec3(0, 0, 0.5), Z, X)), { u: [-3, 3], v: [-3, 3] }));
const cut = unwrap(intersectSurfaces(kernel, sphere, plane)); // cut.class === 'exact'、cut.hits[0].curve.kind === 'circle'

// 交わる2本の円柱（半径1と0.6）: 閉じた枝が2本（class: 'certified'、各枝にdeviation）
const vertical = unwrap(surfacePatch(unwrap(createCylinderSurface(kernel, vec3(0, 0, -2), Z, X, 1)), { u: [0, 2 * Math.PI], v: [0, 4] }));
const horizontal = unwrap(surfacePatch(unwrap(createCylinderSurface(kernel, vec3(-2, 0, 0), X, vec3(0, 1, 0), 0.6)), { u: [0, 2 * Math.PI], v: [0, 4] }));
const cross = unwrap(intersectSurfaces(kernel, vertical, horizontal));

// 予算が足りなければ、空の答えではなく理由を名指しした拒否
const bad = intersectSurfaces(kernel, vertical, horizontal, { maxPairs: 1, forceMarching: true });
if (!bad.ok) refusalReason(bad.error); // 'subdivision budget exceeded'

// トーラスへのレイ（近い順に4点）と、トーラスの立体に対する点の分類
const torus = unwrap(makeTorus(kernel, WORLD_PLACEMENT, 2, 0.5));
unwrap(intersectRay(kernel, vec3(-5, 0, 0), X, torus.faces[0]!.surface)); // x = -2.5, -1.5, 1.5, 2.5
const body = unwrap(prepareBody(kernel, torus));
unwrap(classifyPoint(kernel, body, vec3(2, 0, 0))).class;   // 'inside'
unwrap(classifyPoint(kernel, body, vec3(0, 0, 0))).class;   // 'outside'
unwrap(classifyPoint(kernel, body, vec3(2.5, 0, 0))).class; // 'on'
```

`npm run example`は3つの例を実行します。

- `examples/box-and-cylinder-mesh.ts`: 箱と円柱（`makeCylinder`）を作り、recordで往復させてからメッシュにし、`artifacts/`に`*.record.json`・`*.mesh.json`・`*.obj`（任意のメッシュビューアーで表示できます）・`summary.json`を書きます。
- `examples/primitives-and-sweeps.ts`: 全てのプリミティブ（箱、円柱、円錐台、頂点のある円錐、球、トーラス）、穴のある板の押し出し、穴のあるプロファイルの3/4回転、らせんに沿うスイープを作り、同じ手順で`artifacts/m3/`に書きます。`summary.json`には、メッシュの体積と閉じた式による解析的な体積、その相対誤差が入ります。
- `examples/intersections.ts`: M3のプリミティブどうしの交差（交わる2本の円柱、球と平面、トーラスと軸に垂直な平面・斜めの平面）を求め、交線をOBJの折れ線として`artifacts/m4/*.obj`に、各組の種類（exact/certified）・方法・成分・最大偏差を`artifacts/m4/summary.json`に書きます。さらに穴とスロットのある板に対して点の格子を分類し、板の解析的な記述と一致すること（不一致0、拒否0）を確かめます。

`unwrap`はエラーのときに例外を投げます。アプリケーションでは`result.ok`を見て分岐してください。これらの例（M2〜M4の例を含む）は`tests/index.test.ts`で、`examples/`の例は`tests/example.test.ts`で実行しています。NURBS形式のノットは円弧の角度ですが、区間の内部ではパラメーターと角度は一致しません（`unitArcAngleOfParam`で変換します）。

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

各Leanの定理がどのTS関数・テストに対応し、何を保証し何を保証しないかは[docs/proofs/M0.md](docs/proofs/M0.md)・[docs/proofs/M1.md](docs/proofs/M1.md)・[docs/proofs/M2.md](docs/proofs/M2.md)・[docs/proofs/M3.md](docs/proofs/M3.md)・[docs/proofs/M4.md](docs/proofs/M4.md)にまとめています。

## 帰属とライセンス

cadloomはMITライセンスです（[LICENSE](LICENSE)）。

cadloomは次のプロジェクトのコードを読んで設計しています。コードの翻訳ではなく再実装ですが、参照したupstreamのファイルを各ソースファイルの冒頭コメントに記録しています。

- [SolidCraft](https://github.com/tangency-labs/solidcraft)とそのカーネルsolidcore（MIT OR Apache-2.0）
- solidcoreの基になったNVIDIA USD BRep（SMLib・SM_API、Apache-2.0）
