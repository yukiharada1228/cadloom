# 面の両側の領域を持つCellularBody

`CellularBody3` は、接触する平面材料の境界と領域を保持する所有モデルです。多様体である既存の `Body3` の受理条件は維持し、辺・頂点接触を持つ結果を、保存可能なBody表現へ接続します。現在の構築入口は有理平面材料に限定します。

```ts
const a = createBoxBody3(point3(0n, 0n, 0n), 1n, 1n, 1n);
const b = createBoxBody3(point3(1n, 1n, 0n), 1n, 1n, 1n);
const contact = booleanCellularBodies3(a, b, 'union');
const replayed = restoreCellularBody3(serializeCellularBody3(contact));
const remainder = booleanCellularBodies3(replayed, b, 'difference');
```

## 公開契約

- `cellularBodyFromBody3`：所有された既存Bodyの実際の平面境界から構築します。曲面や非有理頂点は拒否します。
- `cellularBodyFromPlanarMaterial3`：所有された材料を厳密に領域解析し、面片を縫合して構築します。コピーされた所有オブジェクトは拒否します。
- `booleanCellularBodies3`：各入力に既存BodyまたはCellularBodyを受け、正則化Booleanの結果をCellularBodyとして返します。
- `locateCellularBody3`：有理数／代数的数の点を厳密に分類します。
- `planarMaterialOfCellularBody3`：所有された材料を取り出します。多様体になった結果は `planarBodyFromMaterial3` を通して再検査し、既存Bodyへ戻せます。
- `cellularBodyDocument3` / `serializeCellularBody3` / `restoreCellularBody3`：構築定義と境界・領域レコードを保存し、復元時に再構築して全表を照合します。

`topology` は実際の共有辺・coedge・頂点リンクを保持します。接触に伴う非多様体辺／頂点の診断を消しません。すべての辺の使用が向き付きで釣り合うことを確認し、開いた境界は採用しません。`faces` は保存された有限領域を復元し、支持面・向き・全境界との結合を検査した面です。`interiorSamples` は開いた材料成分ごとの厳密な有理内部点です。`materialFaces` は保存面IDから元の平面材料の多角形IDへの対応を保持し、細分化後の面と構築材料を結びます。この対応は保存された構築定義から再計算します。

## レコードと幾何的認定

`CellularBodyRecord3` は `version:1, kind:'cellular-body'` と次の表を持ちます。

- `boundary`：既存Bodyと共通の正確な曲線・支持面・頂点・辺・ループ・有限面・殻の接続表。殻は辺で接続した境界成分で、材料領域を意味しません。この表には旧来の `regions` を保存しません。
- `regions`：材料／空領域の区別、有限／無限、厳密な内部点、有理体積。領域0は無限外部で、`material:false, bounded:false, volume:null`。それ以外は有限領域です。
- `faceRegions`：各面の物理的な負側と正側の領域ID。境界面は負側が材料、正側が空領域となります。

領域解析で分割された境界片をそれぞれの有限面として保存するため、一つの保存面に対する領域対は一つです。空材料も扱います。内部空洞は有限な空領域、貫通穴は外部と同じ空領域になります。

`readCellularBodyRecord3` / `parseCellularBodyRecord3` は構造検査と凍結を行います。型・参照・ループ閉鎖・面と殻の所有・全域の領域対を検査しますが、構造の正しさだけで埋め込みや材料を認定しません。`volume` が実際の体積か、`sample` が実際の内部点かも構造検査だけでは保証しません。

所有されたCellularBodyの認定は、構築定義からの検査済み材料、完全な平面領域解析、有限面と全境界の照合を経て行います。復元は再計算した全レコードとの一致が必要で、幾何、向き、面側の領域、体積、内部点の改ざんを拒否します。任意の同値な面分割を同一と認めるインポーターではありません。

既存の境界変換処理へ渡す際に一時的な殻参照を補う内部アダプターがあります。これは構造と有限面を復元するためだけのもので、材料領域の意味や立体認定には使いません。保存レコードには含めません。旧Bodyレコードの読み取り形式は変更しません。

## 制限と後続課題

既存Bodyの全公開操作がCellularBodyを受けるようになったわけではありません。直線・レイ・材料区間の照会と相似変換は、既存Bodyと同じ入口へ接続しました。一般曲面の領域解析、曲面を含むCellularBody、任意の輸入BRepの認定、最近点・質量特性などの共通入口への統合は後続です。Body型を無条件に読み替える処理は追加しません。

平面配置と再構築・面領域の照合には時間とメモリが必要で、大規模モデルの性能上限は未保証です。構築DAGの制限は `CellularBodyReadLimits3`、レコードの構造予算はその `record` オプションで指定します。これらは実行時間の上限保証ではありません。
