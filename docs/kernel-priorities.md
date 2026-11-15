# カーネル優先の開発方針

cadloomの中心は、形状表現と幾何演算、それらの成立条件を検査する純粋TypeScriptのライブラリです。画面操作や編集履歴を追加する前に、演算結果を次の演算へ安全に渡せるようにします。

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

NURBSの領域・特異点・継ぎ目の検査は、この操作実装に必要な基盤として再利用します。次々と独立した検査機能だけを追加する順序から、部品の作成・編集が通る単位での実装へ移ります。未認定の面の埋め込みや立体の成立は引き続き必要な義務です。

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
