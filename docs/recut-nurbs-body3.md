# 再切断NURBS材料を共通Bodyへ採用

`bodyFromRecutNurbsMaterial3` は、所有された材料証明書だけを `RecutNurbsBody3` として採用します。元の有限NURBS曲線・面・旧キャップ・新キャップの共通B-repを保持し、メッシュへ置き換えません。材料region・空洞・厳密な内部サンプルも同じ証明書から保持します。構造的なコピーや保存した認定フラグをBodyの所有権として受け付けません。

## 公開操作

`KernelBody3` はこのfamilyを含み、`locateBody3` / `locateBodyFace3`、`intersectBodyLine3` / `intersectBodyRay3` / `intersectBodyLineMaterial3`、`bodyDocument3` / `serializeBody3` / `restoreBody3`、`transformBody3` が所有されたバックエンドへ分岐します。既知familyのoverloadとserialized brandは復元後もRecutNurbsBody3を保持します。

既に一回切断された `CappedNurbsBody3` に対し、`createRecutNurbsBody3` は選んだ片側だけを構築・認定します。`splitCappedNurbsBodyByPlane3` と共通 `splitBodyByPlane3` は両側を認定して返します。前の有限source面を再分割し、元の共有辺と旧キャップの境界を全区間で対応し、新キャップと閉接続、埋め込み、殻包含、実際の向き、材料サンプルを全て検査してから採用します。片側に隠れた接触があっても、認定可能なもう一方は単独構築できます。

現在のrecordと構築経路は二つの切断です。三回目の切断、一般NURBS Boolean、NURBSのnative split-interface/rejoinへの変換は未対応として明示的に拒否します。これらや商用CAD全形式への対応が完成したという意味ではありません。

## Source-only保存と再検証

`RecutNurbsBodyDocument3` は元のNURBS構築入力を持つ一回切断parentと、今回の有理平面・選択側だけを保存します。B-rep面番号や材料認定フラグは保存しません。`readRecutNurbsBodyDocument3` は一つのRecordReaderを入れ子全体に適用し、項目数・数値文字数、未知のフィールド、sideやrational文字列の形式を検査します。

`restoreBody3` は文字数制限後にJSONを読み、parentの全認定を再構築し、今回の分割・共有・埋め込み・材料認定を再実行します。平面を変更した有効な構築入力は変更後の形状として再計算されます。隠れた接触を生じる入力は、JSON形式が正しくてもBodyにはなりません。

相似変換では元のsourceとtargetを変換し、二つの平面の法線を共変ベクトルとして変換してoffsetへ平行移動を反映します。反射時は元面のsenseも反転し、変換後の材料を再認定します。

## 検証範囲

公開二回切断と材料証明書の直接採用、点・面・交差照会、型付き保存復元、構築入力変更、反射とスケール、負側の一回目・二回目、非線形nativeパラメータ、空洞と島、空parent、認定不能な接触の構築・復元拒否を検査します。三回目の切断や未実装のNURBS操作をサポート済みに見せません。


提出対象の隔離スナップショットとgit indexを比較し、実行ソース300ファイル・src/testsのTypeScript合計606ファイルがbyte単位で一致しました。ライブラリのビルドと、新規2ファイルおよび既存capped Body・query・similarity・plane splitの計6テストファイルの追加strict型検査は成功しています。77ファイルの実行回帰は368件中367件成功・1件失敗でした（743030.985541 ms、キャンセル・スキップ0）。失敗は既存capped Bodyテストの「二回目の切断は未実装で例外になる」という古い期待値です。両側の再切断結果の閉接続・元材料への制限・内部サンプルを確認する期待値へ更新し、更新後の同ファイルは6件全て成功しました（8754.138125 ms）。両隔離スナップショットの差分はそのテスト1ファイルのみで、実行ソース300ファイルは同一です。77ファイルを更新後の版で一括再実行した結果とは主張しません。

追加strict型検査を既存body-facadeテストへ広げると、復元したKernelBody3を平面専用APIへ渡す箇所（35・36・38行）にTS2345が残ります。同じ3箇所が変更前の隔離スナップショットでも失敗することを確認しました。通常のライブラリビルドの失敗とは区別し、body-facadeの実行テストは上記77ファイルに含めます。
