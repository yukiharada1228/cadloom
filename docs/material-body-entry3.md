# 共通材料カーネルの明示的なBody入口

`booleanMaterialBodies3(first, second, operation)` は、対応する所有されたBodyを材料定義へ変換し、平面・円柱の共通分割、両側分類、縫合、領域解析、Body採用へ渡します。入力のどちらかが既に新方式であることは要求しません。`union` / `intersection` / `difference` / `xor` を受理し、結果は再構築可能な `surface-material-expression` です。

円柱と切断円柱は所有された幾何定義からプログラムを作ります。箱は `prepareBoxMaterialProgram3` で有限ガード円柱と六半空間の定義を作り、新経路では旧箱境界を事前構築しません。新方式のBodyは保持している所有された定義を再利用します。その他の対応する平面・押し出し・旧円柱演算結果は既存変換器の範囲で変換します。平面や押し出しの全変換経路が旧境界から独立したという意味ではありません。

旧 `booleanMixedBodies3` / `booleanCylinderBodies3` の旧入力対の演算と保存形式は維持します。新しい入口は共通経路を明示的に選びたい場合に使います。任意の輸入レコードや未対応曲面のBodyを認定する入口ではなく、所有確認・分割と領域検査・非多様体の拒否を省略しません。

```ts
const result = booleanMaterialBodies3(first, second, 'difference');
const restored = restoreBody3(serializeBody3(result));
const next = booleanMaterialBodies3(restored, third, 'union');
```
