# 共通Bodyの位置判定と保存復元

`KernelBody3 = Body3 | CellularBody3` は、現在の検査済みBody族を表します。通常Bodyの多様体条件と、接触境界を持つCellularBodyの領域条件は区別したまま、利用側の共通入口を増やします。

```ts
const body = booleanCellularBodies3(a, b, 'union');
const json = serializeBody3(body); // 通常のJSON文字列
const restored = restoreBody3(json); // CellularBody3 と推論
locateBody3(restored, point3(1n, 1n, 0n));
locateBodyFace3(restored, 0, restored.faces[0]!.sample);
```

`locateBody3` と `locateBodyFace3` は両方の所有モデルを受理します。CellularBodyでは材料構築に対応する厳密な点分類と、実際に保存・照合された有限面の位置判定を使います。面内部の点は材料境界上であっても、面に対する分類では `inside` です。コピーされたオブジェクトと、不正な面IDは拒否します。

`bodyDocument3` と `serializeBody3` は実際の所有モデルに応じた文書を返します。通常Bodyは従来の `BodyDocument3`、CellularBodyは `CellularBodyDocument3`。既存の保存形式やJSONの数値表現は変更せず、文字列へ独自の実行時メタデータを付けません。

`restoreBody3` は文書の明示的なタグを検査して、各族の再構築・全レコード照合へ渡します。通常Bodyは従来の意味的なレコード照合を維持し、CellularBodyは構築材料から境界と領域を再計算します。生のレコードや構造上閉じた接続だけから所有Bodyを作る入口ではありません。

## TypeScriptの戻り値

- 型付きの `BodyDocument3` は `Body3`、`CellularBodyDocument3` は `CellularBody3` へ復元します。
- `serializeBody3` の結果には、コンパイル時だけの文字列型 `SerializedBody3` が付きます。この文字列を直接復元すると、元のBody族を推論できます。呼び出し元が追加した任意のプロパティまで復元するとは型付けしません。
- ファイルやネットワークからの `unknown`、型情報のない文字列を復元した場合は `KernelBody3` を返します。型が不明なのに必ず多様体Bodyだとは宣言しません。これは未知入力に対する従来の戻り値より広い型なので、通常Body専用の操作へ渡す箇所では型の確認が必要です。

```ts
const data: unknown = JSON.parse(text);
const loaded = restoreBody3(data); // KernelBody3
locateBody3(loaded, p);
intersectBodyLine3(loaded, origin, direction);
const moved = transformBody3(loaded, similarity);
const moments = planarBodyVolumeMoments3(moved); // 対応する平面材料が必要
```

通常Bodyを `serializeBody3` → `restoreBody3` と直接渡す既存の経路は、引き続き `Body3` として型付けされます。未知入力であるのに型アサーションだけで通常Bodyへ読み替える使い方は推奨しません。

## 読取制限と範囲

`BodyReadLimits3` は従来の `maxItems`・`maxNumericCharacters` に加え、JSON解析前の `maxChars`、材料構築の `material` 予算を持ちます。文字数制限の既定値は、従来と同じ `maxNumericCharacters + 64 * maxItems` です。CellularBodyでは同じレコード予算を構造検査へ渡し、`material.maxNodes`・`material.maxVertices`・`material.maxCoordinateChars` を構築DAGの読取制限へ渡します。各予算は計算時間の上限保証ではありません。

専用のCellularBody保存復元APIは維持します。一般曲面のCellularBody、任意の輸入BRepの認定、すべての生成・編集操作の共通化は未完了です。対応する族の入口や受理条件を、位置判定・保存復元の共通化だけで拡大しません。
