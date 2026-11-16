# 接触を保持する平面材料

`PlanarMaterial3` は所有された有理平面材料です。`Body3` の多様体条件を緩めず、辺・頂点で接触する正則化集合演算の結果を、保存・復元・点分類・次の集合演算へ渡します。一般曲面や任意の輸入BRepの認定は対象外です。

```ts
const a = createBoxBody3(point3(0n, 0n, 0n), 1n, 1n, 1n);
const b = createBoxBody3(point3(1n, 1n, 0n), 1n, 1n, 1n);
const joined = booleanPlanarMaterials3(a, b, 'union');
joined.boundaryKind; // 'contact'
const saved = serializePlanarMaterial3(joined);
const restored = restorePlanarMaterial3(saved);
const remainder = booleanPlanarMaterials3(restored, b, 'difference');
const body = planarBodyFromMaterial3(remainder); // 多様体条件を再検査
```

公開入口はルートからexportします。

- `createPlanarMaterial3(polygons)`：凸な有理平面多角形群の幾何・埋め込み・殻包含・向きを検査。空材料も受理します。
- `planarMaterialFromBody3(body)`：所有されたBodyの実際の境界を使用。平面・直線辺・有理頂点が必要です。
- `booleanPlanarMaterials3(a, b, operation)`：各入力はBodyまたは所有された平面材料。和・積・差・排他的和の正則化結果を返します。辺／頂点だけの共通部分は立体の積として残りませんが、和の境界接触は保持します。
- `locatePlanarMaterial3(material, point)`：有理数または代数的数の点に対する厳密な内外・境界判定。
- `planarBodyFromMaterial3(material)`：接触複体は拒否。多様体候補でも、平面立体の成立条件を再検査してからBodyへ採用します。
- `planarMaterialDocument3` / `serializePlanarMaterial3` / `restorePlanarMaterial3`：浮動小数へ丸めず、構築定義の共有DAGを保存・再実行します。

`boundaryKind` は接続の区別で、別の幾何認定フラグではありません。すべての材料は検査済みの立体葉または所有された集合演算結果から構築します。構造コピーを所有オブジェクトとして受理しません。

保存形式は `version:1, kind:'planar-material', nodes:[...]`。立体葉は正確な有理座標の多角形群、Boolean節点は演算名と先行節点IDを持ち、最終節点が根です。共有された部分式は一度だけ出力します。巡回・前方参照・到達不能節点・無効な演算を拒否し、すべての葉の形状を再検査します。任意の呼び出し元の境界表や材料分類を信用して復元する形式ではありません。元のBodyのIDやフィーチャ履歴を保持する形式でもありません。

読取制限の既定値は1000節点・100000頂点・座標文字列あたり4096文字・JSON文字列10000000文字です。`PlanarMaterialReadLimits3`で変更できます。文字数制限は文字列入力のJSON解析前、節点・頂点・座標長の検査は幾何演算前に行います。オブジェクト入力では全体のJSON文字数は計測しません。これらは演算時間や代数演算のメモリ使用量の上限保証ではありません。

この段階では共通Body自体への非多様体領域の保存、曲面材料と接触複体のBoolean、一般BRepの受理、接触を含む領域分解の共通化は未完了です。既存の低水準演算を所有モデルと保存形式へ接続する統合段階として扱います。

[領域解析](planar-material-regions3.md)は、接触する材料・空洞の開領域を分離し、境界片の両側対応と有限領域の厳密な体積を返します。Body自体の非多様体領域への採用は引き続き未完了です。

[CellularBody](cellular-body3.md)では、接触材料の有限面と両側の領域を共通境界表に保存し、構築定義からの再照合とBody間の再演算へ接続します。既存の多様体Bodyとは受理条件を区別します。
