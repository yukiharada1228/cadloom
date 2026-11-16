# 共通材料カーネルの明示的なBody入口

`booleanMaterialBodies3(first, second, operation)` は、対応する所有されたBodyを材料定義へ変換し、平面・円柱の共通分割、両側分類、縫合、領域解析、Body採用へ渡します。入力のどちらかが既に新方式であることは要求しません。`union` / `intersection` / `difference` / `xor` を受理し、従来の多様体限定経路の結果は、再構築可能な `surface-material-expression` です。

円柱と切断円柱は所有された幾何定義からプログラムを作ります。箱は `prepareBoxMaterialProgram3` で有限ガード円柱と六半空間の定義を作り、新経路では旧箱境界を事前構築しません。新方式のBodyは保持している所有された定義を再利用します。その他の対応する平面・押し出し・旧円柱演算結果は既存変換器の範囲で変換します。平面や押し出しの全変換経路が旧境界から独立したという意味ではありません。

旧 `booleanMixedBodies3` / `booleanCylinderBodies3` の旧入力対の演算と保存形式は維持します。新しい入口は共通経路を明示的に選びたい場合に使います。任意の輸入レコードや未対応曲面のBodyを認定する入口ではなく、所有確認・分割と領域検査・非多様体の拒否を省略しません。

```ts
const result = booleanMaterialBodies3(first, second, 'difference');
const restored = restoreBody3(serializeBody3(result));
const next = booleanMaterialBodies3(restored, third, 'union');
```


## 接触の保持とCellularBody

`booleanMaterialBodies3(a, b, operation, {contacts:'preserve'})` は、両入力が有理平面材料として受理できる場合、接触を含む結果を `CellularBody3` で返します。空結果や多様体になった結果も、この保持経路ではCellularBodyとして保存します。辺・頂点接触を捨てたり、閉じた殻だけで材料領域を宣言したりしません。既存の共通位置判定・保存復元・照会・変換・平面計測へそのまま渡せます。

通常の `Body3` 同士でオプションを省略した呼び出しは、従来の多様体限定経路と `Body3` の戻り値を維持します。`contacts:'reject'` も多様体を要求します。いずれかがCellularBodyの場合、オプション省略時は接触保持を既定とします。未知入力や保持モードの戻り値は `KernelBody3` です。

```ts
const contact = booleanMaterialBodies3(a, b, 'union', {contacts: 'preserve'});
const restored = restoreBody3(serializeBody3(contact));
const next = booleanMaterialBodies3(restored, b, 'difference');
```

CellularBodyと曲面Bodyを組み合わせる場合は、CellularBodyの所有された構築材料を共通プログラムへ変換します。元の接触を含む式を維持したまま共通の交差・分類・縫合へ渡し、結果が幾何的に多様体として認定できる場合に通常Bodyへ採用します。例えば、二つの箱が辺で接触していても、一方の内部にある円柱との積は有限円柱の多様体になります。

曲面を含む非多様体結果のCellularBody化は未実装です。`preserve` を指定していても、この未対応の曲面結果を捨てたり近似したりせず、多様体認定に失敗した場合は拒否します。一般NURBSや任意BRepへの拡張をこの入口の追加だけで認定しません。

`materialProgramOfPlanarMaterial3` は、検査済み立体葉を既存の平面材料コンパイラーへ渡し、各局所式を維持してBoolean合成します。返り値は所有された有界材料定義であり、縫合済み境界や領域の認定ではありません。コンパイル中の共有部分式は再利用しますが、最終の木形式・プリミティブ表は合成時に展開され得るため、DAG保存形式と同じ大きさになるとは保証しません。
