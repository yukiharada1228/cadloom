# カーネル優先の開発方針

cadloomの中心は、形状表現と幾何演算、それらの成立条件を検査する純粋TypeScriptのライブラリです。画面操作や編集履歴を追加する前に、演算結果を次の演算へ安全に渡せるようにします。


最新のソース監査と、既存実装から次に閉じる不足は [カーネル統合監査](kernel-integration-audit.md) に記録します。

完了した全体回帰の対象コミットと再ビルド照合は [版164〜172の検証監査](kernel-regression-audit191.md) に記録します。最新版までの全体成功とは区別します。

## 作業中：非線形NURBS面の埋め込み認定

[三角射影による正の証明](nurbs-source-face-embedding3.md)を追加中です。閉階数・位置連続性に加え、パラメータ長方形全体の厳密な単調性から単射性を認定します。コミット対象の独立スナップショットで関連169件が成功し、追加テストのstrict型検査も成功しました。一般自己交差検出、立体への採用、最新版の全体回帰成功は未完了です。

## 現在の優先順位：共通カーネルの統合

ユーザーのカーネル優先の指示を受け、次の形状アダプターの追加より、既存の経路に共通する契約を先に整えます。SolidCraft全体の再実装という到達点は維持します。以下はソース確認に基づく不足であり、接続構造を一から作り直す計画ではありません。

| 層 | 現在の根拠 | 次に解消する不足 |
| --- | --- | --- |
| 接続 | `src/geometry/brep-topology3.ts` は共有辺、coedge、周期辺の別ポート、頂点リンク、シェルを構築 | `closedOrientedIncidence` が保証するのは接続。面領域・幾何学的な向き・大域的な埋め込みとは区別する |
| 縫合 | `src/geometry/sew-mixed-brep3.ts` は入力端点で分割し、対応する曲線片を共有化、由来を保持 | 入力にない内部同士の交差は生成しない。交差処理から必要な切断点を渡す契約が必要 |
| 材料 | `src/model/body3.ts` は所有された構築経路と復元照合を通して共通Bodyへ採用 | この採用を任意の閉じたBRepの立体認定へ拡大しない。各経路の幾何学的な成立根拠を明示する |
| Boolean | `src/ops/body3.ts` は平面同士と、それ以外の対応済み材料経路に分岐 | 共通の交差イベント、有限面への切り詰め、分割片と由来の受け渡しを整理する。単一の一般BRep Booleanが完成したとは扱わない |

次の実装課題は、平面／円柱の既存交差処理から、有限面に属する交差片・端点・元の面との対応を渡す共通の契約を抽出することです。まず既存経路へ接続して、分割前後の境界被覆、向きと共有辺、両側の材料分類、再演算を検査します。一般NURBSへの拡張は、この契約に必要な交差・埋め込みの条件を満たしてから進めます。UI・履歴・商用形式の追加は後続です。

円ループExtrude対応コミット `4945b39` を含む回帰は、874件成功・失敗0・スキップ0（726457 ms）。`oblique-cylinder-expression3.test.ts` はこの実行に含めておらず、874件の成功からその再検証や一般BRepの完成を主張しません。今回の方針更新は実行コードを変更しません。

## 現状と不足

厳密な数値・交差計算、平面／円柱の限定された面領域、NURBS曲線・曲面、B-rep接続は既にあります。しかし接続表が閉じているだけでは、面が埋め込まれていることや立体が成立することは保証しません。`buildNurbsBRepTopology3`もこの区別を保ちます。

## トリム面に向けた現在の土台

- `liftNurbsSurfaceBoundary3`は曲面ノットの逆像で境界を分割し、片側の厳密な3D像とパラメータ対応を保持します。
- `prepareNurbsParameterDomain2`はパラメータ空間の外周・穴・向き・接触を検証し、厳密な内外判定と内部点を返します。
- `analyzeNurbsSurfaceRegularity3`は各閉じた支持パッチの微分の退化集合と、全継ぎ目の位置の連続性を調べます。これはパラメータの特異性であり、像が別の正則な座標で表せないという意味ではありません。

`analyzeNurbsTrimRegularity3`は特異点集合を実際の領域へ制限し、穴・境界接触を区別します。`analyzeNurbsTrimSeams3`は残る継ぎ目の位置・C1・非退化な同方向接平面の一致を区間ごとに検査します。これらは独立した検証であり、面の単射性または継ぎ目を同一視した埋め込み、空間境界との整合性を組み合わせる必要があります。

## 次の開発：SolidCoreを参照した共通Bodyと操作の実装

次の優先事項は、SolidCoreの構成・操作を参照したピュアTypeScript再実装です。[方針と完了条件](solidcore-reimplementation.md)と[固定コミットに対する対応表](solidcore-coverage.json)を基準にします。

[Bodyレコードv1](body-record3.md)では、正確な保存形式・構造検査と、各幾何定義の復元まで実装しました。[共通の構築済みBody](constructed-body3.md)では、Box・有限Cylinder・垂直Extrudeの所有モデル、境界変換、内外判定と再構築照合による保存復元まで接続しました。[有界な解析面の定義と境界照合](face-domain-record3.md)もレコードから復元でき、共通Bodyの面照会に利用します。任意レコードの面・シェルの大域的な埋め込み、一般のパラメータ曲線や空洞の変換は引き続き必要です。その後、交差・面分割・接続・分類をブーリアンまでつなぎます。既存の三角形立体演算や限定された解析立体を、一般のB-rep演算と混同しません。

NURBSの領域・特異点・継ぎ目の検査は、共通カーネルの基盤として再利用します。開発順序は、共通の幾何・位相モデル、交差・分割・分類・縫合の統合、操作の拡張とします。部品の作成・編集の個別経路を増やす前に、未認定の面の埋め込みと立体の成立条件を明確にします。

SolidCraft全体のスケッチ・履歴・コマンド・アプリケーションも後続範囲に残します。現在の対応表は実装計画であり、互換性や再実装完了の認定ではありません。

形式証明は核心の数学へ絞ります。実装には独立した幾何学的オラクル、退化例、入力の向き・分割・再パラメータ化による不変条件を使います。ソースのハッシュ照合やテストの成功を、TypeScript全体の形式検証とは呼びません。

## 平面B-rep演算へ向けた実装順序

画面操作・選択UI・編集履歴より、立体として成立する演算結果を優先します。
当面は有理座標の平面B-repを対象に、面の分割、共有辺の接続、シェルの埋め込み・向き・空洞の分類、共通Bodyのブーリアンをつなぎます。箱だけの専用演算を一般のB-rep演算の完成とは扱いません。

`partitionConvexPolygonByPlanes3`は凸な平面多角形を支持平面群で厳密に分割します。既存の三角形分割と立体ブーリアンも同じ実装を利用します。これは面分割の基礎処理であり、非凸面・穴・共有辺IDの更新・共通Bodyのブーリアンは未実装です。次に、この分割片と既存の境界接続を結び、面・辺の由来を維持する必要があります。

`partitionPlanarBRepFaces3`で、凸平面多角形群の分割片を共有辺へ接続し、元の面・辺・切断平面と使用方向の対応を保持します。二方向に分割した箱とその再分割について、閉じた接続・境界被覆・向き付き体積を検査します。指定外の面間交差、シェルの大域的埋め込み、空洞分類、共通Bodyへの安全な採用はまだ必要です。次は、相手側の支持平面を用いた分割と面の両側の材料分類を、任意の入力を認定しない所有モデルへ接続します。

`preparePlanarSolid3`で、凸な有理平面多角形群から、埋め込み・シェル包含・向き・材料判定まで検査した立体を構築します。多角形B-repと面IDを維持し、内部の厳密な三角形分解で既存の交差・包含検査を再利用します。平面立体の空洞・材料島・貫通穴に対応します。次はこの所有された材料モデルを用いて分割片の両側を分類し、一般の平面B-repブーリアンと共通Bodyへの採用を進めます。

`booleanPlanarSolids3`で、検証済みの有理平面立体と所有された演算結果を対象に、和・積・差・排他的和を実装します。元の多角形面を支持面と共面境界線で分割し、厳密な両側の材料判定で面を選択します。面の由来を保持し、空洞や非多様体の接触結果も次の材料演算へ接続します。共通Bodyのレコード・所有モデルへの採用、面統合、曲面への拡張は残っています。

`createPlanarBody3`と`booleanPlanarBodies3`で、平面材料を共通Bodyの保存復元と再演算へ接続します。シェルの包含から空洞・材料島・材料内部点を計算し、代数的座標の照会は同一平面配置セルの有理代表点に厳密に帰着します。共通Bodyは現在多様体材料に限り、非多様体接触は低水準の材料APIへ残します。次に、接触領域の表現、面統合と由来の保持、曲面演算への接続が必要です。

`consolidatePlanarSolid3`と`consolidatePlanarBody3`で、同一平面・同じ物理向きの面の内部線を除去します。非凸外周・穴・離れた成分と、元の面への由来、シェルの一対一対応を維持します。一面にできない、境界が一点でつながる領域は有効な分割を残して報告します。統合したBodyも保存復元と再演算へ接続します。一般曲面の面統合、接触領域、曲面ブーリアンは残っています。

`createClippedCylinderBody3`・`splitCylinderBodyByPlane3`・`rejoinCylinderBodySplit3`で、既存の円柱・平面半空間の解析的な構築・切断・逆接続を共通Bodyへ接続します。斜めの楕円断面や無理数端点を維持し、両側の子を保存復元して再切断できます。共有面・辺の対応と親面への由来は返されたBodyのIDへ対応します。対象はこの凸な構築族で、任意B-repの切断や円柱同士のSSI・一般曲面ブーリアンではありません。

`intersectCylinders3`で、任意の有理軸の円柱同士の支持面交差を実装します。平行軸は共通母線、非平行軸は基準円上の帯と二枚の厳密な代数的高さに帰着し、孤立点・特異点を含む有限の接続グラフを構築します。二つの代数的パラメータの線形・二次式評価を追加して、一般のずれた軸でも座標の不必要な次数増大を避けます。次はこの曲線片を平面で切り、有界な円柱面の交差とB-rep辺へ接続する必要があります。支持面交差の完成を曲面ブーリアンの完成とは扱いません。

`intersectCylinderIntersectionArcPlane3`・`splitCylinderIntersectionArcByPlane3`・`clipCylinderIntersectionByHalfspaces3`で、代数的な円柱交線を有理平面で分割・制限します。四次の有限交点と共有楕円を区別し、接点のみとなる部分と支持面の法線が従属する点も保持します。座標は一つの根の有理式で復元し、別の共役根との取り違えを避けます。高さ制約と平面トリムへ接続できますが、任意角度境界、パラメータ曲線・共通B-rep辺への結合、曲面ブーリアンは残っています。

`BRepCurve3`・`buildMixedBRepTopology3`・`sewMixedBRepFaces3`で、既存曲線と所有された円柱SSI片を共有辺へ接続します。支持面全体への所属は多項式の恒等式で検査し、端点・代表点だけによる誤認を避けます。入力の端点での分割、異なる軸パラメータ化や既存楕円との同一曲線の照合、元の曲線使用への対応を保持します。閉じた接続は有界面や材料の認定ではありません。次は3D境界と曲面のパラメータ領域の対応、有界面の分割・向き、共通Bodyへの採用を進めます。

`clipCylinderIntersectionToFaces3`で、所有された円柱SSIグラフを二つの有限な円柱面の高さ・角度領域へ制限します。代数的な角度端点の母線と相手円柱の二次方程式を厳密に解き、完全な境界イベントで分割して曲線片と孤立接触点を残します。面の軸と参照円への座標対応は登録済みの代数的相関を保持します。これは有界面内の交線の構築であり、SSIを境界に持つ面領域の生成・分割、向き付きパラメータ曲線、共通Bodyへの採用、曲面ブーリアンは残ります。

`partitionCylinderFaceByCylinder3`で、円柱の帯／角度領域を他の支持円柱で分割します。完全なSSI・高さ境界イベントで角度区間を分け、上下の定数／SSI境界から埋め込まれた面片を構築します。面片の内外分類・厳密な位置判定・向き付き境界を保持し、共有辺へ接続します。平行軸・接線・同一支持面・孤立接触を扱います。人工的な母線分割は残します。有限な切断立体の全境界による制限、複数の切断面へ再利用できる領域表現、共通Bodyへの採用、材料ブーリアンの組み立ては引き続き必要です。

`partitionCylinderFaceCellsByPlane3`で、SSI／ネイティブ境界を持つ所有された面片を有理平面で繰り返し分割できます。境界の完全な平面交点を角度イベントへ変換し、定数・SSI・平面の上下境界から新しい面片を構築します。全平面の符号、直前の面片と元の円柱側への対応、共有辺の向きを保持します。`partitionCylinderFaceByFiniteCylinder3`は側面と両端面で分割し、面片内部の有限材料への所属を分類します。次は切断円柱の平面キャップにも必要な交差・分割を与え、両側の選択片を立体境界へ再接続する必要があります。共通Bodyの保存復元と曲面材料ブーリアンの認定は残っています。

`partitionPlanarFaceByCylinder3`と`partitionPlanarFaceByFiniteCylinder3`で、所有された平面キャップ／ネイティブ平面領域を、円柱の断面と両端面で分割・分類します。円・楕円の四次交点、母線、穴、傾いた面を保持し、厳密な単調面片と共有辺を構築します。既知のイベントの反対の楕円枝は有理アフィン反射で求め、共通根の座標対応を維持します。側面とキャップの双方に分割経路が揃いました。次は両入力の面片を材料規則に従って選び、同一・反対向きの一致面を区別して閉じた境界へ接続する必要があります。共通Bodyの保存復元と曲面材料ブーリアンの認定は引き続き残ります。

`prepareFiniteCylinder3`と`booleanFiniteCylinders3`で、両入力の側面・キャップを分割し、和・積・差・排他的和の必要面を選んで混合B-rep境界へ接続します。同一／反対向きの一致面を区別し、差・排他的和の内部面を反転します。面・分割片・共有辺の由来と厳密な材料照会を保持します。接触による釣り合った非多様体境界は診断付きで残します。これは二つの有限円柱の構築族であり、任意の曲面結果を再入力する演算、共通Bodyの保存復元・領域割当、面統合、一般の曲面ブーリアンの認定はまだ必要です。

### Exact point chart persistence

Portable exact points now retain registered rational-function and biparametric charts through JSON. This avoids discarding the common algebraic parameter used by curved-boundary predicates. Decoder evaluation and root/denominator checks remain mandatory; this does not certify surface membership. See [record semantics and limits](exact-point-chart-records3.md). Cylinder SSI curve records and common curved Body adoption remain next integration work.

### Mixed edge persistence

Native and cylinder SSI BRep edges now have a dedicated portable codec. SSI reconstruction regenerates the supporting intersection and validates whole ordered factory intervals before producing owned trimmed arcs. See [mixed curve record semantics](brep-curve-records3.md). Wiring these edges into common Body boundary/face-domain records and material-region reconstruction remains outstanding.

### Common mixed boundary tables

The existing BodyRecord now carries cylinder SSI edges, and the mixed boundary restorer checks endpoints, whole-edge supports, exact vertex welding, face-use orientations and shell connectivity. See [common mixed boundary records](mixed-body-boundary-records3.md). Curved face-domain/material-region validation and owned Body3 adoption remain required before these restored boundaries can become operands.

### Persistent SSI-bounded cylinder faces

Cylinder/plane partition wall cells now have common domain records selected by strict interior witnesses after complete partition replay. Mixed face restoration binds entire oriented native/SSI domain boundaries to common serialized uses. See [domain reconstruction and limits](cylinder-cell-domain-records3.md). Planar cylinder-cut face records, global shell/material validation and owned Body3 adoption remain outstanding.

### Complete cylinder Boolean face persistence

Planar cylinder-cut cells now have replay-validated common domain records. Owned finite-cylinder Boolean results export every selected wall/cap domain, including reversed cut faces, into common BodyRecord tables. See [planar domains and full face tables](planar-cell-domain-records3.md). Global shell/material validation and owned Body3 adoption remain the next integration requirement; curved Boolean results are not yet new operands.

### Exact mixed shell ray queries

Factory-restored plane/cylinder face domains now support exact bounded forward-ray intersections and evidence-carrying parity queries for closed locally manifold shells. Shared boundary hits and contained supports explicitly request another ray; tangent double roots do not toggle parity. See [query semantics and limits](mixed-shell-ray3.md). These queries enable future containment/nesting work but do not certify global embedding, material regions or owned curved Body validity.

### Constructive curved shell regions

Owned manifold two-cylinder Boolean boundaries now derive nesting forests, cavity orientation, strict rational adjacent-side samples and persistent material/void region roles using exact two-sided line scans. Arbitrary imported incidence is not promoted to a solid. See [construction argument and region algorithm](finite-cylinder-regions3.md). Common owned Body3 construction/persistence and reusable curved Boolean operands remain next integration work.

### Common owned curved Bodies

Owned manifold two-cylinder Boolean results now adopt into the existing Body3 contract with derived shell/void regions, exact samples, complete mixed face binding, common queries and replay-checked construction documents. Native-only backends check ownership/backend explicitly. See [curved Body construction and limits](finite-cylinder-body3.md). General curved re-operation, arbitrary curved BRep import and nonmanifold Body material remain incomplete.

### Third-cylinder events on existing SSI edges

Owned cylinder SSI arcs now intersect and split against a third rational cylinder. Exact height elimination, separating circle charts and rational-univariate recovery retain tangent, exceptional height-fiber and overlap cases. See [derivation and scope](cylinder-ssi-cylinder3.md). Reusing curved Body results still requires multi-cutter face arrangements and material assembly; this intersection primitive alone does not enable chaining.

### Reusable multi-cutter cylinder wall arrangements

Owned SSI/plane-bounded cylinder cells now refine repeatedly by native cylinders and planes, retaining all prior side vectors, immediate cell provenance, complete mixed boundaries and ordered domain persistence. Exact same-fiber reflection and source-aware interval/projection predicates prevent unnecessary algebraic field expansion. See [overlay proof and scope](cylinder-cell-refinement3.md). Multi-cutter planar cap arrangements and material/Body assembly are still required before curved Boolean results become reusable operands.

Multiple-cylinder planar arrangements now retain ordered cylinder sign vectors alongside plane signs. Full multi-cutter bounded planar domains can be replayed through the mixed face decoder. Material selection and closed-shell assembly for reusable cylinder expressions remain the next kernel dependency.

Finite-cylinder face arrangements now expose cell-major material-location matrices on both planar caps and cylindrical walls, including coincident wall/cap patches. These classifications are preparation for expression-level boundary selection; closed-shell assembly and reusable general curved Body operands remain incomplete.

Finite-cylinder expression boundaries evaluate complete Boolean trees on the two sides of every fully partitioned primitive-face cell, deduplicate coincident patches and sew the selected oriented faces. Initial fixtures include nested same-axis and three-axis expressions, inward cavity walls, duplicate cancellation, opposed cap removal and exact nearby material checks. Common Body adoption, expression recipes and general oblique/contact regression coverage remain incomplete.

Selected finite-cylinder expression boundaries now export through common BodyRecord with ordered wall-refinement and multi-cylinder planar domains. Nested cavity orientation and empty boundaries round-trip through whole mixed-face binding. Region roles remain explicit caller declarations; owned expression-region adoption and editable construction replay remain incomplete.

Owned manifold finite-cylinder expression boundaries now derive shell containment forests, alternating material/void regions and strict rational material witnesses. The existing two-cylinder region algorithm shares a private core; expression witness candidates on any primitive boundary retry instead of assigning ambiguous Boolean leaf truth. Three-level cavity/island nesting and existing region regressions pass. Common Body adoption and expression recipe replay remain incomplete.

### Reusable finite-cylinder expression Bodies

Common Body adoption now includes owned manifold cylinder expressions, derived material/void regions, exact regularized material queries and normalized expression recipe replay. Earlier binary and expression results can feed `booleanCylinderBodies3`, including after restoration. Discarded primitive boundaries use symbolic infinitesimal signs, not a numeric tolerance. See [construction and query argument](cylinder-expression-body3.md). Plane-clipped leaves, broader analytic/NURBS families, general oblique/contact coverage and maximal curved face consolidation remain incomplete.

### Oblique-cylinder kernel validation in progress

The next gate is a genuinely oblique three-cylinder expression, `A − (B ∩ C)`, including complete boundary sewing, independent quadratic material checks and common Body adoption. Work remains on exact-computation cost in this pipeline; the fixture is retained unchanged. Certified interval rejection, constructive line/source identities, immutable snapshot reuse and exact comparison reuse avoid repeated field expansion without changing the geometry. See [arguments, regression scope and unfinished integration gate](cylinder-expression-query-performance3.md). Passing smaller or earlier broad snapshots does not complete this gate. UI, feature history and additional primitive families are not the focus of this step.

The numerical layer now has a correlated quadratic-image primitive and a norm-based sign predicate, retaining a common algebraic source instead of multiplying independent image degrees. See [degree bound, branch selection and tests](quadratic-extension.md). Private shared quadratic point charts now connect this representation to rational-univariate cylinder SSI lifts and exact plane/circle/cylinder/ellipse predicates. The oblique Boolean integration gate remains incomplete.

Shared quadratic point definitions now have an exact record tag and checked reconstruction. SSI body decoding can recover a sheet endpoint from serialized vertex candidates only after full fiber/support checks; whole curve intervals and body binding remain independently validated. See [record semantics and recovery scope](quadratic-point-records3.md). Full hard-case Body adoption remains a validation gate.

Coincident face supports now compare coorientation through exact support identities after checking sample membership on both surfaces. This removes algebraic normal multiplication from Body face binding while retaining malformed/off-support rejection. The unchanged oblique Body integration remains pending; this is kernel reconstruction work, not UI development.

The retained source-33 oblique `A − (B ∩ C)` test has now completed successfully, including manifold boundary, independent strict material grid, common Body conversion and interior samples. Its full runtime was about 17 minutes under concurrent diagnostic work, so practical performance remains a kernel priority. The later sewing-reuse source-34 implementation has its own still-running integration gate; neither result implies general curved/contact parity or completion of SolidCraft reimplementation.

Constructive cylinder Body adoption now reuses the exact mixed-face geometry already fully bound during region analysis, replacing only the schema-checked region table. Private factory ownership prevents copied claims from using that path; normal imported records still require full restoration. See [invariants and validation](validated-region-body-reuse3.md). The 25-test connected group, all 767 non-hard tests, the unchanged two-test oblique integration and scoped audit now pass. The hard run completed in about 8 minutes 50 seconds under diagnostic conditions; this is not an interactive performance result.

### Plane events for clipped expression leaves

Finite-cylinder wall and planar face arrangements accept additional oriented rational plane cuts, retaining cap/material indices and appending exact plane-side columns. Oblique/reversed planes, independent rational grids and a `10^-40` height strip with domain replay pass; all 770 non-hard regressions and the scoped audit pass. See [semantics and remaining assembly work](finite-cylinder-plane-arrangements3.md). New cut-cap generation, clipped-leaf material selection, closed-shell assembly and construction-document integration are still required.

Owned finite-cylinder expressions now produce positive-area plane-section cells with exact material flags on both normal sides. Genuine interior cuts are distinguished from coincident outer/cavity caps, including cancelled opposed caps. See [construction argument and remaining split assembly](cylinder-expression-plane-section3.md). Closed child assembly, contact reporting and persistent clipped recipes are still required.

Plane sections now sew with refined original expression faces into negative/positive mixed-boundary children, retaining original face orientation, immediate source-cell provenance and opposite cap face pairs. Material queries use the owned expression plus the cut halfspace; balanced nonmanifold results remain explicit. See [construction and remaining Body/contact integration](cylinder-expression-plane-split3.md). Common Body adoption, persistence/repeated operations and full contact classification are not yet connected.

Plane-cut expression children now export complete replayable wall, old-cap and new-section domains through common BodyRecord. Both sides restore through actual geometry/domain binding, preserving reversed cavity walls, SSI edges and balanced nonmanifold incidence. See [codec semantics and remaining material adoption](cylinder-expression-split-record3.md). Region declarations are still explicit; derived nesting, common Body construction and clipped recipe replay are not yet implemented.

### Common Body adoption for one-plane expression cuts

Owned manifold split children now derive nesting/void roles and strict rational material samples, reuse fully bound geometry and adopt common Body3. The new `plane-cut-cylinder-expression` recipe replays original operands/tree and the kept plane side before comparing the entire ordered record. Closed and opened cavities, nested islands, empty children, SSI geometry and tampered recipes/region roles pass. An additional oblique cut crosses unequal perpendicular-cylinder SSI at four exactly checked shared vertices and replays both Bodies. See [invariants, validation and remaining reuse work](plane-cut-expression-body3.md). Repeated cuts and cut-child Boolean operands remain unsupported.

### Repeated halfspace cuts at the kernel boundary layer

Owned finite-cylinder expressions now intersect with ordered lists of halfspaces, and further cuts retain all earlier constraints. Wall source-cell provenance composes across refinements; original caps and every cut cap are noded by all planes. Duplicate caps select one representative, opposed/incompatible constraints produce empty regularized volume, and balanced nonmanifold incidence remains explicit. Independent reordered-cut grids, cap intersections, SSI cuts and a `10^-40` strip pass. See [construction and remaining Body integration](clipped-cylinder-expression3.md). Multi-cut Body persistence/adoption and unrelated clipped-leaf Booleans are not yet connected.

### Repeated clipping through common Body persistence

Multi-cut expression boundaries now export all bounded domains, derive material/void regions and adopt common Body3 with a replay-checked `clipped-cylinder-expression` recipe. `clipCylinderExpressionBody3` appends conditions to actual owned/restored cylinder-family backends, including old single-cut, binary and native clipped-cylinder Bodies. Original constraints survive further cuts and empty results. Five connected end-to-end tests and all 800 non-hard regressions pass. See [invariants and remaining unrelated-Boolean reuse](multi-cut-expression-body3.md). Clipped operands inside unrelated unions/differences still require a material-expression backend with per-operand halfspace predicates.

### Operand-local halfspaces in bounded material expressions

A new bounded cylinder/plane predicate backend retains halfspaces inside each operand's Boolean formula. Complete two-sided selection covers all cylinder walls/caps and plane carriers, deduplicates coincident supports and handles reversed subtraction faces. Actual owned clipped/material results now union/intersect/difference/xor, compose again and accept additional cuts at the kernel boundary layer. Independent grids, regularized cap cancellation, SSI subtraction, boundedness/ownership checks and all 806 non-hard regressions pass. See [construction proof argument and remaining Body integration](cylinder-material-expression3.md). New-family domain persistence, region adoption and public common-Body Boolean dispatch remain pending.

### Reusable operand-local material through common Body

Clipped cylinder-family operands now compose through common Body Boolean dispatch while retaining each operand's local plane predicates. Complete selected domains and reversed subtraction faces persist; derived shell nesting and strict material samples certify manifold Body adoption. Restored results support further Booleans and cuts. See [contracts and validation](cylinder-material-body3.md). All 812 non-hard regressions and the existing 133-declaration scoped audit pass; the unchanged two-test slow oblique suite was not rerun for this milestone. Box/cylinder interoperability, general analytic/NURBS Booleans, broader contact semantics and interactive performance remain kernel gaps.

### Exact six-plane box bridge into mixed material

`boundaryBoxMaterial3` now preserves the exact six-plane box boundary in the bounded plane/cylinder predicate backend. A strictly inactive enclosing finite cylinder establishes boundedness without contributing any face. Box/cylinder composition, independent rational material grids, signed edge balance and manifold Body replay pass. See [construction and scope](box-material3.md). Native Box Body automatic dispatch and general polyhedral/curved interoperability remain integration work.

### Native Box / cylinder common Body composition

`booleanMixedBodies3` connects actual owned/restored native boxes to cylinder-family operands, retaining local cuts through complete material-recipe replay and further operations. The cylinder-specific API keeps its earlier family contract. See [invariants and validation](box-cylinder-body3.md). General polyhedral/curved interoperability, transformed boxes, contact promotion and NURBS remain incomplete.

### Convex planar boundary lowering

Owned convex single-shell rational polyhedra now lower to their outward supporting halfspaces in the bounded plane/cylinder material backend. Every source vertex must lie in every negative halfspace; existing exact embedding/orientation certification and strict auxiliary guard containment are retained. Four-support tetrahedron replay agrees with 343 independent rational simplex points; concave, disconnected and copied inputs reject. See [construction and validation scope](convex-planar-material3.md). Native general-planar Body dispatch, nonconvex/void decomposition and maximal coplanar consolidation remain incomplete.

### Convex planar common Body operands

`booleanMixedBodies3` now lowers actual planar/consolidated Body backends through the owned convex supporting-halfspace bridge. Restored Bodies reestablish source ownership; cylinder-specific dispatch consistently rejects planar inputs. See [contract and validation scope](convex-planar-body3.md). Concave/void/multi-shell decomposition, broader native extrusion conversion and analytic/NURBS parity remain incomplete.

### General planar parity programs

Owned rational planar material now compiles into a balanced bounded halfspace/tetrahedron parity expression, including concave material, nested voids/islands, disconnected shells and empty input. Three focused strict-chamber tests pass against independent rational-cell predicates and the prepared-solid classifier. See [construction argument and explicit boundary gap](planar-material-program3.md). No general sewn BRep, native Body dispatch or complete mixed Boolean parity is claimed by this compiler alone.

### Shared quadratic planar arrangement endpoints

Fallback ellipse graph endpoints now preserve one common abscissa and one quadratic radical in world coordinates, avoiding independent-field resultants during support checks. Eighteen existing connected tests, the consolidated convex-Body diagnostic and an irrational cross-circle chart/degree regression pass. See [formula, evidence and pending integrated gates](planar-quadratic-endpoints3.md). Corrected runtime b64db64 passed all 827 non-hard tests, the added endpoint regression separately, and the unchanged two-test slow oblique integration; no controlled speedup or full execution proof is claimed.

### Minimal convex-face fans for planar parity

The parity compiler now derives a direct vertex fan from each already validated convex polygon rather than coning the embedding checker's additional face-center triangles. Exact zero-volume/collinear cones skip by orientation. Four focused material tests and the scoped audit pass; the same L source drops from 84 tetrahedra/138 planes to 28 tetrahedra/36 planes. General sewn-boundary verification remains in progress; see [construction and scope](planar-material-program3.md).

### Reuse validated plane inverse charts

Actual frozen frame factories now retain the validated normal and exact Gram inverse constants; inverse/null results reuse only actual immutable snapshotted points. Mutable/copied frame and point inputs still revalidate. All 34 connected cases, all 831 non-hard regressions and the scoped audit pass. See [invariants and boundary verification scope](plane-frame-projection-reuse3.md). This preserves exact membership and affine provenance without tolerance or public certification flags.

### Canonical planar carriers with guarded polarity

The parity compiler now folds opposite plane orientations into one geometric carrier, representing the reversed side by difference within the same actual enclosing guard. All four chamber cases and a fifth regularized tetrahedron boundary/Body replay case pass, along with the scoped audit. The L source drops from 36 oriented plane entries to 21 geometric carriers; its general boundary construction remains in progress. See [semantics and verification scope](planar-material-carriers3.md). Parent frame runtime 922d358 passed all 831 non-hard and unchanged hard two-test integration gates.

### Shared abscissa fields for rational line graphs

Rational chart segments now construct fallback graph endpoints as a genuine affine image of the actual abscissa, preserving dependencies just as ellipse endpoints retain their shared quadratic source. General algebraic/vertical fallback and known-event priority remain. A regression fails on the prior runtime and passes after the change; all 35 connected cases and the scoped audit pass. Runtime c95d946 passed all 833 non-hard tests, both unchanged hard tests and cold restoration of the genuine archived L document. Retained-Body L replay exhausted the default heap; resource correctness remains a gate. See [construction and validation scope](rational-planar-graph3.md).

### Preserve both rational graph construction identities

Rational graph endpoints now pass through the actual affine plane-map factory, retaining both a common abscissa field and the fixed-abscissa line parallel to the second frame vector. A strengthened regression rejects the earlier direct-world-affine implementation; all 35 connected cases and the scoped audit pass. Integrated retained-Body replay still needs resource validation.

### Cheap algebraic comparison cache admission

Rational/rational and disjoint isolating-interval comparisons now return before
allocating pair-cache entries. Overlapping algebraic certificates retain the
existing exact comparison and genuine-instance cache. This avoids retaining
quadratically many trivial pair decisions when an arrangement keeps its operands
alive; it does not establish a bounded-memory guarantee. The focused numeric,
root, endpoint and inverse-chart checks passed 21 tests. Broad regressions and
the retained-Body L-shaped serialization/replay experiment are still running;
the earlier default-heap failures must not be reported as resolved yet.

### General planar material boundary entry point

`boundaryPlanarMaterial3` connects an actual owned prepared planar solid to the
existing bounded parity compiler and complete material partition/sewing backend.
It returns the raw boundary with its manifold certificate; common Body adoption
continues to use the existing checked material adapter. It does not change the
convex-only native planar dispatch in `booleanMixedBodies3`. The compiler supports
concavity and nested/disconnected shells, but large boundary construction and
retained-Body replay remain resource gates. The four chamber/compiler cases and
the existing tetrahedron full-boundary/replay case all passed (five tests). The
tetrahedron case uses the public entry point, checks actual physical supports and
manifold incidence, rejects copied ownership, and adopts/serializes/restores the
Body with exact inside/outside/boundary queries. The build and existing scoped
133-declaration audit passed. This does not establish large concave replay or
full TypeScript execution verification.

### Combined comparison-admission regression results

Runtime `f4f4eee` (including fixed-abscissa provenance) passed all 834 non-hard
tests in one invocation, including cold restoration of the immutable af34fb3
concave L Body. The latter checked all 275 face samples, topology/material
regions, 64 independent strict points and nine seam/bounded-boundary cases.
The full suite took 952,600 ms under concurrent workloads; this is not a
controlled performance comparison. The retained-Body experiment constructed
275 manifold faces and adopted the Body; its replay remains running. The unchanged separate oblique two-case
integration passed both tests in 943,842 ms under concurrent workloads. These results precede the new public
planar boundary wrapper, whose own five focused cases passed separately.

### Reproducible retained planar Body resource gate

`node examples/planar-material-replay.ts` (after building) reproduces the
275-face concave L through the public boundary API at the default heap. It emits
JSON time/memory checkpoints, validates physical supporting planes and rational
face samples, adopts/serializes/restores the Body, then checks all restored face
samples, 64 independent strict points and nine seam/bounded-boundary cases.
Post-restoration accesses keep the original prepared source, raw boundary, Body
and serialized document observable throughout replay. The example passed syntax
and standalone strict TypeScript checks. Its complete resource run has not yet
been launched: the preceding same-input prototype is still being observed, so
no second competing warm replay is started merely to obtain a new process.

### Retained 21-plane L replay completed

The original resource prototype on combined runtime `f4f4eee` terminated with
exit 0: 275 manifold faces at 914,327 ms, Body adoption at 953,457 ms, replay at
1,593,568 ms and all seven prototype membership queries at 1,593,584 ms. The
source58 fixed-abscissa provenance and source59 cheap-comparison admission
changes are combined in this runtime; this is not an isolated attribution or
a controlled speed benchmark. Both earlier OOMs remain historical failures.
The new public resource example adds stronger full-face/64-point/seam assertions
and post-replay retention checks; its own complete run is still pending.

The separate `compilePlanarChambers3` implementation now passes five focused
tests, including a retained 14-face L Body replay with those stronger membership
checks. The parity compiler and public boundary entry point remain unchanged
until further general boundary coverage is established.

The separate cavity-boundary test also passed: exact physical supports, two
shells, cavity/material/boundary classification, all bounded-face samples and
retained original Body queries. The six new cases passed as five initial cases
plus the added cavity integration case, with standalone strict typing and the
existing 133-declaration scoped audit. No general native planar Boolean dispatch
or production compiler replacement is included in this additive milestone.

### Physical-plane boundary API integration

The chamber backend passed actual through-hole and nested cavity/island/
disconnected boundary adoption and replay. Four shells and three regions survive
the latter, with every face sample, 324 strict points and five bounded boundary
queries. The through-hole case checks 100 strict points plus tunnel/cap seams.
`boundaryPlanarMaterial3` now uses this compiler; its five existing compiler/
tetrahedron checks passed, as did the existing scoped audit. Native planar mixed
Boolean dispatch remains convex-only. The full non-hard suite is running.

The retained replay example now explicitly calls the unchanged 21-plane cone
compiler and complete material backend, retaining its 275-face resource gate.
It must not silently become a smaller 14-face case when the public API changes.
Its isolated previously launched run still uses the same original program and
has reached serialization with the original state held; restoration is pending.
Historical material recipes and backend replay ordering are unchanged.

### General native planar mixed Body dispatch (verification pending)

`booleanMixedBodies3` now lowers actual owned planar/consolidated sources through
the general planar material boundary entry point. A private exact convexity
selector preserves the existing supporting-halfspace backend for one positive
convex shell; concavity, voids, disconnected shells and empty material use the
chamber compiler. It checks ownership and all vertices against oriented support
planes, with no exception-catching or caller certificate fallback. The dedicated
convex entry point retains its rejection contract, and cylinder-only Body Boolean
still rejects native planar inputs.

Five new execution cases are running: four operations with restored concave
material versus an independently classified cylinder; consolidated concave
intersection and repeated clipping after replay; disconnected native shells; a
void clipping a cylinder into two material components; and empty-material Boolean
identities. The three existing convex Body cases, four convex boundary cases and
five compiler/tetrahedron cases run in the same focused invocation (17 total
expected). Build, standalone strict typing and the existing scoped 133-declaration
audit passed. No success is claimed for the pending execution invocation or for
the prior boundary-API full suite, which remains independently live.

The running focused invocation has emitted successful results for all seven
existing convex Body/boundary cases. The new general planar cases and final
invocation summary remain pending; seven observed passes are not a 17-case pass.

### General native dispatch execution results and fixture correction

The first 17-case focused invocation terminated with 16 passes and one failure.
All five new general native planar cases passed, including independent truth for
the four concave operations, consolidated replay and repeated clipping, three
disconnected output shells, a cavity splitting a cylinder into two components,
and empty-material identities. All seven convex cases also passed.

The remaining failure was the canonical-cone fixture asking the unified API for
a negative-orientation face. The new convex selector deliberately supplies
outward-oriented supporting planes, so this assertion no longer tests the cone
compiler. Restore that fixture to the explicit original compiler/material path,
keeping its negative-orientation assertion, and add a separate unified convex
API fixture with four supports, copy rejection and exact Body replay/membership.
The two targeted cases are running; this is not yet an all-green focused gate.
No kernel implementation was changed to address that test routing mismatch.

The explicit canonical-cone targeted case passed, preserving its negative-face
orientation check and full Body replay. The added public convex API case first
exposed an incorrect exact face-count assertion: the existing four-support
backend legitimately returns six face fragments. Replace that assumption with
the exact set of four physical halfspace supports and verify every rational face
sample on the independent prepared source boundary. Its complete adoption/replay
and membership case then passed (8,303 ms). All 18 current distinct focused cases
are covered by successes across the initial 16 passes and these two targeted
reruns; this is not one all-green 18-case invocation. Kernel source was unchanged
through the fixture corrections.

The prior boundary-API broad run remains live specifically in the historical
275-face reader and the eight-case chamber test file; both have increasing CPU
time. The explicit retained 21-plane resource example is independently still
restoring. No completed broad/resource result is inferred from elapsed time.

### Boundary API integrated broad regression completed

The isolated boundary-API runtime `9597d95` passed all 842 non-hard tests in one
invocation (1,456,088 ms under concurrent work). This includes the immutable
af34fb3 275-face reader, all eight chamber cases, nested four-shell/three-region
replay and the positive-genus through-hole. The two earlier oblique cases passed
on ancestor f4f4eee and were not repeated here; no new hard-case result is claimed.

A fresh isolated build and complete non-hard snapshot of current kernel source
(the general native planar dispatch plus corrected canonical/public fixtures)
have now started their own full invocation. That result and the explicit
retained 21-plane resource example remain pending. Review source hashes matched
the current manifest; that is artifact bookkeeping, not an equivalence proof.

### Native planar pair dispatch and regularized contacts

The four contact fixtures on the original material path passed: union cancels
an opposed internal bounded face, intersection removes a zero-thickness strip,
difference retains the proper boundary, and raw XOR diagnoses a nonmanifold edge
while rejecting manifold Body adoption. All strict and seam queries and replay
checks passed (533,247 ms under concurrent work).

The common API now selects the existing native planar Boolean kernel when both
operands carry actual owned planar sources. The native recipe is preserved on
that path; other supported pairs retain mixed-material recipes. Five targeted
cases passed through the new dispatch: the same three manifold operations,
nonmanifold XOR rejection/immutable inputs, and native replay followed by real
cylinder composition. Build, strict typing and the existing scoped audit passed.
No kernel topology/geometry algorithms were replaced or weakened, and no
caller-provided certificate selects this branch. The raw mixed XOR implementation
is unchanged and retains its preceding pass. The earlier full source68 snapshot
and explicit 21-plane resource run remain independently live; they do not cover
this later dispatch change.

### General dispatch broad gate and explicit retained resource gate completed

The source68 general-dispatch snapshot (`f8d280c` source/tests) passed all 848
non-hard tests in one invocation (1,289,085 ms). This includes all five native
general planar composition cases and the corrected canonical/public fixtures.
It precedes the later native planar-pair direct dispatch.

The explicit original 21-plane/275-face resource example on the isolated source62
build terminated with exit 0 and `all-checks-passed` at 3,188,506 ms. It retained
the original prepared source, raw material, Body and JSON through restoration
and queried them afterwards. All restored face samples, 64 independent strict
L points, nine seam/bounded-boundary cases, topology/regions and unchanged original
serialization passed. At the final checkpoint heapUsed was 3,196,203,392 bytes
and RSS 4,032,515,376 bytes. These are checkpoint observations, not measured peak
or a memory bound; no heap limit was increased. The difficult 21-plane condition
was preserved, independently of the newer 14-face default and native pair path.

A complete non-hard snapshot of the current native-pair source has now started,
including all six contact/dispatch/reuse cases. That later full result is pending.
The existing scoped 133-declaration audit passed for the native-pair source;
whole TypeScript execution verification and general analytic/NURBS parity remain
outside these successful gates.

### Native planar-pair full regression completed

The source71/native-pair snapshot passed all 854 non-hard tests in one invocation
(622,092 ms), including all six contact/dispatch/reuse cases and the historical
reader. This predates the new volume-moment module and its conversion extension.

### Exact planar volume moments

Add `planarVolumeMoments3` and the owned common Body adapter
`planarBodyVolumeMoments3`: exact rational volume, centroid and unit-density
inertia about the world origin and centroid. Integrate signed reference-relative
surface tetrahedra, preserving cavity/island/disconnected signs and checking
volume against the prepared source certificate. Empty material has a null
centroid and zero tensors; unsupported curved geometry is never reported as zero.
The rational planar converter now also accepts actual wrapped native line edges,
with the same straight-edge/rational-vertex and embedded-solid validation.

All nine distinct new cases passed across the initial six and three targeted
additions. Tests use independent cuboid/simplex/affine covariance expectations,
subdivision, common Body variants, native concave Boolean replay, a through-hole
and extreme rational scales/positions. The existing 22 constructed/planar Body
cases passed in one invocation. Build, strict typing and the existing scoped
133-declaration audit passed; no new mechanical moment/TypeScript proof is
claimed. Curved-body mass, surface area, certified integration and other M3
capabilities remain incomplete. See planar-volume-moments3.md for units/formulas.

The complete non-hard source74 snapshot, including all nine moment cases, is
now running. A remaining M1/M2 gap observed in the actual dispatch code is native
product Extrude Body mixed-Boolean lowering: the mass adapter can convert its
straight planar topology, but mixed operand selection still handles explicit
planar sources/Box/cylinder families only. Do not infer native Extrude Boolean
coverage from the successful createPlanarBody3/extrudePolygon fixtures.

### Planar moment full regression completed

The source74/moment snapshot passed all 863 non-hard tests in one invocation
(634,137 ms), including all nine volume-moment cases and historical Body readers.
This predates the later straight-product Extrude mixed operand dispatch.

### Native straight-profile Extrude mixed Body dispatch

Recognize actual owned product Extrude planar supports, then use the exact
straight/rational planar converter rather than falling through cylinder-only
source lookup. Two eligible planar/product operands dispatch to the native
planar Boolean kernel; eligible product/cylinder pairs use the material compiler
and local formula composition. Curved-profile product Extrude remains explicitly
unsupported. No caller flag or unchecked cast supplies planar certification.

Four new cases passed across three initial tests and a targeted reverse case:
restored concave native Extrude pair Booleans/regularized seams, a real cylinder
intersecting a holed Extrude, curved rejection, and reversed cylinder-minus-
Extrude producing a rational planar tunnel with independently checked volume,
centroid and central inertia. Build, strict typing and the existing scoped audit
passed. The 13 prior mixed-Body/contact cases are still running; no later broad
source pass is claimed. See straight-extrude-mixed-body3.md for accepted inputs.

The 13 prior related mixed-Body/contact regression cases subsequently passed
in one invocation (163,272 ms). The four new cases retain their successful
results on the same unchanged source. A complete non-hard snapshot including
the four new native Extrude cases is now running; its final result is pending.

### Straight-product full regression completed

The source79/straight-product snapshot passed all 867 non-hard tests in one
invocation (625,112 ms), including the four new product cases and historical
Body readers. This predates the circular-loop adapter and retained product source.

### Actual circular-loop product Extrude lowering

Retain the actual owned ExtrudedBRep3 in the Body model behind a private WeakMap.
Use its normalized region and world z bounds, not recipe dimensions, to lower
complete circular boundary loops. Every loop must have one circle support and
pass an exact 2D XOR-with-full-disk coverage check. Balanced parity of the actual
finite cylinders preserves normalized holes/islands/disconnected material.
General arc-line loops and different-circle arc loops still reject explicitly.

Seven new circular cases passed across five initial cases and two targeted
checks (perpendicular non-unit-axis SSI and irrational radius/fractional height).
The initial invocation also passed all four straight-product cases, with the
negative case now checking a real semicircle/chord loop rather than the newly
supported disk. The 35 prior constructed/planar/mixed/contact cases all passed
in one invocation (148,461 ms). Build, strict typing and the existing scoped
133-declaration audit passed. This does not mechanically prove the new adapter
or complete general curved-product/analytic/NURBS support.

The latest complete non-hard source82 snapshot, including all seven new circular
cases and the updated arc-line rejection case, is now running. Its result is
pending; the preceding source79 pass does not substitute for this later gate.

## 共通曲線切断イベントへの最初の接続

`curveNodingPoints3` と `collectCurveNodingEvents3` を追加し、有限な直線・円弧・楕円弧の切断点と入力曲線インデックスを共通化しました。既存の `partitionPlanarFaceByCylinders3` が集約器を利用します。支持楕円と線分交差も専用の面交差モジュールから共通モジュールへ移しました。[契約と未対応範囲](curve-noding3.md)を参照してください。

これは共通の交差・分割・分類・縫合のうち、分割へ渡すイベントの最初の統合です。円柱SSIや一般NURBSの切断、有限面同士の交差片の共通表現、重複区間の対応と材料分類は残っています。ビルドと新規テストの型検査は成功。133宣言の既存限定監査は成功しましたが、このAPIの形式証明ではありません。関連47件の回帰は成功（100917 ms、失敗・スキップ0）。全体回帰は別の隔離ビルドで追跡中です。

## 上流の交差点を縫合へ渡す

`sewMixedBRepFaces3` に追加の `splitPoints` を渡せるようにし、出力頂点への対応 `splitPointVertices` を追加しました。[契約](sew-intersection-points3.md)を参照してください。既存の曲線別・向き付き `sourceUses` を保持し、共有線分・楕円弧・円柱SSIに同じ切断点を伝えます。境界にない点は `null` となり、面内部への交差辺を推測して挿入しません。

有限な平面／円柱の交差から得た端点も接続し、境界上の4点が頂点になることと、内部の表現上の切れ目が境界頂点にならないことを独立した境界包含判定で検査しました。縫合12件は成功。混合材料を含む関連27件も成功（252949 ms、失敗・スキップ0、最終の縫合12件は別途確認）。前段の全体回帰は追跡中です。ビルド・既存133宣言の限定監査は成功しました。交差片のループへの組み込みと面分割・材料分類との統合は残っています。

## 有限な交差曲線を平面のセル境界へ挿入

`partitionPlanarFaceByCurves3` を追加し、既存の円柱分割と共通の縦分解エンジンを利用します。有限な直線・円弧・楕円弧を入力し、閉じたセル境界・内部点・領域判定・共有辺を生成します。[契約と範囲](planar-face-curves3.md)を参照してください。有限面の交差片も入力できます。人工的な縦辺を残す分解であり、材料の両側分類や一般BRep Booleanの完成ではありません。

新しい検査で、内部で終わる縦線分の端点が共有辺の頂点に残らないケースが見つかり、共通ネイティブ縫合の `splitPoints` へイベントを渡して修正しました。関連39件が成功（6991 ms、失敗・スキップ0）。前段の全体回帰は継続中で、新版の全体検証とは区別します。

## 材料分類に向けた曲面の局所符号の共通化

`surfaceGermSides3` で、平面・円柱の正負両方向への厳密な局所符号を共通化しました。[数式と契約](surface-germ3.md)を参照してください。円柱材料式の既存の方向別半径判定をこの関数へ接続しました。接線方向は二次項まで調べ、支持面上に留まる方向はゼロとして区別します。

新規4件と型検査、既存133宣言の限定監査は成功。最初の独立オラクルのテストにRational APIへbigintを直接渡す誤りがあり、Rationalへ明示変換して修正し、同じ147組と方向反転を再実行しました。混合材料と面分割の回帰は継続中です。点での符号を面全体へ広げるには、未分割の零点がないことの確認と材料式の両側評価が必要で、この段階ではセル全体の認定は追加していません。

前段 `865ae90` 相当の隔離ソース（共通曲線イベントまで）の全体回帰は878件成功（848585 ms、失敗・スキップ0）。変更なしの `oblique-cylinder-expression3.test.ts` は含めません。交差点縫合・有限曲線分割・局所符号までを含む現行ソースでは別の全体回帰を開始し、前段の成功と混同しません。

## セル内部の未分割零点と材料式の評価

`classifyPlanarPartitionSurfaces3` で、所有された開セルの内部に平面・円柱の零点が残るかを検査します。支持面交線をセル境界との全イベントで分割し、閉じた楕円がセル内に隠れる場合や二重の接線も検出します。内部点だけからセル全体の符号を推定しません。零点・有限曲線分割・局所符号の関連16件は成功（1770 ms）。

`classifyPlanarPartitionMaterial3` は全プリミティブ支持の検査を通ったセルだけ、有限円柱・上下端・半空間とBoolean式を法線両側で評価します。境界として保持するかと向きを返し、未分割の零点は未解決として返します。[契約と残る範囲](planar-cell-material3.md)を参照してください。型検査と既存133宣言の限定監査は成功。材料分類の追加回帰は追跡中です。

前段の局所符号版の修正版回帰22件は成功（201903 ms、失敗・スキップ0）。同版の全体回帰は継続中で、今回の分類APIの全体成功とは扱いません。

## 分類済みセルの向き付き境界と共有辺

`boundaryPlanarMaterialCells3` を追加し、材料の両側が異なるセルだけを採用し、必要な向きの反転と共有辺の縫合を行います。[契約](planar-material-cell-boundary3.md)を参照してください。元のセル番号と曲線別の共有辺対応を保持し、未解決があれば全体の選択を拒否します。

新規4件を含む関連22件が成功（952 ms、失敗・スキップ0）。円柱の上下端面をこの経路で生成して実際の壁と縫合し、入力面の正負どちらでも閉じた向き付き接続・1シェル・全辺2使用・問題なしを検査しました。型検査と既存133宣言の限定監査も成功しています。一般の曲面境界・全体被覆・埋め込み・ソリッド採用は未完成です。

前段の環状材料を含む追加分類テストは長時間実行中です。対象プロセス13177の1秒サンプルでは主にBigIntの剰余・除算が動作していました（`/tmp/cadloom-cellmaterial96-sample.txt`）。成功・停止とは扱わず、同じジョブを追跡します。遅い例を簡単な例で置き換えません。局所符号版の全体回帰も別途追跡中です。

局所符号までの前段の全体回帰は892件成功（819353 ms、失敗・スキップ0）。変更なしの `oblique-cylinder-expression3.test.ts` は含めません。零点検査・材料分類・境界選択までを含む現行ソースでは、別の全体回帰を開始します。

## 代数的端点と楕円の不要な体の合成を避ける

長時間の材料分類を調べ、`intersectAlgebraicSegmentEllipse3` が有理な支持直線でも端点の異なる体を合成している箇所を確認しました。実際の構築情報または固定有理座標から候補を得て、独立な二つの支持平面で両端点を検証してから、有理直線との交差と有限区間の絞り込みへ進む経路を追加しました。確認できない場合の一般経路と交点の方向順は保持します。[根拠と検査](algebraic-segment-ellipse-line3.md)を参照してください。

新版では、環状材料を含む元の全ケースと新規3件を含む関連22件が成功（6592 ms、失敗・スキップ0）。型検査・既存133宣言の限定監査も成功。元の長時間の回帰ジョブと、旧版の全体回帰は継続しています。新版の全体回帰と、斜交第三円柱2件を別の隔離ビルドで開始しました。診断専用のInspectorプロセスだけは役割を終えたため終了しました。

## 未解決セルへの交線追加と再分類

`refinePlanarMaterial3` で、零点が残る支持面の交線を追加し、既存の全曲線を残して再分割・材料分類を行います。新セルから元のセルへの対応と、追加した支持面インデックスを保持し、未解決が残る場合は境界を採用しません。[契約](refine-planar-material3.md)を参照してください。

斜め切断の診断で、固定座標が無理数の縦線分についても、端点同士の体の合成が生じることを確認しました。共通の固定座標を検証して変化する座標で直接交差を解く経路を追加しています。未切断の円・半円の不足・斜め半空間・親セル対応と、無理数位置の交差を含む関連30件が成功（12469 ms、失敗・スキップ0）。型検査と既存133宣言の限定監査も成功しました。

検証の同時実行が16GBの端末でメモリを競合していたため、旧版96の材料分類と旧版97の全体回帰はプロセスを保持して一時停止しました（対象は `/tmp/cadloom-suspended-old-gates.json`）。成功・完了とは扱いません。新版102で同じ再分割ケースが成功した後、旧版100の診断・再現用プロセスは役割を終えたため終了しました。

版99の全体回帰と斜交第三円柱2件は継続中です。版102の全体回帰はそれらの後に開始する待機ジョブとして登録し、斜交ケースも含めて並列数2で実行します。待機中を実行成功とは扱いません。今後の全体検証も同時実行数を制限します。

## 再分割の接触と重複支持の回帰

`refine-planar-material-contact3.test.ts` を追加しました。二重接線と高さの切断で、材料の平面境界を誤って生成しないことを確認します。同じ円柱を、反転・非単位方向・移動した軸原点と異なる高さパラメータで表した和でも、壁の支持交線を一度だけ追加し、端面の材料を維持します。追加2件と型検査は成功（741 ms、失敗・スキップ0）。実行コードは変更せず、これらの検査を待機中の版102全体回帰のスナップショットにも追加しました。全体成功とは扱いません。

## 世界座標の複数成分が変わる支持直線

傾いた有理の面基底でも再分割できるよう、実際の辺構築時に支持直線を保持します。両端点を二つの独立な有理法線の式で検査してから登録し、楕円交差と線分交差が同じ記録を利用します。有限範囲・向き・未知の一般処理を維持します。[根拠と検査](spatial-planar-line-support3.md)を参照してください。

非単位軸 `(1,2,2)` の円柱端面・斜め半空間・三次元の面基底、無効な方向やコピーの拒否、有限な重複を含む関連54件が成功（6768 ms、失敗・スキップ0）。型検査と既存133宣言の限定監査も成功しました。

前版99の全体909件が成功（1384520 ms）、重い斜交第三円柱2件も成功（1440917 ms）。これらの実行には以前のメモリ競合が含まれるため速度比には使いません。待機していた版102の全体回帰は開始済みです。旧版96/97の停止中プロセスと診断104/105/106は、対応する修正版の検査成功後に終了し、旧実行の成功とは扱いません。版107は版102の後に並列数2で検証する待機ジョブとして登録しました。

## 全候補平面を共通パイプラインへ接続

`boundaryPlanarMaterialSurfaces3` で、材料を定義する円柱の上下端と半空間の全支持平面を列挙し、同一支持を一度だけ分割・検査・再分割・分類・選択・縫合します。各出力面から支持グループ・セルへの対応を保持します。[契約と数式](planar-material-surfaces3.md)を参照してください。

非直交な平面座標の追加ケースにより、平方根と原点の共通パラメータを失う箇所と、確認済み有理方向の線分を端点間パラメータで交差させる箇所を改善しました。共通の二次像と、共面性を確認した支持平面への投影を使います。一般経路、有限範囲、向きは保持しています。

新規8件を含む関連76件が成功（17968 ms、失敗・スキップ0）。斜め円柱・重なる円柱の平面境界を既存の曲面と閉じた接続にし、6平面の箱は既存の幾何検査を経て体積1・共通Bodyの保存復元まで確認しました。型検査と既存133宣言の限定監査も成功しています。曲面側の一般分類、全体の埋め込みと一般ソリッドへの採用は残っています。

版102の全体919件が成功（1322348 ms、斜交円柱を含み、失敗・スキップ0）。版107の全体回帰は実行中です。版111の全体回帰はその後に並列数2で実行する待機ジョブとして登録しました。版108/109の診断は、修正版111で同じ全ケースと追加検査が成功した後に終了しました。旧実行の成功とは扱いません。

## 円柱壁セルの両側評価・所有・境界選択

`classifyCylinderMaterialWall3`、`boundaryCylinderMaterialWall3`、`boundaryCylinderMaterialSurfaces3` を追加し、所有された有限円柱の全周壁分割を材料式の両側評価へ接続しました。支持の一致だけでなく有限高さ帯の包含を確認して所有を決め、部分重複の外側の帯を保持します。内側の空隙は向きを反転し、SSI曲線も共通縫合に渡します。材料ASTの評価は既存照会・平面・曲面で共通化しました。[契約](cylinder-material-surfaces3.md)を参照してください。

新規8件を含む関連30件が成功（77597 ms、失敗・スキップ0）。単一・空隙・反転非単位軸・高さの部分重複・SSI・空・離れた成分・接線を検査しました。平面側と合わせた閉じた接続、別々の2シェル、接触の非多様体診断を確認しています。箱ではガード円柱の曲面を生成しない追加検査も成功。型検査は隔離ビルドの宣言ファイルで行い、既存133宣言の限定監査も成功しました。一般曲面の分類や全体ソリッドの採用は引き続き未完成です。

版107の全体923件が成功（1391520 ms、斜交ケースを含み、失敗・スキップ0）。待機していた版111の全体回帰は開始済みです。今回の版113は、その後に並列数2で全体検証する待機ジョブとして登録します。これらの検証範囲は区別します。

## 材料全体の共有境界を一つのAPIへ集約

`boundaryMaterialSurfaces3` で、平面と円柱の全選択をまとめ、元のセルと全体の共有辺の対応を保持します。全辺の向き付き使用が釣り合うことと空材料の一致を検査し、特異接触は診断として保持するか、閉じた多様体を要求して拒否します。[契約](material-surface-boundary3.md)を参照してください。接続の成立と全体の埋め込み・Body採用を区別します。

統合8件が成功（8095 ms、失敗・スキップ0）。閉じた内部空洞の内向きシェル、全曲面SSI、分離成分、接線、空、箱の幾何検査とBody保存復元、部分的な高さの重複を確認しました。型検査と既存133宣言の限定監査も成功しました。入力は現在、既存の材料ファクトリーで所有された結果であり、定義のみからの独立したプログラム所有モデルは後続です。

版111の全体931件が成功（1240778 ms、斜交ケースを含み、失敗・スキップ0）。待機していた版113の全体回帰は開始済みです。今回の版114は、その後に並列数2で検証する待機ジョブとして登録します。各版の成功と待機を混同しません。

## 境界構築前の材料プログラムを独立化

`prepareCylinderMaterialProgram3` へ入力のスナップショット、式の参照・循環検査、有界性の保守的判定、所有管理を切り出しました。旧境界構築も同じ処理を使い、実際のプログラムはWeakMapで保持します。[契約と残課題](cylinder-material-program3.md)を参照してください。

新規3件を含む材料式・統合境界17件が成功（10214 ms、失敗・スキップ0）。隔離ビルドと新規テストの型検査も成功しました。新しい統合境界の入力をプログラムへ変更する作業はまだ残っており、独立パイプラインの完成とは扱いません。

## 定義から直接平面境界を構築

平面セルの材料分類と全候補平面の境界構築を、所有された材料プログラムの直接入力へ接続しました。既存境界入力も維持し、保持されたプログラムへ解決します。再分割も同じ入力所有を引き継ぎます。円柱壁と全体統合の旧境界依存は残っています。

新規ケースでは、定義だけで円柱の端面を構築しプリミティブ壁と閉じること、六平面の箱を構築して独立した幾何検査で体積1を得ること、斜め切断で従来経路と一致すること、空材料と構造コピーの拒否を検査しました。

新規3件を含む平面分類・再分割・平面境界・統合境界25件が成功（19941 ms、失敗・スキップ0）。隔離ビルドと新規テストの型検査も成功しました。

## 定義から円柱壁・全体境界を直接構築

円柱壁の分類と平面・曲面の統合入口も材料プログラムを直接受理するようにしました。定義入力では有限円柱壁の分割を直接構築し、旧境界入力では所有された既存の分割を再利用します。新パイプラインの実行に旧材料境界の事前構築は不要になりました。出力は入力定義とセルの出自を保持します。接続検査と全体の埋め込み認定・曲面Body採用は区別し、後者は引き続き未完成です。

直接入力8件を含む関連30件が成功（18833 ms、失敗・スキップ0）。追加の入力所有保持1件も成功（636 ms）。隔離ビルド、新規テストの型検査、既存133宣言の限定監査が成功しました。この版の全体回帰は未完了で、旧版の全体検証とは区別します。

## 有限曲線の平面セルを保存・復元

共通Bodyへの接続の前提として `planar-curve-partition-cell` を追加しました。基底領域・有限カット曲線・厳密な内部点・向きから分割を再構築し、一意なセルを選びます。復元された面領域の完全な境界と保存された共有辺の使用も既存の検査で照合します。[契約](planar-curve-cell-codec3.md)を参照してください。

円と有限線分を含む全セルの保存復元、独立した点格子での位置分類、反転、不正な内部点・参照・所有の拒否を含む関連17件が成功（13056 ms、失敗・スキップ0）。隔離ビルドと新規テストの型検査、既存133宣言の限定監査も成功しました。材料領域の認定と曲面Body採用はまだ残っています。

従来の平面・円柱セルの保存復元8件も成功（19977 ms、失敗・スキップ0）。旧形式の復元経路を維持していることを確認しました。

## 統合境界を再構築可能な面領域付きレコードへ変換

`bodyRecordFromMaterialSurfaceBoundary3` を追加し、統合境界の各面の出自から平面曲線セルまたは円柱の支持面分割セルを記録します。JSON往復後に各領域を再計算し、完全な境界と共有辺の使用を検査できます。[契約](material-surface-record3.md)を参照してください。呼び出し側の領域ラベルは材料認定ではなく、曲面Body採用はまだ後続です。

実際のSSI曲線を持つ交差、内部空洞の向き、空、改変した向きの拒否を含む関連14件が成功（11902 ms、失敗・スキップ0）。隔離ビルドとテスト型検査、既存133宣言の限定監査も成功しました。

版113の全体939件が成功（1321220 ms、斜交ケースを含み、失敗・スキップ0）。版114の全体回帰は実行中です。最新版119の全ソースとテストを隔離し、版114の後に並列数2で全体回帰を行う待機ジョブを登録しました。待機中を成功とは扱いません。

## 直接構築した境界のシェル・材料領域解析

`materialSurfaceRegions3` を既存の厳密な直線交差による領域解析へ接続しました。所有された有限円柱・半空間の構築境界を要求し、面領域を再構築後、シェルの包含・向き・厳密な材料式との一致を確認します。任意の閉じた輸入接続や構造コピーは受け入れません。[契約](material-surface-regions3.md)を参照してください。

新規4件を含む保存復元と領域解析7件が成功（6443 ms、失敗・スキップ0）。空洞の親子関係、分離成分、空、接線非多様体の拒否、実際のSSI曲線を持つ境界の外向き根シェルを確認しました。旧材料境界の証人判定もプログラムの厳密な判定へ共通化し、隔離ビルド・新規テストの型検査・既存133宣言の限定監査が成功しました。共通化後の旧Body保存復元を含む追加回帰は実行中で、成功とはまだ扱いません。共通Bodyへの新経路の採用は後続です。

共通化後の追加回帰13件が成功（81967 ms、失敗・スキップ0）。新しい領域解析・面レコード復元に加え、従来のBodyブーリアン・内部空洞と島・連続演算・改変拒否・SSIと反転半空間の保存復元を確認しました。

## 直接構築した境界の正則化位置判定

共通Bodyの位置照会に必要な `locateMaterialSurfaceBoundary3` を追加しました。選択済みの有限面に属する点を境界とし、消えたプリミティブ継ぎ目は正確な微小直線方向の符号から材料式を評価します。支持面に乗るだけで境界へ分類せず、epsilonも使いません。[契約](material-surface-locate3.md)を参照してください。

新規3件と領域解析4件の計7件が成功（4674 ms、失敗・スキップ0）。面・辺・範囲外、消えた内部端面、非活性な平面、空材料、代数的な面内部点を確認し、斜め切断は405点の格子で従来経路と一致しました。隔離ビルドと新規テスト型検査も成功しました。共通Body採用と保存復元の接続は後続です。

既存133宣言の限定監査も成功しました。実行コード全体の形式検証や最新版の全体回帰の完了を意味しません。

## 直接構築した材料境界を共通Bodyへ採用

`bodyFromMaterialSurfaceBoundary3` を追加し、面領域の再構築・シェル領域解析・正確な位置判定を既存Bodyの所有モデルへ接続しました。新構築種別 `surface-material-expression` を定義から再実行して保存レコードと照合します。旧構築種別の順序と復元経路は維持します。[契約](material-surface-body3.md)を参照してください。新しいBodyの材料定義を合成してブーリアンへ再入力する経路は後続です。

採用・保存復元の新規3件を含む関連10件が成功（10207 ms、失敗・スキップ0）。内部空洞・分離成分・空・SSI・消えた内部端面・改変拒否・非多様体拒否を確認しました。隔離ビルドと新規テストの型検査も成功しました。

既存の構築Body・保存復元16件も成功（5177 ms、失敗・スキップ0）。既存133宣言の限定監査も成功しました。最新版の全体回帰が完了したという意味ではありません。

## 新しい材料Bodyを連続演算へ接続

所有された材料プログラムの論理式を参照番号付きで合成し、局所の切断条件を保持する `booleanCylinderMaterialPrograms3` と、半空間を追加する `clipCylinderMaterialProgram3` を追加しました。共通Bodyの円柱・混合ブーリアンと追加切断は、新しいBodyを含むと定義から新パイプラインを実行します。[契約](material-surface-chain3.md)を参照してください。

隔離ビルド、新規テストの型検査、既存133宣言の限定監査が成功しています。Bodyの採用・保存復元の既存3件も同じビルドで成功しました。新しい連続演算の3件を含む回帰は実行中で、対象プロセスが計算を継続していることを確認しています。連続演算の成功や最新版の全体回帰の成功とはまだ扱いません。

## 混合連続演算の分割と証人点の膨張を診断

版123の段階付き再現では円柱同士の4演算と和→差→切断が完了し、箱との混合差に時間がかかることを特定しました。所有したランダムポートのInspectorで、全支持の分割と代数的線分の端点平均の体の合成を確認しました。採取を終えた診断プロセスは終了し、回帰ジョブの成功とは扱いません。

材料ASTの保守的な真偽範囲から両側の結果が確定するときは不要な再分割を避けます。完全なゼロキャリア上の区間では確認済み支持直線から厳密な内部点を選び、端点同士の体の合成を避けます。[契約](planar-material-range3.md)を参照してください。新規4件が成功（1173 ms、失敗・スキップ0）。隔離ビルドも成功しています。版126の連続演算を含む回帰は実行中で、箱との演算が解消したとはまだ主張しません。版123・124・125の旧回帰も途中結果を成功へ読み替えません。

新規4件の型検査と既存133宣言の限定監査も成功しました。

## 楕円弧の証人点でも座標の構築を省略

版126の箱再現のスタックで、楕円弧の端点のチャート座標を構築する処理が平方根像・多項式の隔離へ進んでいることを確認しました。象限と位相は正確な線形式の符号のみで決め、最終の弧内部判定は維持しました。取得を終えた診断プロセスは終了し、成功した回帰としては数えません。

非直交フレーム・結合した二次像端点・全24通りの象限/方向を含む17件が成功（982 ms、失敗・スキップ0）。隔離ビルド、新規テストの型検査、既存133宣言の限定監査も成功しました。最新版127の連続演算を含む回帰は継続中です。箱の演算全体が完了したとはまだ扱いません。

## ゼロキャリアの支持記録の欠落を修正

最新版の観測から、移動した平面の完全なゼロキャリアで既知の支持記録が失われ、後続処理が端点の一般的な合成へ戻ることを特定しました。キャリア構築時に両端点の支持を二つの独立な有理法線で検査し記録します。不変の所有された楕円弧の検査済み内部点も再利用します。

版128で、円柱同士の4演算と保存復元後の連続和→差→切断、および箱との混合差と保存復元が完了しました。ただし同じ回帰の証人点テスト1件は、未使用の平面上の点にinsideを期待しており、契約どおりのnullで失敗しました。点を全支持から離して修正し、版129で再検証しています。版128全体を成功とは扱いません。

修正前123〜126の回帰は、旧版がCPUを共有していたため終了し、成功とは扱わずログと対象記録を保持しました（`/tmp/cadloom-retired-pre127-regressions.json`）。版127も修正版128で混合演算の完了を確認後に終了しました。診断プロセスの終了を成功したテストへ読み替えません。

版129の最終関連30件が成功（70912 ms、失敗・スキップ0）。円柱同士の4演算、復元後の和→差→切断、箱との混合差と復元、局所半空間の参照番号の対応、楕円の位相と交差、支持分類と再分割を確認しました。最終ビルド、新規テストの型検査、既存133宣言の限定監査も成功しました。

前版114の全体947件が成功（1648317 ms、斜交ケースを含み、失敗・スキップ0）。版119の全体回帰が開始済みです。最新版129は全ソースと全テストを隔離し、版119の後に並列数2で実行する待機ジョブを登録しました。最新版の全体成功とはまだ扱いません。

## 既存Body対から共通材料カーネルへ直接入る

`booleanMaterialBodies3` を追加し、入力が両方とも従来方式のBodyでも、定義から新しい共通パイプラインを実行できるようにしました。箱の定義生成は `prepareBoxMaterialProgram3` に切り出し、円柱・切断円柱と合わせて旧境界の事前構築を省略します。旧入口の旧入力対と保存形式は維持します。[契約](material-body-entry3.md)を参照してください。一般平面や押し出しの全変換が旧境界から独立したという意味ではありません。

新規3件を含む入口・連続演算6件が成功（87037 ms、失敗・スキップ0）。従来の箱材料変換3件も成功（53183 ms）し、全4演算の独立した厳密述語との一致と保存復元を確認しました。箱の定義の729点の独立照合は、未確定点を除外せず全点で成功しています。隔離ビルド、新規テストの型検査、既存133宣言の限定監査も成功しました。最新版の全体回帰の完了とは区別します。

## 平面と直線押し出しを定義へ直接変換

`preparePlanarMaterialProgram3` を追加し、凸材料の支持半空間と一般の物理平面chamberの結果を、旧境界を構築せず所有された材料プログラムへ変換します。新共通Body入口の平面・直線押し出し変換がこの定義を直接使います。旧境界入口は同じ定義から従来の境界を構築し、旧保存形式の列挙順を維持します。[契約](planar-program-lowering3.md)を参照してください。

新規2件を含む入口・平面変換5件が成功（15572 ms、失敗・スキップ0）。L字と空材料の定義を独立した格子述語と照合し、復元した凹な直線押し出しを新カーネルで演算・保存復元して欠けた角を保持しました。隔離ビルド、新規テストの型検査、既存133宣言の限定監査も成功しました。円弧押し出し等の残る変換は後続です。

従来の凸変換・平面chamberの選択回帰8件も成功（30512 ms、失敗・スキップ0）。凸の支持・反射とせん断・凹材料の拒否・空洞と島と分離成分・極薄セル・空材料・空洞境界の保存復元を確認しました。最新版の全体回帰完了とは区別します。

## 多角形と円形の押し出しループを共通定義へ変換

`prepareExtrudeMaterialProgram3` を追加し、所有された正規化済み押し出しの各多角形・完全円ループを定義へ変換してパリティで合成します。新共通Body入口は旧円形境界の事前構築なしにこの定義を使います。旧円形入口は同じ完全円の幾何検査を使い、従来の保存復元を維持します。[契約](product-extrude-program3.md)を参照してください。

新規3件を含む平面・押し出し変換5件が成功（10787 ms、失敗・スキップ0）。負の高さと非ゼロ基準の多角形板＋円形貫通穴を新経路で演算・保存復元し、独立した格子述語、穴の境界と端面、円環のパリティ、混合した部分円弧ループの拒否を確認しました。隔離ビルドと新規テスト型検査も成功しました。一般の同一ループ内の直線・円弧混合は未対応です。

円形穴内の多角形の材料島を追加し、新しい押し出し変換の最終4件が成功（12246 ms、失敗・スキップ0）。従来の円形押し出しの選択回帰5件も成功（12506 ms）し、円環・島と分離成分・nonzero正規化・未対応の複数円支持ループの拒否・無理数半径と分数高さを確認しました。最終テストの型検査と既存133宣言の限定監査も成功しました。最新版の全体回帰完了とは区別します。

## 同一ループの直線・円弧を厳密な領域照合で変換

円弧混合ループでは、直線の半空間と円の内外から候補を構築し、元の充填領域との2D XORが空であることを検査します。一致した候補だけを有理多角形と有限円柱の積・差へ変換します。[契約](supported-profile-program3.md)を参照してください。一般の領域分解コンパイラーではなく、一致しない支持条件へ形状を置き換えることはありません。

新規3件を含む押し出し変換7件が成功（11663 ms、失敗・スキップ0）。D形の共通Body保存復元、無理数端点を持つ2円レンズと独立した円不等式の格子照合、誤った支持の積となるスタジアム形状の拒否を確認しました。隔離ビルドと既存133宣言の限定監査も成功しています。

時計回り円弧の切欠きを追加し、最終の支持条件変換4件が成功（8574 ms、失敗・スキップ0）。切欠きは円ディスクの充填へ反転せず、有界な差として独立した内外判定と一致しました。最終テストの型検査も成功しました。既存の多角形・円形押し出し4件も同じ実行コードで成功済みです。最新版の全体回帰の完了とは区別します。

## 支持ディスクの和を候補へ追加

積・差だけでは一致しなかったプロファイルに、有理な直線端点の凸包と正向き円ディスクの和、負向き円ディスクとの差を候補として加えました。円のみの場合は多角形の種を要求しません。候補全体と元の充填領域の2D XORが空になる場合だけ材料定義へ変換します。凸包で凹部を埋める候補は受理しません。

スタジアム形状の共通Body保存復元、円ディスクの和と独立した不等式、凹な丸み付きL字の拒否を含む関連10件が成功（42948 ms、失敗・スキップ0）。D形・レンズ・切欠き・穴と材料島の回帰も維持しています。隔離ビルド、新規テスト型検査、既存133宣言の限定監査も成功しました。

版119の全体967件が成功（1411962 ms、斜交ケースを含み、失敗・スキップ0）。版129の全体回帰は開始済みです。最新版の全体回帰成功とは区別します。

最新版134は全ソース・全テストを隔離し、版129の後に並列数2で実行する全体回帰を待機登録しました。待機を成功とは扱いません。

## 有理端点の円弧混合境界を弦と弓形へ分解

支持条件の候補では一致しなかった有理端点のプロファイルに、弦の多角形と各弓形のXOR分解を追加しました。弓形は有限円柱と向き付き弦半空間の積にし、候補全体と元の2D充填領域の一致を検査します。[契約](chord-profile-program3.md)を参照してください。無理数の端点を丸めて受理することはありません。

凹な丸み付きL字の共通Body保存復元、D形・レンズ・スタジアム・切欠き・穴と島を含む10件が成功（57930 ms、失敗・スキップ0）。小さい/大きい弓形と独立した不等式の格子照合、弦分解の無理数端点拒否と他の正確な支持経路の維持の追加2件も成功（459 ms）。隔離ビルド、新規テストの型検査、既存133宣言の限定監査も成功しました。最新版の全体回帰完了と一般の全プロファイル対応とは区別します。

## 共通Bodyの直線・前方レイ照会

`intersectBodyLine3` と `intersectBodyRay3` を追加し、所有されたBodyの有限面領域を復元・結合検査した上で、既存の厳密な支持交差へ接続しました。符号付きパラメータ・代数的交点・面番号・重複度を保持し、支持面包含や共有辺の曖昧さは明示的な退化として返します。[契約](body-query3.md)を参照してください。

新規4件と既存の構築Body回帰16件、計20件が成功（7526 ms、失敗・スキップ0）。箱の方向スケール、前方/両側、始点境界、無理数円柱根、接線二重根、空洞・分離成分・空、シェル選択、所有と不正方向/番号の拒否を確認しました。有理な値も代数的表現で返ることを前提に厳密比較で照合しています。隔離ビルド、新規テスト型検査、既存133宣言の限定監査も成功しました。最新版の全体回帰の完了とは区別します。

## 共通Bodyと直線の材料区間を構築

`intersectBodyLineMaterial3` を追加し、全境界イベント間の厳密な有理証人をBody位置判定へ渡して、最大の閉材料区間と孤立接触を構築します。空洞の内側の区間を除外し、内部接線で閉区間を不必要に分割しません。退化した境界照会では区間を推測しません。[契約](body-line-material3.md)を参照してください。

新規4件と境界照会4件の計8件が成功（16728 ms、失敗・スキップ0）。符号付き非単位パラメータ、空洞・分離成分・空、独立した有理の材料不等式、孤立接線、空洞への内部接触、包含面の退化、所有と零方向の拒否を確認しました。隔離ビルドと新規テスト型検査も成功しました。最新版の全体回帰完了とは区別します。

既存133宣言の限定監査も成功しました。新しい照会を含むTypeScript全体の形式検証を意味しません。

## 共通Bodyの有理相似変換

`similarityTransform3` と `transformBody3` を追加しました。有理列ベクトルの直交性と等長性を厳密に検査し、移動・対応する回転・一様拡大縮小・反射を定義へ反映します。せん断や非一様拡大は円柱の型を保てないため拒否します。平面の逆転置と円柱半径/軸範囲の対応は[契約と式](body-similarity3.md)を参照してください。変換済みの定義から共通Bodyを再構築し、旧Bodyや旧レシピを変更しません。

初回の新規4件と交差照会4件、計8件が成功（7176 ms、失敗・スキップ0）。独立した1000点の材料述語、変換前後の直線パラメータ、反射・拡大後の箱の正確な体積192と重心、保存復元、入力所有と不正行列の拒否を確認しました。隔離ビルドと初回新規テストの型検査も成功しました。

変換後の復元・ブーリアン・再変換と空材料を追加し、最終の相似変換5件が成功（10240 ms、失敗・スキップ0）。最終テスト型検査と既存133宣言の限定監査も成功しました。

版129の全体985件が成功（1253868 ms、斜交ケースを含み、失敗・スキップ0）。版134の全体回帰は開始済みです。最新版138の全ソース・全テストを隔離し、その後に並列数2で実行する待機ジョブを登録しました。最新版の全体回帰成功とはまだ扱いません。

## 相似変換の合成・逆変換

`composeSimilarityTransforms3` と `inverseSimilarityTransform3` を追加し、線形部・移動を有理数のまま合成/反転して再度相似条件を検査します。合成の順序はfirstの後にsecondです。[契約](body-similarity3.md)を参照してください。

新規2件と変換回帰5件の計7件が成功（9323 ms、失敗・スキップ0）。175点の有理格子で順序・点とベクトルの対応・左右の逆・結合則を確認し、Bodyの合成/逐次変換・保存復元・逆変換で材料位置と直線交点のパラメータが一致しました。隔離ビルドと新規テスト型検査も成功しています。

既存133宣言の限定監査も成功しました。最新版の全体回帰完了や新コード全体の形式検証を意味しません。

## 最近点と厳密な距離の二乗

`closestPointOnLine3`、`closestPointOnSegment3`、`closestPointOnSurface3` を追加しました。有理点から直線・閉線分・平面・無限円柱への最近点を求め、円柱の二次の依存も保持します。軸上は任意の一点へ決めず、最近点全体の円を返します。[契約](closest-point3.md)を参照してください。トリムされた面やBody全体の最近点とは区別します。

初回の新規4件と相似変換回帰2件の計6件が成功（7103 ms、失敗・スキップ0）。直線の非単位/反転パラメータ、線分の両端と退化、平面の独立した有理投影、円柱の無理数点・軸上の非一意性、独立した有理表面候補への最小距離比較、内部/支持上の点を確認しました。

相似変換での最近点/距離の二乗の対応と不正支持の拒否を追加し、最終の最近点5件が成功（172 ms、失敗・スキップ0）。隔離ビルド、最終テスト型検査、既存133宣言の限定監査も成功しました。最新版の全体回帰の完了とは区別します。

## 空間円・有限円弧の最近点集合

`closestPointOnCircle3` と `closestPointOnCircularArc3` を追加しました。空間円の法線方向の距離も保持し、有限弧への包含と端点の距離を検査します。同距離の両端点・弧全体の最近点集合・零長弧を区別します。[契約](closest-point3.md)を参照してください。無理数端点の距離は円の恒等式を使った線形式で評価し、独立な平方の合成を避けます。

新規4件と支持の最近点回帰5件、計9件が成功（379 ms、失敗・スキップ0）。非単位法線と傾いた円、法線軸上の非一意性、弧内部・端点・同距離端点、反転・全円・点弧、無理数端点、改変弧の拒否を確認しました。隔離ビルドと新規テスト型検査も成功しました。Body全体の最近点と最新版の全体回帰完了とは区別します。

既存133宣言の限定監査も成功しました。新しい距離照会の実行コード全体の形式検証を意味しません。

## 有限な平面Body境界の最近点

`closestPointOnPlanarBodyBoundary3` と所有された平面ソリッド用の入口を追加しました。面の直交投影を有限領域で検査し、外れる場合は全辺の最近点を比較します。全シェル・成分の同距離点を重複なく保持し、穴へ落ちた支持面の足を採用しません。[契約](planar-body-closest3.md)を参照してください。曲面や非有理頂点のBodyは明示的に拒否します。

初回の新規4件と支持の最近点回帰5件、計9件が成功（6943 ms、失敗・スキップ0）。面・辺・頂点、箱内部の6同距離点、貫通穴、凹部、内部空洞、分離成分、相似変換、空と曲面拒否を確認しました。隔離ビルドと新規テスト型検査も成功しました。

巨大な10^30の移動と10^-40の隙間を追加し、最終の平面Body境界5件が成功（5531 ms、失敗・スキップ0）。距離の二乗10^-80を正の有理値として保持しました。最終テスト型検査と既存133宣言の限定監査も成功しました。

版134の全体1000件が成功（1306327 ms、斜交ケースを含み、失敗・スキップ0）。版138の全体回帰が開始済みです。最新版142の全ソース・全テストを隔離し、その後に並列数2で実行する待機ジョブを登録しました。最新版の全体回帰成功とはまだ扱いません。


## 接触材料の保存・再演算への統合（版145）

[平面材料API](planar-material3.md) を追加しました。共通Bodyと所有された平面材料を同じBoolean入口で受け、辺・頂点接触を保持します。構築定義の共有DAGを正確な有理座標で保存し、復元時に全立体葉を幾何検査して再演算します。有理数／代数的数の点分類、空・空洞、接触を解消した結果のBodyへの再採用を接続しました。Body自体の多様体条件は維持します。一般曲面との混合演算・接触領域の共通Body化は未完了です。

新規4件と既存34件の回帰が成功（38件、7836 ms、失敗・スキップ0）。独立した箱の不等式で接触和の分類を追加照合した最終4件も成功（1619 ms）、テストの型検査とソースビルドが成功しました。既存133宣言の限定監査も成功しましたが、新APIやTypeScript実行全体の形式証明を意味しません。

版138の全体回帰は1015件成功（1362061 ms、失敗・スキップ0）。版142の全体回帰の生存を確認し、版145のソース・最終テスト・fixturesを隔離して、その終了後に並列数2で実行する待機ジョブを登録しました。版145の全体回帰はまだ成功とは扱いません。


## 接触材料の領域解析（版146）

[平面材料の領域解析](planar-material-regions3.md)を追加しました。物理支持平面の配置セルを厳密に構築し、面を共有する同じ材料のセルを接続します。辺・頂点だけの接触、橋による再接続、有限空洞と外部につながる貫通穴を区別します。各領域の厳密な内部点、有限領域の有理体積、元面から分割された境界片と材料側／空領域側の対応を返します。共通Body自体への非多様体領域の採用はまだ行いません。

新規5件を含む関連43件が成功（12596 ms、失敗・スキップ0）、最終テストの型検査と隔離ソースビルド、既存133宣言の限定監査も成功しました。一般曲面の領域解析や実行コード全体の形式証明を主張しません。

版142の全体回帰は1031件成功（1250128 ms、失敗・スキップ0）。版145の全体回帰は開始済みで、版146の成功と混同しません。

レビュー対象だけを抽出したステージ済みソースも隔離ビルドし、関連43件が成功（11068 ms）。ステージ済みの全ソースハッシュとマニフェストの一致を確認しました。このスナップショットの全体回帰を版145の実行後に並列数2で開始する待機ジョブへ登録しました。未コミットの有限円柱最近点変更は、このレビュー対象に含めません。


## 面の両側の領域を持つBodyへの接続（版147）

[CellularBody](cellular-body3.md)を追加しました。接触する平面材料について、厳密な領域解析で分割された面を共通の幾何・接続表へ保存し、各面の負側／正側の領域を明示します。殻を材料成分と読み替えず、有限材料・有限空洞・外部を区別します。有限面の支持・向き・全境界を照合し、構築DAGからの再構築で保存された境界・領域・体積・内部点の改ざんを拒否します。再演算で多様体へ戻った結果は既存Bodyへ再採用できます。

既存Bodyの保存形式は維持し、境界表の構造スキーマを共用します。CellularBodyは別の所有モデルであり、既存Bodyの全操作が接触を受理するようになったとは扱いません。一般曲面の領域分解、変換・照会の共通入口、任意の輸入BRepの認定は残ります。

最終のレビュー対象だけを抽出した隔離ビルドで、新規4件と既存46件の計50件が成功（13540 ms、失敗・スキップ0）。保存された有限面の内部点が元材料の境界に属すること、元材料の面ID対応、既存Bodyレコード・構築・復元の回帰を含みます。最終テストの型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript全体の形式証明は主張しません。版146の待機プロセスの生存を確認し、その終了後に並列数2で全体回帰を開始するジョブを登録しました。最新版の全体回帰は未完了です。


## CellularBodyの共通照会・変換（版148）

既存の `intersectBodyLine3`・`intersectBodyRay3`・`intersectBodyLineMaterial3` が所有されたBodyとCellularBodyを受けるようにしました。有限面の全境界照合を通して実際の面IDで交差を返し、材料区間はCellularBody自身の所有材料で分類します。辺・頂点の特異交差や支持面包含は退化として保持します。シェル指定は境界の辺接続シェルであり、開いた材料成分の指定ではありません。

`transformBody3` はCellularBody入力にCellularBodyを返します。`transformPlanarMaterial3` で構築DAGの共有部分を保って葉を変換し、反射では面順を補正して、Boolean・材料領域・両側の面対応を再構築します。既存Body入力の経路と戻り値は維持します。

レビュー対象だけの隔離ビルドで、新規5件を含む28件が成功（24871 ms、失敗・スキップ0）。反射・拡大・逆変換・保存復元、領域の体積、直線パラメータの不変性、有限空洞・空結果・シェル指定・所有検査を確認しました。10^30の移動と10^-40の隙間でも別の材料区間を保持します。最終テスト型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript実行全体の形式証明ではありません。

版145の全体回帰は1040件成功（1296966 ms、失敗・スキップ0）。版146の全体回帰と版147の待機プロセスの生存を確認し、版148の全ソース・全テスト・fixturesを隔離して版147の後に並列数2で実行する待機ジョブを登録しました。版148の全体回帰成功とは扱いません。

一般曲面のCellularBody、任意BRepの認定、最近点・質量特性などの共通入口の統合は残っています。


## 接触材料の最近点・質量特性（版149）

`closestPointOnPlanarBodyBoundary3` と `planarBodyVolumeMoments3` をCellularBodyへ接続しました。Bodyの多様体条件を緩めず、検査済みBoolean材料の実際の境界を直接使います。低水準の最近点・モーメント処理も所有されたBoolean結果を受理し、`PlanarMaterial3` の公開入口を追加しました。辺・頂点接触は体積に重複加算せず、選択済み境界の向き付き積分を維持します。最近点では接触点と同距離の点を保持し、消去した共有内部面を候補へ戻しません。

レビュー対象だけの隔離ビルドで、新規5件と既存27件の計32件が成功（11850 ms、失敗・スキップ0）。独立した箱の解析式と符号付き加減算により、辺・頂点接触、接触空洞の差、重なるXOR、空材料の体積・重心・両慣性テンソルを照合しました。反射・拡大後の体積、重心、中心慣性、距離の二乗と最近点集合を検査し、10^30の移動と10^-40の隙間でも正の最近距離を保持しました。最終テスト型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しましたが、新APIや実行コード全体の形式証明ではありません。

版148の待機プロセスの生存を確認し、版149の全ソース・全テスト・fixturesを隔離して、その後に並列数2で全体回帰を実行する待機ジョブを登録しました。最新版の全体回帰は未完了です。未コミットの有限円柱最近点処理はレビュー対象に含めません。一般曲面のCellularBody、曲面の最近点・質量特性、任意BRepの認定は残ります。


## 位置判定・保存復元の共通入口（版150）

[共通Body入口](common-body-facade3.md)として `KernelBody3` を公開し、`locateBody3`・`locateBodyFace3`・`bodyDocument3`・`serializeBody3`・`restoreBody3` からCellularBodyも扱えるようにしました。CellularBodyの所有と位置判定をモデル層へ移し、材料構築と全境界照合を通した公開経路だけを登録します。既存Bodyの多様体条件と保存形式は維持します。

型付き文書と `serializeBody3` のコンパイル時の文字列型からは、対応するBody族を復元します。呼び出し側が付けた任意の追加プロパティを復元すると型付けしません。未知入力の戻り値は `KernelBody3` とし、必ず多様体Bodyであるとは宣言しません。既存の任意データを使う一つのテストは、通常Body文書の構造読取を通してから、従来通り意味的に同値な数値表現の復元を検査するよう変更しました。

最終のレビュー対象の隔離ビルドとテストで、新規4件と既存51件の計55件が成功（13678 ms、失敗・スキップ0）。共通入口のみでの接触Body保存復元、面の位置判定、変換・直線材料区間・最近点・質量特性、改ざん拒否、両文書族の予算、旧BodyのJSON形式と再構築を確認しました。新規テストと既存構築・平面Bodyテストの型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript全体の形式証明ではありません。

版146の全体回帰は1040件成功（1284024 ms、失敗・スキップ0）。版147の実行と版149の待機プロセスの生存を確認し、版150の全ソース・最終テスト・fixturesを隔離して、版149の後に並列数2で全体回帰するジョブを登録しました。最新版の全体回帰は未完了です。

一般曲面のCellularBody、任意BRepの認定、すべての生成・編集操作の共通化は残ります。未コミットの有限円柱最近点変更はこのレビュー対象には含めません。


## 接触を保持する共通Booleanと曲面への材料定義接続（版151）

[共通Boolean入口](material-body-entry3.md)へ `contacts:'preserve'` を追加しました。対応する有理平面入力対では、辺・頂点接触を含めCellularBodyとして結果を返し、共通保存復元後も同じ入口で再演算できます。通常Body同士でオプションを省略した多様体限定経路と戻り値は維持します。CellularBody入力の既定値は接触保持です。

`materialProgramOfPlanarMaterial3` は、所有された構築DAGの検査済み立体葉を共通の有界材料プログラムへ変換し、局所式を保って合成します。CellularBodyと対応する曲面Bodyを組み合わせた結果が多様体なら、既存の完全な境界・領域検査から通常Bodyへ接続できます。曲面を含む非多様体のCellularBody化は未完了で、保持モードでも未対応結果を捨てて成功させません。プログラム合成時に表と式が展開され得るため、最終プログラムの大きさをDAGと同じとは保証しません。

レビュー対象だけの隔離ビルドで、新規5件と既存16件の計21件が成功（54941 ms、失敗・スキップ0）。独立した箱の真理値によるコンパイル結果の照合、辺・頂点接触、同一形状・面接触・XOR・空洞・空結果、保存復元と再演算、所有・方針検査、旧多様体限定経路を確認しました。接触する二つの箱と、一方の内部に収まる有限円柱との積は、曲面を保った通常Bodyとなり、独立した円柱不等式と保存復元で照合しました。このケースは最終回帰で約38764 msを要しており、実用性能の改善は必要です。最終テストと既存入口・共通保存復元テストの型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript全体の形式証明ではありません。

版150の待機プロセスの生存を確認し、版151の全ソース・全テスト・fixturesを隔離して、その後に並列数2で全体回帰するジョブを登録しました。最新版の全体回帰は未完了です。一般曲面のCellularBody、任意BRepの認定、他の生成・編集操作の共通化は残ります。未コミットの有限円柱最近点変更はレビュー対象には含めません。


## プロファイルに基づく楕円照会の再利用（版152）

[楕円照会の再利用](ellipse-query-reuse3.md)を追加しました。共通曲面BooleanのCPUプロファイルで、楕円弧の点判定・角度比較と、そのための有理数・多項式演算が目立ちました。検査済みで深く不変な楕円の同一性をスナップショットで保持し、支持平面・双対ベクトル・点分類・半周分類・角度比較を弱参照で再利用します。外部構造コピーと点は改めてスナップショットし、変更された入力へ古い答えを返しません。交差候補や境界の完全照合は省略しません。

レビュー対象だけの隔離ビルドで、新規3件を含む関連29件が成功（31696 ms、失敗・スキップ0）。独立した局所二次不等式、位相順・継ぎ目と反転、変更された外部フレーム・半径・点、SSI・独立した代数的端点・共通Booleanと旧入口を確認しました。最終テストと同梱ベンチマークの型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript全体の形式証明ではありません。

合成形状の積と再構築の一回ずつの比較では、合計48293 msから23097 msへ短縮し、全保存結果がバイト単位で一致しました。同梱ベンチマークの再実行では合計28328 ms、同じハッシュでした。旧版の全体回帰が並行しているため、一定の高速化率や任意モデルの実用性能は保証しません。メモリ使用にも固定上限は設けていません。

版147の全体回帰は1044件成功（1236640 ms、失敗・スキップ0）。版151の待機プロセスの生存を確認し、版152の全ソース・全テスト・fixturesを隔離して、その後に並列数2で全体回帰するジョブを登録しました。最新版の全体回帰は未完了です。一般曲面のCellularBody・任意BRepの認定・他の生成編集操作の共通化・実用性能の改善は残ります。未コミットの有限円柱最近点変更はレビュー対象には含めません。


## 有理平面材料の切断・界面対応・再結合（版153）

[平面Body切断](planar-body-split3.md)を追加しました。所有された通常Body／CellularBodyの有理平面材料を閉半空間へ分け、穴・空洞・非凸・分離成分・接触を保つ子を返します。材料全体を厳密に囲む箱で半空間を有限化して既存の正確なBooleanを使い、ガード面を子の物理境界へ追加しません。両側の体積和と閉半空間内への包含を検査します。

新しい界面は、親の材料内部にある切断面片だけを両側の実際の面IDで対応し、物理的な向きと厳密な凸領域の一致を検査します。既存の境界が切断平面と一致して片側だけへ残る場合は、新しい界面へ数えません。再結合は実際の和を計算し、元材料との正則化XORが空であることを検査します。子は共通APIで保存復元・再切断できます。切断メタデータの復元、親面／coedgeの完全な由来表、一般曲面の共通切断は後続です。

最終のレビュー対象の隔離ビルドで、新規8件と既存23件の計31件が成功（17644 ms、失敗・スキップ0）。既知の斜め六角形、穴の面積、空洞の開口・壁との一致、接触、三角形分割・平面の符号、変わった外部平面入力、保存復元と再結合、12個の正負有理係数平面に対する独立した包除原理の体積式を確認しました。10^30の移動と10^-40の切断幅も非空の体積として保持しました。最終テスト型検査、ソースハッシュ照合、既存133宣言の限定監査も成功しました。新APIやTypeScript全体の形式証明ではありません。

版148の全体回帰は1049件成功（1266605 ms、失敗・スキップ0）。版152の待機プロセスの生存を確認し、版153の全ソース・最終テスト・fixturesを隔離して、その後に並列数2で全体回帰するジョブを登録しました。最新版の全体回帰は未完了です。一般曲面のCellularBody・任意BRepの認定・残る生成編集操作・実用性能は引き続き必要です。未コミットの有限円柱最近点変更はレビュー対象には含めません。


## カーネル優先と平面切断の由来解析（作業版154）

上位のUI・操作履歴より、共通Body上の幾何・位相と演算の連続性を優先する。次の曲面対応の到達条件は、平面・円柱を含むBodyを切断し、結果へ再切断・Booleanを適用できること。既存の限定された円柱切断と一般の共通切断は区別する。曲面の交線、有限面トリム、共有辺とcoedgeの再構築が残っており、達成済みとはしない。

作業中の平面切断には、任意の追加解析として[境界の由来](planar-split-provenance3.md)を実装した。親の実際の面・辺・coedge・頂点へ対応し、面は正の面積の断片、辺・coedgeは正の長さの正規化区間で照合する。辺の継承と面による辺の使用の継承を区別する。永続的な名前や一般曲面の由来解析ではない。

2026-11-16の作業ツリーを独立ビルド `/tmp/cadloom-provenance-review155-check` で確認。新規6件と既存の平面切断・平面Body・体積慣性の計29件が成功（17539.56075 ms、失敗・スキップ0）。新規テストの型検査も成功。穴付き親面、4つの使用を持つ接触辺、空洞壁、斜め切断と非二進有理パラメータ、空集合と再切断、巨大移動と極小幅を含む。既存133宣言の限定Lean監査も成功したが、新APIの機械証明ではない。さらにレビュー対象だけを取り出した隔離ビルドでも同じ29件が成功（20112.857791 ms、失敗・スキップ0）。新規テストの型検査と対象ソースハッシュ照合も成功。版153の待機プロセスが稼働中であることを確認し、その後に今回の隔離スナップショットの全体回帰を並列数2で実行するジョブを登録した。全体回帰は未完了。

別の確定スナップショットである版150の全体回帰は1058件成功（1268771.898625 ms、失敗・スキップ0）。この結果を現在の未コミット変更の全体成功とは扱わない。


## 平面・曲面Bodyの共通平面切断（版155）

[共通平面切断](body-plane-split3.md) `splitBodyByPlane3` を追加した。平面経路は既存の接触保持切断と由来情報を保持し、曲面経路は親の完全な材料プログラムへ半空間を追加して有限境界を再計算する。共通Booleanと平面経路の判定を共有し、所有チェック後に実行する。一般曲面の新しい交差アルゴリズムを実装したものではなく、既存の平面・円柱を扱う境界生成・トリム・sewing・幾何認定を共通Bodyの切断へ接続した。

レビュー対象だけの隔離ビルドで、新規4件と既存の平面切断・円柱切断・由来解析の計26件が成功（29533.310584 ms、失敗・スキップ0）。斜め切断の楕円トリム、保存復元後の再切断、両子の共通Booleanによる再結合、箱と円柱の積の切断、負の法線と片側空集合、通常平面BodyとCellularBodyの共通入口を確認した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功した。新APIの機械証明やTypeScript全体の形式検証ではない。

版151の全体回帰は1063件成功（1360948.942334 ms、失敗・スキップ0）。版154の待機プロセスが実際に稼働していることを確認し、今回の全ソース・全テスト・fixturesの隔離スナップショットをその後に並列数2で検査するジョブを登録した。最新版の全体回帰は未完了。曲面の親境界由来・両子のcap/coedge対照、曲面の接触保持、一般NURBSと実用性能は残る。未コミットの有限円柱最近点変更とユーザーのpackage.json・demoは含めない。


## 材料プログラムの支持形状統合と論理簡約（版156）

[材料プログラムの整理](compact-material-program3.md)を追加し、共通曲面切断で親と両子の材料式へ適用した。正に比例する半空間の係数だけを同じ変数へまとめ、逆向きは別に保持する。円柱は軸・半径・有限範囲が一致する定義だけを統合する。同一部分式と空集合の基本恒等式で簡約し、参照されない支持形状を除く。再切断で同じ平面が別の支持変数として増えることを抑えるが、完全な式の最小化や固定の式サイズ上限は保証しない。出力の支持形状・面の番号や保存JSONのバイト一致も保証しない。

提出対象だけの隔離ビルドで、新規2件と共通切断・既存材料プログラム境界の計18件が成功（29404.765458 ms、失敗・スキップ0）。512個のseed固定式に対する16通りずつの全真理値、計8192照合を行い、独立したBoolean評価で同値を確認した。正負の平面、異なる有限円柱範囲、空集合、所有チェックとキャッシュ、曲面切断と再切断も確認した。新規テストの型検査、ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新しい機械証明ではない。処理速度の改善率は未測定・未保証。

版155の待機プロセスの稼働を確認し、提出対象の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。曲面の境界対応・一般曲面の接触保持・一般NURBS対応は引き続き必要。


## 共通切断の有限界面とcoedge対応（版157）

[共通切断の界面解析](body-split-interface3.md) `bodySplitInterface3` を追加した。所有された共通切断から、切断界面の負側・正側の実際の面群を選択し、全境界の端点で分割した共通の有限曲線表へ各coedgeを対応する。曲面経路は元支持形状で細分された面セルの内部で元材料の所属が一定であることを利用し、既存の空洞壁を新しい界面から除く。平面経路は既存の界面選択を使う。選択した面の物理法線と、各曲線片に対する両側の向き付き境界の一致を検査する。面を一対一にする仮定は置かず、内部で打ち消される面分割線と外周・穴の輪郭を区別する。

提出対象だけの隔離ビルドで、新規4件と共通切断・平面切断・親境界由来の計22件が成功（55100.5905 ms、失敗・スキップ0）。楕円境界、穴付き断面、内部の分割線、実際のcoedgeの始点から終点までの曲線片の接続、再切断、接するだけの切断、切断面に一致する既存の空洞壁を確認した。最初のテストでは内部で打ち消される向きの総和に対して0と-0のstrictEqual比較が失敗したため、向きの和が0であることを検査するよう修正した。壁の試験点もセル分割線上の点から壁の相対内点へ変更して、旧壁の面IDを独立に確認した。最終テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版156の待機プロセスの稼働を確認し、提出対象の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。共通表はcoedgeの有限区間の対応であり、面群間の全面積オーバーレイや内部の分割線の全内部交差を追加する処理ではない。曲面の親境界由来、一般曲面の接触保持、NURBS、メタデータ保存復元と実用性能は残る。


## 共通切断の界面除去・外側境界の再縫合・再結合（版158）

[共通切断の再結合](rejoin-body-split3.md) `rejoinBodyPlaneSplit3` を追加した。所有された有限界面を検査し、その新しい面群だけを両子から除去して、残る実際の境界をsewingする。それとは別に、両子の材料の和から新しい共通Bodyを生成する。親Bodyをそのまま返さず、任意の縫合表をBodyへ採用する認定の抜け道も作らない。縫合結果の面ごとに子側と実際の面ID、さらに元ループ・coedgeから縫合辺への対応を保持する。生成したBodyと縫合表では分割・IDが異なる場合がある。

提出対象だけの同一ソースの隔離ビルドで、新規4件と既存16件の20件が成功（32793.808333 ms、失敗・スキップ0）。その後に追加したSSI再結合の最終1件も成功（11394.744041 ms、失敗・スキップ0）。新規は計5件で、関連検査は計21件。斜め円柱は独立した半径と有限範囲の不等式、直交する異径円柱の積は両径方向の二次不等式と照合し、代数的SSI辺が再縫合とBodyに残ることも確認した。元の空洞壁の保持、閉じた多様体の接続、4つの使用を持つ平面接触辺、coedgeごとの対応片の接続、片側空集合、全体空集合、保存復元と再切断を確認した。共通Bodyのunion型に対する種類確認をテストで追加した後、最終の新規2ファイルの型検査も成功した。

対象ソースハッシュ照合と既存133宣言の限定Lean監査も成功した。新APIやTypeScript全体の機械証明ではない。曲面の再結合は所有された半空間分割と界面一致に基づき、平面経路は既存の元材料との正則化XOR検査も使う。縫合表だけの接続検査と材料の幾何認定を区別する。

版152の全体回帰は1066件成功（1050358.384459 ms、失敗・スキップ0）。今回の全体回帰は最終のSSI試験と型の修正を反映した隔離テスト表に登録し、全テストが提出対象indexと一致することを照合した。旧い待機スナップショット2件は最終テストへの更新に伴って待機中のPythonプロセスだけを終了し、成功として数えない。最終の待機ログでは版157の先行プロセスが稼働中であり、終了後に並列数2で実行する。今回の全体回帰は未完了。親境界の全面的な由来、一般曲面接触、NURBS、メタデータ保存復元と実用性能は残る。


## NURBS曲面の厳密な二階微分と局所曲率（版159）

[NURBS二階微分と曲率](nurbs-surface-curvature3.md)を追加した。重みを含む各同次成分の商から `duu`・`duv`・`dvv` を有理係数二変数多項式として構成し、正確な代数的パラメータで評価する。一階微分と同じパッチを選ぶため、節点側のオプションは一度読み取って固定する。非単位法線と基本形式からガウス曲率・向き付き平均曲率・昇順の主曲率を計算し、必要な平方根も代数的実数で扱う。特異点は曲率を返さず、節点は指定側の値でありC2連続性を宣言しない。

提出対象だけの隔離ビルドで、新規6件と既存9件の計15件が成功（1329.960083 ms、失敗・スキップ0）。鞍面・放物面・重み付き円柱の独立した解析式、代数的なパラメータ、正則性・特異点、節点の左右差、節点挿入、向きの反転、10^-40のパラメータ区間を確認した。u・v両方に依存する重みについては、明示的な商の微分公式とは別に `W*S=N` のTaylor係数を次数順に解き、一階・二階・混合微分を照合した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功した。新しい曲率APIの機械証明やTypeScript全体の形式検証ではない。

版158最終テスト表の待機プロセスが実際に稼働していることを確認し、今回の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。局所曲率はフィレット・曲面品質判定の土台であり、一般NURBS曲面の交差曲線の列挙と位相接続、NURBS Bodyの採用やフィレットそのものは未実装。カーネル優先の方針を保ち、UI・操作履歴へは進めていない。


## NURBS平面交差枝の微分と空間曲率（版160）

[交差枝の厳密な微分](nurbs-section-differential3.md)を追加した。既存の所有されたパッチ別交差グラフから枝を評価し、重複因子を除いた非垂直暗黙式を微分して、元の同じ一側パッチのNURBS二階微分へ連鎖律で接続する。空間接線・二階微分・曲率の二乗を代数的実数で返す。投影臨界点では勾配が非ゼロの別座標へ切り替え、垂直辺は選択された定数uの枝として扱う。両勾配ゼロと空間速度ゼロを別の未正則結果とし、接線やゼロ曲率を推測しない。

提出対象だけの隔離ビルドで、新規6件と既存29件の計35件が成功（1391.146833 ms、失敗・スキップ0）。双曲線、放物線の投影臨界端点、重み付き円柱の円断面・接平面断面、二重の非垂直接触因子、交差する暗黙枝、停留する空間像、不連続節点の別パッチを確認した。代数的な独立パラメータでも接線と曲率の二乗を独立した式と照合した。既存の曲面・二階微分・曲率・パッチ別断面・seam接続も回帰した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功した。新APIやTypeScript全体の形式証明ではない。

版159の待機プロセスの稼働を確認し、提出対象の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。入力parameterの規則と返す局所微分の座標を区別し、局所座標の増加方向をグラフの巡回方向と同一視しない。高次の特異枝の展開、トリムによる分割、空間自己重複の同一視、一般NURBS BRep曲線とBodyへの採用は残る。


## NURBS平面交差枝の有限区間と巡回方向（版161）

[交差枝の有限区間](nurbs-section-arc3.md)を追加した。所有されたパッチ別グラフの単一辺を、有理数・代数的実数の境界を持つ正の幅の区間として保持する。点・微分照会、区間制限、反転、任意の厳密な切断値での再分割を追加した。元のsection・piece・edge・u/v座標を維持し、巡回方向と昇順の境界値を区別する。点と微分の照会は有限区間の範囲内だけを受理する。代数的な切断位置を有理数のNURBS節点に丸めない。

提出対象だけの隔離ビルドで、新規6件と既存10件の計16件が成功（515.60975 ms、失敗・スキップ0）。代数的な境界と双曲線の式、正負の巡回方向、区間の完全被覆と隣接端点、重複・端点の切断、範囲外の拒否、垂直接触枝のv座標、不連続節点の別々の空間像、端点が一致して途中で折り返す像を確認した。折り返しを単純閉曲線や空集合と認定しない。初回の試験補助関数は有理座標を代数的座標比較へ直接渡していたため、比較前に正確に持ち上げるよう修正し、最終の型検査と実行試験を通した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版153の全体回帰は1074件成功（1037773.530958 ms、失敗・スキップ0）。版160の待機プロセスの実際の稼働を確認し、今回の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。この型はパラメータグラフの区間であり、空間像の単純性・埋め込みやBRep辺の認定ではない。空間の点の所属を逆算する一般照会、トリム領域との交差、BRep・Bodyの採用、保存交換レコードは残る。


## 有限NURBS交差枝と別平面の交差・側分類（版162）

[別平面との交差・分割](nurbs-section-arc-plane3.md)を追加した。元の一側パッチで平面の同次多項式を構成し、垂直辺は正確な代数的定数uでfiberを解く。通常の辺は重複因子を除いた暗黙式との連立方程式を解き、元の枝のvと有限区間で候補を絞る。共通因子による全体一致は、単一の投影開slabの元グラフ辺であることと厳密な多項式因子に基づいて判定する。共通零点集合上として解表から省かれる別枝の端点も、両閉端点の別検査で保持する。異なるパラメータが同じ空間点へ写っても別の交点として保持する。

全交点で分割した断片について、相対開内部の平面側を返す。接点の両側が同符号でも2片を保持し、全体一致だけside:0とする。閉端点はゼロでもよいことを明記した。非一致区間の中間点がゼロなら未分類としてエラーにし、成功へ置き換えない。

提出対象だけの最終隔離ビルドで、新規5件と既存16件の計21件が成功（364.212667 ms、失敗・スキップ0）。双曲線の2つの代数的交点、孤立接触、閉端点、有限区間外、全体一致、共通因子を持つ別枝との端点接触、代数的な定数uでのfiber、空間像が同じ2つのパラメータ、反転と平面係数の符号を確認した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版161の待機プロセスの実際の稼働を確認し、最終の全ソース・全テスト・fixturesの隔離スナップショットを後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。これは有限の単一交差枝をさらに切る処理で、NURBS Body全体の切断やBRep採用、トリム領域全体との交差、一般の2曲面交差は残る。


## 有限NURBS交差枝のトリム領域による完全分割（版163）

[トリム領域による分割](nurbs-section-arc-domain3.md)を追加した。領域の外周・穴の有理NURBS境界を元のパッチの平面交差多項式へ代入し、全根と恒等的な重なりの端点を正確に求める。対象の有限グラフ辺と(u,v)を照合し、全イベントで区間を分けて、内側・境界・外側を巡回順に返す。閉端点・イベントの分類も別に保持し、正の幅の保持片がなくても孤立した境界接触を捨てない。入力のlocate/sampleは信用せず、境界曲線と向きを再検査する。分類は空間像ではなくパラメータ領域に対するもの。

提出対象だけの隔離ビルドで、新規6件と既存21件の計27件が成功（472.908 ms、失敗・スキップ0）。穴を横切る双曲線の全切断座標、部分的に重なる境界区間、孤立した角接触、曲線トリムによる代数的な切断位置、垂直枝と反転、同じ空間点へ写る別パラメータ、偽の所属メソッドと向きの拒否を確認した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版162最終スナップショットの待機プロセスの実際の稼働を確認し、今回の全ソース・全テスト・fixturesの隔離表を後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。単一グラフ辺の有限区間と単純な有理NURBSトリム境界を扱うもので、曲面像の埋め込み、トリム面の採用、NURBS BRep・Bodyの認定、平面に含まれる二次元パッチのトリムは残る。


## トリム付きNURBS曲面全体の平面断面（版164）

[曲面全体のトリム平面断面](nurbs-trimmed-plane-section3.md)を追加した。既存の全パッチ断面と同一パラメータの境界接続を計算し、全辺を有限arcとしてトリム領域で分割する。外側を除いた曲線グラフ、元の孤立接触点、新しいトリム境界だけの孤立接触点を保持する。同じ(u,v)かつ同じ空間点だけを共有し、不連続パッチや異なるパラメータの空間自己重複は接続しない。領域を一度幾何から再検査して、一括処理の内部だけで同じ検査済み領域を再利用する。個別arcの公開APIの再検査は維持する。

平面含有パッチは閉じたdomain/patch矩形の共通部分として保持し、全境界・矩形辺の交点、角、領域内点から非空の正確なwitnessを求める。角・線だけの接触も保持し、正の面積・連結性・曲面像の次元は宣言しない。曲線だけの連結成分と含有領域を分離し、断面全体の位相や含有領域の境界を明示化したとはしない。

提出対象だけの隔離ビルドで、新規6件と既存20件の計26件が成功（561.609209 ms、失敗・スキップ0）。連続/不連続パッチ、穴で分離する曲線、元の孤立接触とトリムだけの接触、平面含有パッチの穴と空集合、角/辺だけの共通部分、内点と角だけでは検出できない細い帯の交差、曲線と含有パッチの共有seam、折り返す空間像、所有・範囲検査を確認した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版163の待機プロセスの実際の稼働を確認し、今回の全ソース・全テスト・fixturesを隔離して後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。一般NURBS BRep・Bodyの認定、空間像の埋め込み、全体の混合次元の位相と含有領域の境界列挙は残る。


## NURBS曲面上の空間点の全一側逆像（版165）

[点の全逆像](nurbs-surface-preimage3.md)を追加した。全閉パッチで同次3成分の同時条件を解き、有理点は線形の差、代数的点は根の多項式の同次代入から候補を求める。元のパッチへ正確に写して、共役根や最小でない根証明の余分な因子を除く。有限解、孤立した実共有零点、共有曲線、全パッチの逆像を保持する。共有枝と全パッチの選択は、候補座標が有限根集合へ入り、連続な連結集合の像がその中の1点へ固定されることを利用する。一側パッチの由来は保持し、単射や正則性を仮定しない。

提出対象だけの隔離ビルドで、新規6件と既存32件の計38件が成功（624.34425 ms、失敗・スキップ0）。3座標による有限逆像、折り返しの複数解、代数的対象点と重み付き曲面、共有曲線上の共役成分の除外、曲線と孤立点の併存、共有多項式に実解がない場合・孤立実点のみの場合、全パッチ、非最小の根証明、不連続/連続節点を確認した。選択された曲線・全パッチの評価は所有・範囲と対象点の一致を検査する。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版154の全体回帰は1080件成功（995181.065 ms、失敗・スキップ0）。保存スナップショットのソース記録と全ソースハッシュをコミット4ebe43fに再照合し、PR #167の検証記録を更新した。今回の最新版の全体成功とは扱わない。版164の待機プロセスの実際の稼働を確認し、今回の全ソース・全テスト・fixturesの隔離表を後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。逆像のトリム領域への制限、全体逆像のseam位相、空間像の埋め込みと一般NURBS BRep/Bodyの採用は残る。


## トリム付きNURBS曲面の点の全逆像（版166）

[トリム付きの点の逆像](nurbs-trimmed-surface-preimage3.md)を追加した。所有された全逆像の有限点・選択済み共有曲線・全パッチを、幾何から再検査したトリム領域へ制限する。候補グラフの捨てた共役成分は処理しない。全境界イベントで曲線を分け、穴と境界区間の一致、孤立した接触を保持する。全パッチは閉じた領域と矩形の暗黙の共通部分として保持し、正の面積や連結性は宣言しない。

平面断面と逆像の境界分割を共通のパラメータ空間処理へ移し、矩形/領域の非空性witness・局所locateも共通化した。元のarc APIの向き・範囲・再検査契約と、全断面の含有領域の契約は維持する。sourcePatch、有限点、raw locus頂点と選択済み辺の順番への由来を保持し、切断片の評価は所有・範囲と元の対象点との一致を検査する。

提出対象だけの隔離ビルドで、新規6件と既存30件の計36件が成功（657.431584 ms、失敗・スキップ0）。有限の折り返し逆像、穴で分離する曲線、閉端点、境界区間、角への孤立接触、全パッチの穴・空集合・角だけの領域、共役成分の除外、パッチ番号の省略後の由来、偽の照会メソッドと所有を確認した。既存のarc分割・全断面・元の逆像・代数曲線グラフも回帰した。新規テスト型検査、対象ソースハッシュ照合、既存133宣言の限定Lean監査も成功したが、新APIやTypeScript全体の形式証明ではない。

版165の待機プロセスの実際の稼働を確認し、今回の全ソース・全テスト・fixturesの隔離表を後続の並列数2の全体回帰へ登録した。今回の全体回帰は未完了。emptyは閉じた一側パッチ群のトリム後の像への所属だが、locationはパラメータ空間の分類であり、空間像の境界や埋め込みを認定しない。節点をまたぐ全体逆像の位相、一般NURBS BRep/Bodyの認定、保存交換レコードは残る。


## NURBS曲面のアフィン左逆写像と相関線形評価（版167）

[アフィン左逆写像](nurbs-affine-projection3.md)を追加した。全同次パッチの係数から有理数の零空間を計算し、空間座標から元のu,vを復元する二つのアフィン形式を発見する。全パッチへの独立した多項式再代入とC0継ぎ目検査の後に所有する。左逆写像により単射・一側階数2・連続な埋め込みを得る十分条件であり、C1/G1や一般NURBSの埋め込み判定ではない。証明できない円柱などを不正とは判定しない。点の射影候補は所属ではなく、有効領域と元の曲面への厳密な再評価を検査する。

`AlgebraicReal.linearCombination`は非公開WeakMapの共通生成元を利用して、相関した代数座標の線形結合を一つの有理像で評価する。既存算術の多項式・根区間の生成処理は維持し、独立した生成元は既存演算へ戻る。保存形式に生成履歴を追加しない。

提出対象だけの隔離ビルドで新規10件と既存12件の計22件が成功（1826.005416 ms、失敗・スキップ0）。ビルド、新規テストの型検査、提出対象の全ソース記録・SHA照合、および既存133宣言の限定Lean監査も成功した。新APIやTypeScript全体の機械証明ではない。保存済み円柱Bodyの回帰1件も成功したが、保存済み平面Bodyの回帰は実行中。版166の待機プロセスの実稼働を確認し、212テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。一般NURBS BRep/Bodyの認定、任意のトリム面の採用、保存交換レコードは引き続き残る。


## 埋め込みが認定されたトリム付きNURBS面（版168）

[アフィンNURBS面](affine-nurbs-face3.md)を追加した。所有された左逆写像証明書と、幾何から再検査した単純な外周・穴を接続する。全境界を節点の全逆像で分割して曲面へ写し、有効矩形から途中で外れる境界も拒否する。凸な支持矩形内のJordan境界はその内部も矩形内に含み、埋め込み曲面への制限から面の埋め込みを得る。曲線順・向きとパッチ片を持つ閉境界、厳密な内部点、空間所属、トリム内評価、全平面断面を同じ所有面から利用できる。C0の折れ目は許容し、滑らかさや一般NURBSの認定へ拡張しない。

提出対象の隔離ビルドで新規6件と既存31件の計37件が成功（1224.838166 ms、失敗・スキップ0）。穴、代数的な点、曲面外点、境界閉鎖、穴で分離する断面、端点が収まっても途中で外れる曲線の拒否、sense、折れ目での境界分割と断面接続、偽のdomain、所有検査、getterの一度のsnapshotを確認した。新規テスト型検査、提出対象のソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。版167の待機プロセスの実稼働を確認し、213テストファイル・fixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。共通BRepの共有稜線、保存復元、Bodyへの採用、一般NURBSの認定は引き続き残る。

版167の保存済みBody回帰は、その後に円柱・平面の2件とも成功した（456571.314375 ms、失敗・スキップ0）。平面fixtureの固定SHA照合、275面の復元・面内点・独立したL字材料所属を含む。これは版167の数字演算変更を含む隔離ビルドの結果であり、版168の全体回帰の完了ではない。


## NURBS面境界の共通BRep接続（版169）

[共通接続への橋渡し](sew-affine-nurbs-faces3.md)を追加した。BRepの支持面型を既存Surface3を既定とする型引数にし、同じ接続エンジンをNURBS面にも使用する。元の解析曲面入口は従来の支持面snapshotと全曲線検査を保持する。所有された面の全外周・穴のlift片から稜線とcoedgeを作り、全同次座標の有理アフィン再パラメータ化による恒等式で一致する閉区間だけを共有する。元の面・ring・パラメータ曲線・片へのsourceUsesを保持する。

提出対象だけの隔離ビルドで新規5件と既存32件の計37件が成功（698.743583 ms、失敗・スキップ0）。異なるUV・曲線パラメータの隣接曲面、6面の立方体の12稜線・8頂点・24coedge・閉じた向き付き接続、端点と中点が同じでも異なる曲線の非統合、所有・由来、片の分割が揃わないときの未閉鎖を確認した。既存の解析／混合BRep・NURBS面・解析曲線縫合も回帰した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版168の待機プロセスの実稼働を確認し、214テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。別の面の端点での自動分割、非線形な再パラメータ化、欠けた内部交差の発見、一般NURBSの埋め込み、殻全体の幾何検査・材料、共通Bodyの保存復元は残る。閉じた接続フラグをソリッド認定として扱わない。


## NURBS境界の全入力端点による自動分割（版170）

[境界接続](sew-affine-nurbs-faces3.md)へ全端点での自動分割を追加した。全lift片の端点を厳密に統合し、非定数有理座標と対象座標の定義多項式から全逆像候補を求め、閉区間と3座標の厳密な一致で選別する。曲面の節点から生じる代数的な端点も切断位置に含める。分割後の全同次座標の恒等式検査で共有辺を揃え、元のcurve/pieceへの由来と向きを保持する。辺のlower/upperは元のpiece内の閉区間とし、新評価APIは所有とその範囲を検査する。

提出対象の隔離ビルドで新規4件と更新した既存37件の計41件が成功（913.942625 ms、失敗・スキップ0）。曲面節点の無理数逆像、反転された境界と入力順序、同じ一座標を持つ別の点による余分な切断の除外、分割片の端点評価と範囲・所有検査、一方だけ分割された立方体の13稜線・9頂点・26coedgeの閉じた向き付き接続を確認した。新規・更新テストの型検査、対象ソースの記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版169の待機プロセスの実稼働を確認し、215テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。端点として与えられていない内部交差の発見、非線形再パラメータ化による共有、一般NURBSの埋め込み、殻全体の幾何・材料検査、共通Bodyの保存復元は残る。


## NURBS面定義と共有接続の保存・再構築（版171）

[面レコードと復元](affine-nurbs-face-record3.md)を追加した。既存の厳密NURBS幾何レコードを使用し、支持面、UV外周・穴とsenseだけを保存する。構造readerと幾何decoderを分離し、累積項目数・数値文字数を検査する。読み込み時に左逆写像、C0、Jordan境界・穴・向き、全境界の支持矩形内包含とliftを再検査する。面集合の復元は全端点分割・全区間の恒等式・共通BRep接続も再計算する。認定フラグ、分割根、sample、共有辺IDを保存して信用しない。既存Bodyスキーマは変更していない。

提出対象の隔離ビルドで新規6件と既存33件の計39件が成功（1048.912083 ms、失敗・スキップ0）。穴のある面の定義往復、無理数の分割位置と共有接続の再生成、6面の立方体の閉接続、不正な重み・潰れた面・境界・向き・認定フラグ、構造受理と幾何受理の分離、有効な別種幾何タグの拒否、累積予算と整合した別の幾何への変更を確認した。既存Bodyレコード・点の代数的相関・NURBS境界と面も回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版170の待機プロセスの実稼働を確認し、216テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。復元結果は面集合と接続診断であり、一般NURBS面、殻の幾何・包含・材料検査、共通Bodyへの採用は残る。


## NURBS境界内部の交差と代数的な関係区間（版172）

[全境界の交差](affine-nurbs-boundary-intersection3.md)を追加した。全lift片対の3同次座標の二変数同時零点を解き、有限解と共有曲線関係を区別する。共有関係は有理span矩形上の完全グラフから、実際の代数的な片の閉矩形へ全4辺の根イベントで制限する。孤立点、角接触、水平成分・垂直辺も保持する。元の両境界へ再評価して3座標の厳密な一致を確認し、所有・番号・範囲を検査する評価APIを持つ。

共通接続処理は入力面の全対の境界交差を実行し、全有限交点と保持した関係頂点も既存の全端点分割へ渡す。入力端点ではなかった内部交差も同じ頂点へ揃え、boundaryIntersectionsに対ごとの全報告を残す。非線形な再パラメータ化による一致も関係として検出するが、共有稜線への統合は現在も有理アフィン対応の恒等式による。面内部どうしのSSIではなく、面領域を交線で分割したことにもならない。

提出対象の隔離ビルドで新規7件と更新を含む既存47件の計54件が成功（1852.3505 ms、失敗・スキップ0）。端点以外の8交点、別平面の投影交差の除外、接線接触、非線形関係、無理数patch境界、両面の評価・順序交換・所有範囲、放物線の両枝、水平／垂直成分、孤立した角接触を確認した。既存NURBS境界・共通接続・面・保存復元も回帰した。新規・更新テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版171の待機プロセスの実稼働を確認し、218テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。非線形関係による共有稜線統合、一般曲面の内部SSIと面分割、一般NURBSの埋め込み、殻全体の幾何・包含・材料検査、共通Bodyへの採用は残る。


## 非線形なパラメータ対応による共有辺の統合（版173）

[関係の区間被覆による共有](nonlinear-nurbs-boundary-sharing3.md)を追加した。有理アフィン恒等式が失敗した場合、元の両boundary/pieceに対応する完全な代数関係を候補辺の閉矩形へ制限し、両パラメータ区間の端から端までの被覆と巡回方向を検査する。関係内では常に3空間座標が厳密に等しいため、両射影の全被覆から双方向の像の包含、すなわち全区間の像の一致を得る。端点・中点・少数サンプルだけでは共有しない。同じ検査を共有辺の各面への全境界所属にも使う。保存形式を変更せず復元時にも再生成する。

提出対象の隔離ビルドで新規6件と既存54件の計60件が成功（1522.768542 ms、失敗・スキップ0）。端点停留の二次対応の両入力順、内部停留の三次対応、部分重複の必要区間だけの共有、四次のUV再パラメータ化を持つ曲がった空間境界、非線形辺を持つ立方体の閉接続と保存復元、同じ端点と円支持でも相補的な上下半円の非統合を確認した。既存境界交差・接続・保存復元も回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版172の待機プロセスの実稼働を確認し、219テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。曲面内部どうしのSSI、面領域の分割、一般NURBS面の埋め込み、殻全体の幾何・包含・材料検査、共通Bodyへの採用は残る。


## 曲面交差のターゲット座標消去（版174）

[ターゲット座標消去](nurbs-affine-intersection-equations3.md)を追加した。一般の元NURBS曲面と、所有されたアフィン左逆写像を持つ相手曲面の全閉パッチ対について、相手の二つのパラメータを元の同次座標の有理式へ消去する。共通次数の同次代入で3空間座標の一致を二変数の多項式へ構築し、両矩形内では分母が正であることから元の空間一致と同値となる。元の曲面の単射・正則・連続性を要求せず、一側パッチと複数逆像を保持する。

所有されたレポートは全パッチ対・両ターゲット座標の分子・3残差を持ち、閉矩形、残差、元の両パッチへの厳密な再評価を検査する所属／点評価を提供する。残差の恒等零を非空な共通領域の認定には使わない。これは方程式構築であり、全根・交線・領域の列挙や完成済みSSIではない。

提出対象の隔離ビルドで新規6件と既存29件の計35件が成功（763.032042 ms、失敗・スキップ0）。独立した双曲線の係数、斜めのチャートと巨大な平行移動、非定数重み、折り返す元曲面の同じ点への2解、恒等零でも必要なターゲット範囲、不連続な一側パッチ、所有・番号・無効候補を確認した。既存の平面断面・全逆像・アフィン左逆写像・二変数多項式ソルバーも回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版160の全体回帰は1107件成功（1104592.854834 ms）、版161は1113件成功（995021.311375 ms）。いずれも失敗・キャンセル・スキップ0。隔離スナップショットの全178/179ソース、実行204/205テストファイル、全fixturesをコミット8ccfb01/771e216へ再照合し、新規出力先への再ビルドの全356/358生成物も実行時出力とバイト一致した。PR #173/#174の記録を更新した。これは最新版の全体成功ではない。

版173の待機プロセスの実稼働を確認し、220テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。方程式の完全な解集合の列挙と両矩形への制限、トリム面交差・面分割、相手側にも左逆写像がない一般NURBS同士のSSI、殻全体の幾何・材料検査と共通Bodyへの採用は残る。


## 両パッチの閉範囲を持つNURBS交差ソルバー（版175）

[閉パッチ交差](nurbs-affine-intersection3.md)を追加した。一般の元NURBSとアフィン左逆写像を持つターゲットの全パッチ対の3残差を解き、有限解と共有零点グラフを保持する。ターゲット矩形を4つの非負多項式に変換し、全交点・共有因子・垂直fiberで区間を分割して、曲線、孤立実点、閉接触を残す。評価は所有・番号・保持範囲と元の両曲面の厳密な一致を検査する。

全残差が恒等零の場合は、制約多項式の零集合の全射影セルとイベントfiberを代表し、全根・全区間から正確なwitnessを探す。非空の閉集合だけを暗黙regionとして保持し、空集合・線や角だけの接触を正の面積と扱わない。元曲面の折り返し・特異・不連続な一側由来を保持する。regionは非空性と所属であり、連結性・全境界列挙・空間像の面積の認定ではない。

提出対象の隔離ビルドで新規10件と既存49件の計59件が成功（1222.534125 ms、失敗・スキップ0）。両矩形で切られた双曲線、正定値多項式の孤立実接触、折り返しの二枝、内側の重なり・線・角・空集合、非定数重み、一側由来、潰れた元曲面、所有・範囲、共有因子と接線接触、孤立点／垂直セルのwitness、実解なし、幅10^-40の共通部分を確認した。既存方程式・左逆写像・平面断面・全逆像・二変数ソルバー・代数グラフと矩形制限も回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版174の待機プロセスの実稼働を確認し、222テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。トリム面交差と面分割、混合次元の全体位相とregion境界列挙、相手に左逆写像がない一般NURBS同士のSSI、殻全体の幾何・材料検査と共通Bodyへの採用は残る。


## NURBSトリム境界の厳密な陰関数化（版176）

[パラメータ境界の陰関数化](nurbs-parameter-implicit2.md)を追加した。全spanの同次座標の共通因子を除去し、Q[u,v]を係数とするSylvester/Bareiss消去でtを消去する。厳密なピボットと除算を使い、重複因子を両偏導関数とのgcdで除去する。最後に元の同次有理式へ全多項式を再代入し、恒等的にゼロであることを検査してから所有する。定数spanは点として別に保持し、一側spanと全体パラメータ範囲を維持する。

陰関数の零集合は有限spanの像を含む必要条件であり、別の枝・向き・区間への所属を認定しない。評価APIは元のNURBSと所有・番号・閉範囲を使用する。次のトリム交差への統合では、引き戻した多項式に加え、有限境界の端点・特異点・射影イベントと実際のdomain所属が必要である。陰関数だけで全枝をboundaryと扱ってはいけない。

提出対象の隔離ビルドで新規10件と既存50件の計60件が成功（1191.858375 ms、失敗・スキップ0）。直線・放物線・円の独立した式、非定数重みの垂直線、代数的パラメータ、共通基点因子、重複するパラメータ化、一側不連続、定数span、所有・範囲、行交換を含む消去、零・定数・共通因子、25の有理特殊化と一変数行列式の照合を確認した。既存曲線・曲線交差・パラメータ領域・曲面境界・二変数ソルバー・終結式も回帰した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版175の待機プロセスの実稼働を確認し、224テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。交線への境界の引き戻し、有限枝の所属と両トリム領域による制限、面分割、一般NURBSのSSI、殻の幾何・材料認定と共通Bodyへの採用は残る。


## 曲面交差の両トリム領域への制限と直接面交差（版177）

[両トリム制限](nurbs-affine-intersection-trim3.md)を追加した。検査し直した外周・穴の支持多項式、全span端点、積の両軸の射影イベントを使い、相手の境界を元の有理チャートへ全次数の同次代入で引き戻す。全イベントで交線を分け、両domainの実際の所属で開区間・閉端点・孤立接触を選ぶ。支持式が全区間でゼロでも、有限の四分円と別の枝を同一視しない。元曲面側に左逆写像を要求せず、非線形なチャートも保持する。

重なったパッチの暗黙regionは、両領域の分割配置と元の閉パッチ条件の全セルを代表して非空性を再検査する。穴に完全に入れば空とし、線・角だけの接触や階数1の像も保持する。sourceLocation/targetLocationは各パラメータ領域の分類であり、空間像や材料の境界ではない。直接のintersectAffineNurbsFaces3も接続し、保存復元した所有面から利用できる。面領域の分割・全体位相の統合・立体認定とは扱わない。

提出対象の隔離ビルドで新規10件と既存57件の計67件が成功（51434.487041 ms、失敗・スキップ0）。穴で分断する双曲線、三次の境界切断、有限四分円／別枝、穴付き重なり・線・角・空集合、非線形チャートの無理数端点、孤立接触、階数1の元曲面、偽のdomain・所有・範囲、保存復元後の直接面交差を確認した。同次代入は全次数と25の有理評価でも照合し、既存交差・方程式・不等式・陰関数・domain・グラフ・平面断面・面レコードも回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版162最終の全体回帰は1118件成功（1004513.758291 ms）、版163は1124件成功（1019505.234333 ms）。いずれも失敗・キャンセル・スキップ0。全180/181ソース、実行206/207テストファイル、全fixturesをコミット1e6b9e6/8dc0428へ照合し、新しい出力先への再ビルドの全360/362生成物も実行時出力とバイト一致した。PR #175/#176の記録を更新した。最新版の全体成功とは扱わない。

版176の待機プロセスの実稼働を確認し、226テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。面領域の分割、seamをまたぐ混合次元の全体位相、regionの全境界列挙、相手にアフィン左逆写像がない一般NURBS SSI、殻の幾何・材料認定と共通Bodyへの採用は残る。


## トリム交差のパラメータseam曲線グラフ（版178）

[seam接続](nurbs-affine-intersection-seams3.md)を追加した。同じ元(u,v)、ターゲット座標、空間点の頂点を共有し、全元頂点で辺を分割する。不連続な隣接元パッチでは、共有パラメータ辺上の同次空間差のgcdの全実根から、保持された辺どうしの孤立接触も先に追加する。共有辺は、選択されたUV枝の全一致と、3空間座標の全同次差の恒等零を検査する。通常枝はgcdの因子検査、垂直枝は全係数の特殊化で確認し、少数点の一致だけでは統合しない。

元のpatch/vertex/edgeへの由来と保持範囲を維持し、curveComponentsはグラフだけの成分とする。暗黙regionは元集合を別に参照し、連結性の分からない集合を1成分として強制結合しない。異なる元パラメータの同じ空間像も分離する。これは全空間像の位相・埋め込みや混合次元の全体位相の認定ではない。

提出対象の隔離ビルドで新規8件と既存67件の計75件が成功（25957.158292 ms、失敗・スキップ0）。相手crease上の重複辺、連続元seamと削除後の由来、不連続像、端点と中点が同じ異なる写像の全接触、折り返した別逆像、regionの分離、無理数端点の通常枝、水平seam、所有・範囲を確認した。既存の両トリム・同次代入・交差・不等式・方程式・陰関数・domain・グラフ・平面断面・面レコードも回帰した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の機械証明ではない。

版177の待機プロセスの実稼働を確認し、227テストファイルとfixturesの隔離スナップショットを後続の全体回帰へ登録した。今回の全体回帰は未完了。region相互と曲線・regionの全体位相、面分割、共通BRepの交差稜線への接続、一般NURBS SSI、殻の幾何・材料認定と共通Bodyへの採用は残る。

## 交差辺の片側微分と向き（版179）

[曲面交差辺の厳密な微分](nurbs-affine-intersection-differential3.md)を追加した。source/target UVと空間の一階・二階微分を保持し、target曲面側からの独立した連鎖律との厳密な一致、および両面法線との直交を検査する。平方因子を除いた陰関数を微分し、射影臨界点では局所独立座標を交換する。特異勾配は未解決として返し、静止した空間像には正則曲率を与えない。継ぎ目は明示されたincident useの片側法線を保持する。

法線は正のUV方向のdu×dvであり、トリムのsenseを掛けない。orientationは局所増加座標での符号で、coedge進行方向でも材料の内外でもない。transverseは評価点の性質であり、辺全体の認定ではない。既存平面断面APIの公開戻り値は維持する。

提出対象の隔離ビルドで新規8件を含む関連47件が成功（2151.779375 ms、失敗・キャンセル・スキップ0）。ソースと新規テストの型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功。新実装やTypeScript全体の形式証明ではない。コミット97efe9cを基にした全228テストファイルとfixturesの隔離スナップショットは、実稼働を確認した版178の待機プロセスの後へ登録した。全体回帰は未完了。

次の統合では、辺全体の正則性・接触・座標切替イベントを扱い、向き付き面分割へ接続する必要がある。既存の有限平面曲線分割とBody分割interfaceの由来契約を再利用するが、現在のNURBS交差グラフをnative曲線や一般立体へ認定したとは扱わない。一般target曲面、面の埋め込み、材料分類、共通Bodyへの採用は残る。

## 交差辺の微分イベントと全useの同期（版180）

[微分イベント分割](nurbs-affine-intersection-events3.md)を追加した。source曲面の微分分子から階数・空間接線の退化を、平方因子除去後の陰関数の偏微分から座標の退化を、3同次一致残差の偏微分から横断性の変化を分割する。全多項式イベントで切断し、開区間の分類と閉端点の点状態を分ける。targetは所有されたアフィン逆写像のため階数2を持つ。sourceの階数も併せて判定し、残差の微分だけで横断性を認定しない。

両トリム後の辺では保持範囲内だけを解析する。seam complexでは全incident useのイベントの和集合を使い、各useを同じ範囲へ分割する。patch/edgeへの由来と片側微分・法線・orientationを独立して保持する。これは解析結果であり、complexの位相を書き換えたり面片を生成したりはしない。

提出対象の隔離ビルドで新規6件を含む関連53件が成功（889.806584 ms、失敗・キャンセル・スキップ0）。型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功した。TypeScript全体や新実装の形式証明ではない。実稼働を確認した版179の後に、229テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は共通イベントを実際の交差グラフの頂点・辺へ反映し、向き付き面分割へ接続する。節点の枝の接線分離、重なりregionの境界列挙、面の埋め込み・材料分類、一般NURBS同士のSSIと共通Bodyへの採用は残る。

## 微分イベントを交差グラフへ反映（版181）

[交差グラフの細分](nurbs-affine-intersection-refine3.md)を追加した。全incident useの同期したイベントを実頂点へ、隣接区間を子辺へ反映する。元の頂点ID、孤立頂点、元辺から子辺への順序付き対応、各useのpatch/edgeと片側微分を保持する。全useでsource UV・target UV・3D点の一致を検査し、同じ空間像を持つ別のsourceパラメータは分離する。

辺の始終範囲と接続を維持し、グラフ成分は子辺と追加頂点へ展開する。暗黙regionは別の集合のまま保持し、境界を創作しない。元complexは不変。所有された細分結果からの点・微分照会は、元辺より狭い子辺の範囲とuseを検査する。

提出対象の隔離ビルドで新規4件を含む関連57件が成功（1233.674375 ms、失敗・キャンセル・スキップ0）。内部階数低下での実頂点追加、完全被覆と成分、等しい空間像の別逆像、crease、子辺範囲、所有、孤立接触、重なりregionを検査した。新規テスト型検査、ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版180の後へ230テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は元のトリム境界と交差グラフを同じUV配置へ統合し、向き付き閉ループと面片を抽出する必要がある。現在の結果は曲線グラフであり、面の埋め込み、材料分類や一般BRepの認定ではない。特異枝・regionの全境界・一般target SSI・共通Bodyへの採用は残る。

## 交差頂点と両面トリム境界の対応（版182）

[トリム境界の分割](nurbs-intersection-boundary-nodes3.md)を追加した。細分交差グラフのsource/target UV頂点について、検査済み外周・穴の各有限NURBS span上の正確な逆像を求める。座標の最小多項式の同次代入による全実根を、閉span範囲と実際の両座標で照合する。ノット端点も保持し、境界の進行方向を変えずに分割する。

各ringの閉接続、curve/span/パラメータ範囲、境界頂点と全交差頂点IDの対応を保持する。target UVが一致する複数source逆像も記録し、元の交差グラフは変更しない。端点の一致だけで交差辺と境界辺を同一視せず、面片の完成とは扱わない。

提出対象の隔離ビルドで新規5件を含む関連48件が成功（2219.476208 ms、失敗・キャンセル・スキップ0）。両面の双曲線端点、代数的逆像、穴、複数逆像、重み付き境界と挿入ノットを確認した。新規テスト型検査、全ソース記録・SHA照合、既存133宣言の限定Lean監査も成功した。新実装やTypeScript全体の形式証明ではない。実稼働を確認した版181の後へ231テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は境界と交差辺の一致区間を全体恒等式で判定し、分岐の枝の順序を扱ってUV配置の閉ループを抽出する。面片の穴割当て、特異枝、重なりregion、埋め込みと材料分類、一般target SSIと共通Bodyへの採用は残る。

## 元面境界と交差辺の全区間一致（版183）

[有限区間一致](nurbs-intersection-boundary-sharing3.md)を追加した。境界分割へ両座標微分の全零点を加えて単調な片を作り、source UV境界のspan全体を選択交差枝の多項式へ同次代入して恒等零を検査する。垂直枝は固定uの全span一致を検査する。有限範囲を交差させ、境界パラメータへの正確な逆像、内部の選択枝、両閉端点を照合する。元辺・境界辺の一部だけの一致と進行方向も保持する。

これはsource UVの共有区間の解析結果であり、target側の折り返しを含む対応、共通の辺原子への統合、面ループ抽出は未完了。端点と少数の中間点だけでは一致を認定しない。

提出対象の隔離ビルドで新規4件を含む関連52件が成功（1562.053 ms、失敗・キャンセル・スキップ0）。水平・逆向き・垂直、有限な部分一致、曲線・ノット、端点と中点が直線上にある異なる三次境界の拒否を検査した。新規テスト型検査、ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版182の後へ232テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次はtarget側のパラメータ対応・折り返し、共有区間の共通原子化、枝の順序と面片の閉ループ抽出へ進む。特異枝・regionの境界列挙・埋め込み・材料分類・一般target SSIと共通Bodyへの採用は残る。

## 元面UVの境界と交差辺を共通原子へ接続（版184）

[境界・交差辺の共通原子](nurbs-source-boundary-complex3.md)を追加した。検査済み共有区間の範囲で両表現を分割し、境界と交差辺を同じUV辺へ接続する。元辺の完全な順序付き対応、各元パラメータ範囲と方向、外周・穴のringを保持し、閉接続を再検査する。境界のノット・射影臨界点などのUV頂点も、同じ選択枝上にあれば交差辺を分割する。共有の恒等式がない辺は端点一致だけでは統合しない。

これはsource UVの接続であり、空間BRepの認定ではない。同じUVの全細分グラフ頂点IDを残し、不連続な空間像の同一視や法線平均は行わない。交差辺同士の全重複、平面埋め込み、循環する枝順序は未認定。target側、特異枝、region境界、面片・穴の割当て、材料と共通Bodyへの採用も残る。

提出対象の隔離ビルドで新規4件を含む関連56件が成功（2254.093625 ms、失敗・キャンセル・スキップ0）。境界共有の正逆、有限な部分一致、内部横断と次数3の接続、曲線境界・ノットを検査した。新規テスト型検査、ソース記録・SHA照合、既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版183の後へ233テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

## 元面UVの枝順序と半辺巡回（版185）

[枝順序と半辺巡回](nurbs-source-halfedges3.md)を追加した。単調な共通原子の始終UV差で方向を分類し、同じ左右方向では次の別頂点より手前の共通有理u線で枝を厳密比較する。接線が一致する放物線同士も区別する。軸上の重複や共通線で区別できない枝はunresolvedとして保持し、推測したnextやcyclesを返さない。順序が決まればtwinと反時計回りrotationから左側をたどるnextを作り、全半辺を重複のない閉じたwalkへ分ける。面ID・面積・穴の所属や材料認定はまだ割り当てない。

同じ接線を持つ二枝の回帰で、前段の微分・曲率・法線との内積が依存した代数的数を独立な消去演算に分けて膨張することを特定した。陰関数と空間の一階・二階微分、曲率は有理多項式でまとめてから評価する。新しい明示的なproductCombinationで共通の有理関数の元に属する積和を一度に評価し、異なる元は従来の完全な演算へ戻す。通常のadd/mul等は変更しない。修正前の診断と旧検証は実装修正後に終了し、成功件数に含めない。

提出対象の隔離ビルドで関連93件が成功（2392.618542 ms、失敗・キャンセル・スキップ0）。新規の半辺5件と数値4件に加え、平面断面・曲率、曲面交差、トリム・seam、境界・共通原子、実根・有理像・共通元の線形演算を回帰した。同じ接線の二枝、通常・横断・逆向きのwalk、別空間像の重複UV枝の未解決、共通元の相殺、共役の分母の極、異なる元へのフォールバック、factory所有を検査した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版184の後へ235テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は境界walkの内外・面片への対応、穴の割当てを進める。target側の一般写像、重複・特異枝の解消、region全境界、面の埋め込み・材料分類・一般target SSIと共通Bodyへの採用は残る。

## 元面UVの領域・外周・穴の対応（版186）

[境界walkから領域と穴を分類](nurbs-source-faces3.md)を追加した。全UV頂点を避ける厳密な共通線と曲線の交点から各巡回の左側の有理サンプルを選び、全巡回の巻き数ベクトルが一致するものを同じ領域へまとめる。境界は有限NURBS spanの逆像、交差辺は選択グラフと転置した多項式の有限実根で照合する。未分離のfiberや枝順序はunresolvedとし、推測した面を返さない。

面ごとに外周・穴・領域を分断しないwireの巡回を分け、cycleFaces/halfedgeFacesで由来を保持する。全巻き数ゼロの領域を非有界とし、検査済みdomainでinside/outsideを付ける。insideはsource UVトリム所属であり空間材料ではない。入力トリムが曲面の有効範囲内であること、空間への埋め込み、向きと材料は別検査が必要。

提出対象の隔離ビルドで新規6件を含む関連99件が成功（3336.941875 ms、失敗・キャンセル・スキップ0）。環状領域、横断切断、代数的円による円盤/環状領域、穴を横切る複数切断、内部wire、sense反転、未解決枝と所有を確認した。新規テスト型検査、ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版185最終の後へ236テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は分類したUV面の照会・保存表現、境界を空間へ持ち上げる対応を接続する。target側、重複・特異枝、暗黙regionの境界、空間面の埋め込み・材料分類・一般target SSIと共通Bodyへの採用は残る。

## 元面UVの面・辺・頂点照会（版187）

[厳密照会](nurbs-source-face-location3.md)を追加した。分類済みのUV領域に対し、面IDとトリム所属、共通辺と接する面、頂点とincident辺・面を返す。境界NURBSと選択交差枝の有限fiber評価を面分類と共有し、閉端点を直接扱う。水平rayが頂点と同じ高さでも半開規則で巻き数を計算し、全巡回の既存署名と一致する面だけを返す。

wireの両側は同じ面として重複除去し、孤立接触頂点には辺を創作せず含まれる面を対応付ける。元の未解決分類、未分離fiber、未知の巻き数署名はunresolvedを返す。source UVの照会であり、空間材料や曲面の有効範囲の認定ではない。

提出対象の隔離ビルドで新規6件を含む関連105件が成功（5048.946792 ms、失敗・キャンセル・スキップ0）。矩形・穴の独立した不等式の格子、円の距離二乗の格子と無理数境界点、切断の左右・端点、wire、孤立頂点、未解決伝播・所有を検査した。共有したfiber処理を使う既存面分類も回帰した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版186の後へ237テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は面境界の空間曲面への持上げ・片側patch対応、保存表現、曲面有効範囲と埋め込みを接続する。target側、重複・特異枝、region全境界、材料分類・一般target SSIと共通Bodyへの採用は残る。

## source UV境界を片側空間像へ対応（版188）

[片側空間像](nurbs-source-face-lift3.md)を追加した。共通UV辺を曲面の全ノットの有限逆像で分割し、各開区間を支える全閉片側パッチと閉端点を保持する。境界や頂点が曲面の有効範囲外なら未解決とし、UV面分類だけで曲面領域を採用しない。片側を指定した有限区間内の正確な点照会と、元巡回から持上げpiece/方向への対応を返す。

ノット線上の開区間の位置一致は3同次差を固定パラメータで制限した全多項式恒等式で検査する。各切断点と元UV頂点にも全incident像を保持し、位置の不一致を平均しない。continuousは保持した境界像の位置一致だけを表し、曲面内部の全seam・C1/G1・埋め込み・材料や実際の面側の選択を認定しない。

提出対象の隔離ビルドで新規6件を含む関連111件が成功（4945.723542 ms、失敗・キャンセル・スキップ0）。鞍形の独立式、連続creaseの両片側、不連続ノット、重み付き商式、曲面範囲外、端点だけ一致する異なるseamを検査した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版187の後へ238テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は実際の面側の片側パッチ選択、内部の正則性・全seamと埋め込みの検査、保存表現へ接続する。target側、特異枝・region全境界、材料分類・一般target SSIと共通Bodyへの採用は残る。

## 面の内側パッチと内部seamの位置連続性（版189）

[面側の選択と内部seam](nurbs-source-face-patches3.md)を追加した。inside UV面の各巡回の左側に対応する局所パッチを選び、選択した空間像の閉接続を検査する。全閉パッチ像の一致と、実際に面が使う側の成立を区別する。一定のUV値が無理数でも厳密な範囲比較で選択する。

境界の閉接続に加え、全隣接パッチのノットseamを共通UV辺・頂点との交点で分割し、面照会で所属を制限する。面内部または同じ面のwireを通る区間と、別面を隔てる境界を分ける。穴の内部はinside面へ数えない。positionContinuousは選択境界の閉接続と面内部seamの位置一致の両方を表し、正則性・C1/G1・単射性・埋め込み・材料の認定ではない。

提出対象の隔離ビルドで新規7件を含む関連118件が成功（3343.115208 ms、失敗・キャンセル・スキップ0）。未使用側の異なる像、閉外周に隠れた内部不連続、u/v両方向のcrease、無理数の一定座標、穴に制限した全seam、未解決伝播・所有を検査した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版188の後へ239テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は面ごとの内部退化集合と片側正則性を検査し、位置連続性と合わせて埋め込み検査へ接続する。target側、特異枝・region全境界、保存表現、材料分類・一般target SSIと共通Bodyへの採用は残る。

## 開UV面内部の片側正則性（版190）

[内部正則性](nurbs-source-face-regularity3.md)を追加した。既存の全閉片側パッチの退化集合を実際の開UV面へ制限する。有限系と共有多項式の孤立実点は全点照会し、曲線・領域は法線分子・境界支持式・有限端点・射影イベント・全共通UV頂点の座標多項式を含む配置で非空性を検査する。無理数や穴の中だけにある閉じた退化成分も扱う。未解決の照会を正則性へ読み替えない。

面・パッチごとにregular/singular/unresolvedを返し、singularには正確なUVと空間像の証拠点を保持する。ここでregularは開いた面内部に退化がないという意味だけ。境界だけの退化や、退化線で区切られた面の閉包全体を正則とは認定しない。位置連続性とも独立であり、C1/G1・単射性・埋め込み・材料ではない。

提出対象の隔離ビルドで新規9件を含む関連137件が成功（3778.508125 ms、失敗・キャンセル・スキップ0）。内部退化線、トリム外・境界だけの退化、二つの開面、有限系と共有多項式の孤立点、rank-one領域、無理数の退化線、穴に完全に入る閉成分、所有と未解決伝播を検査し、既存の全曲面正則性も回帰した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版189の後へ240テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は境界・頂点の実際の片側階数と面閉包の成立条件を接続する。target側、特異枝・region全境界、埋め込み、保存表現、材料分類・一般target SSIと共通Bodyへの採用は残る。


## 完了した全体回帰のコミット照合（版191）

[版164〜172の監査](kernel-regression-audit191.md)を行った。9実行すべてで、各コミットの全ソース・実行テスト・fixtures・設定と提出対象スナップショットを照合し、新しい出力先での再ビルドも全生成物が実行時出力とバイト一致した。全実行で失敗・キャンセル・スキップ0。最新の完了分はコミットbf8a1e2の1180件成功（1337889.274959 ms、193ソース、218テストファイル、386生成物）。各件数の合計を新規テスト数とは数えない。

PR #177〜#185の検証記録を対象コミットの完了結果へ更新し、監査の機械可読記録を保存した。固定の平面Body fixtureも全9実行で元の680720バイト・SHAのまま照合した。これは入力対応の監査であり数学的証明ではない。

実稼働を確認した版173と後続のキューは継続中。最新版の版190までの全体成功は未確認であり、この監査から推定しない。実行ソースを変更しない記録更新のため、別の全体回帰を追加起動していない。マージ・npm公開も行っていない。次の実装上の不足は境界・頂点の片側階数、閉包の正則性、埋め込みと材料である。

## 選択境界使用の閉片側階数（版192）

[境界の閉片側階数](nurbs-source-boundary-regularity3.md)を追加した。面が実際に使用する各pieceのパッチについて、NURBS境界では3法線分子の同次代入とgcdの全実根、陰関数交差辺では全多項式イベントから退化位置を列挙する。全閉切断点と開区間を保持し、内部が正則でも端点だけ退化する例、全境界区間の退化を区別する。未使用側だけの退化は選択面へ強制しない。

selectedBoundaryRegularは選択した境界使用の全閉区間の階数だけを表す。vertexSectorCoverageをnot-certifiedと明示し、頂点まわりの全ての面内パッチ領域や孤立頂点の網羅、面閉包全体の認定とはしない。面内部の正則性、位置連続性とも別の結果であり、これらだけで空間面を採用しない。

提出対象の隔離ビルドで新規8件を含む関連145件が成功（9000.355709 ms、失敗・キャンセル・スキップ0）。境界区間全体、陰関数交差枝、角と境界内部の孤立点、無理数イベント、未使用側、rank-one像、所有と未解決伝播を検査した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版190の後へ241テストファイルとfixturesの隔離全体回帰を登録した。版191は実行コードを変更しない監査記録更新のため、追加の全体回帰を起動していない。今回の全体回帰は未完了。

次は頂点の全ての面内パッチ領域と孤立頂点の所属を調べ、閉包の階数へ接続する。target側、特異枝・region全境界、埋め込み、保存表現、材料分類・一般target SSIと共通Bodyへの採用は残る。

## 頂点の全面内パッチ領域と閉包の片側階数（版193）

[頂点領域と閉包の階数](nurbs-source-vertex-regularity3.md)を追加した。全共通UV頂点、孤立接触、境界持上げ時の追加ノット点について、厳密なgerm rotationとUV象限から面が接する全パッチを求める。境界rayがそのパッチ内に入らなくても、面内部から頂点へ近づけるパッチを採用する。面外から点接触するだけのパッチは除外し、各面・象限のパッチ被覆も検査する。未分割の接続や所属を確定できない場合は未解決にする。

同じ所有された選択結果から内部・全閉境界使用・頂点領域を解析し、analyzeNurbsSourceFaceClosedRank3で閉包の片側階数へまとめる。いずれかに退化証拠があればsingular、全てが正則ならregular、それ以外はunresolved。位置連続性は別に保持する。これはC1/G1・単射性・埋め込み・材料の認定ではない。境界解析単独のvertexSectorCoverageは変更せず、別の頂点解析を加えることで不足を補う。

提出対象の隔離ビルドで新規8件を含む関連153件が成功（5599.191833 ms、失敗・キャンセル・スキップ0）。境界では未使用の面内パッチ（実頂点と追加ノット点）、面外だけのパッチ、孤立接触、等接線の狭い面、閉内部退化成分、所有と未解決伝播を検査した。内部と選択境界が正則でも頂点領域が退化する例を検出した。新規テスト型検査、全ソース記録・SHA照合と既存133宣言の限定Lean監査も成功したが、新実装やTypeScript全体の形式証明ではない。実稼働を確認した版192の後へ242テストファイルとfixturesの隔離全体回帰を登録した。全体回帰は未完了。

次は位置連続性・閉包の片側階数を前提とした面の単射性と自己交差の検査へ接続する。target側、特異枝・region全境界、保存表現、材料分類・一般target SSIと共通Bodyへの採用は残る。
