# 曲面交差辺の厳密な微分

一般のsource NURBSと、所有されたアフィン逆写像を持つtarget NURBSの交差辺を対象にする。任意の曲面同士の交差や、一般B-repブーリアンの完成を意味しない。

## 公開入口

- `nurbsAffineIntersectionEdgeDifferential3(report, patch, edge, parameter)`
- `trimmedNurbsAffineIntersectionEdgeDifferential3(report, patch, edge, parameter)`
- `nurbsAffineIntersectionComplexEdgeDifferential3(complex, edge, use, parameter)`

各入口は所有された交差結果と閉じた辺の範囲を検査する。トリム版は両方の有限面領域も検査する。complex版は明示されたincident useの片側パッチを使う。継ぎ目の法線を平均しない。

## 計算と契約

選択された平方因子を除いた陰関数F(u,v)=0を微分する。vが従属変数ならv′=−Fu/Fv、v″=−(Fuu+2Fuv v′+Fvv v′²)/Fv。投影の臨界点では可能なら独立座標を交換する。反復接触因子から偽の特異性を作らない。

source UVの一階・二階微分を曲面の二階連鎖律で3Dへ写す。target UVの微分はアフィン逆写像の線形部で求める。平行移動成分は微分しない。target曲面から独立に再構成した一階・二階の3D微分との厳密な等値、および両法線と接線の直交を検査する。有理数・代数的数を使用し、許容誤差による一致判定を使わない。

戻り値はsource/target UVの一階・二階微分、3Dの一階・二階微分、両面の法線を保持する。法線は正のUV方向のdu×dvで、単位化せず、トリム領域のsenseも掛けない。`orientation`は局所増加座標の接線とsourceNormal×targetNormalの内積の符号であり、coedgeの進行方向や材料の内外を表さない。

- `regular`: 3D接線が非零。曲率の二乗を返す。
- `stationary-image`: パラメータ曲線は微分できるが3D一階微分が零。二階微分を保持し、正則曲率を主張しない。
- `singular-parameter`: 平方因子除去後も陰関数の勾配が零。接線を推測せず、未解決として返す。

`transverse`は評価点での両法線の外積が非零であることを示す。辺全体の横断性、C1/G1連続性、面の埋め込みを認定しない。既存の平面断面微分APIは内部計算を共有するが、戻り値の公開形状を維持する。

## 検証と残る統合

新規8ケースは双曲線の独立式、有理・代数的パラメータ、円の投影臨界点、反復接触、静止像、特異勾配、両側の継ぎ目、穴のトリム制限、有理重み、巨大平行移動とせん断を扱う。関連する既存断面・曲率・交差・縫合を合わせた47ケースが成功した。これはテストによる検証であり、TypeScript全体の形式証明ではない。

次は辺全体の正則性・接触イベントによる分割と、向き付き面分割への受け渡しが必要。B-repへの採用、材料分類、一般target曲面への拡張は未完了。
