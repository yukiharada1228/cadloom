# カーネル優先の開発方針

cadloomの中心は、形状表現と幾何演算、それらの成立条件を検査する純粋TypeScriptのライブラリです。画面操作や編集履歴を追加する前に、演算結果を次の演算へ安全に渡せるようにします。


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
