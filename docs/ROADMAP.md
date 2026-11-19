# ロードマップ

upstreamのsolidcore（`solidcore/crates/solidcore/src`、Rust約98万行）のモジュールを、依存の順にマイルストーンへ割り当てます。行数はupstreamのテストを含む規模の目安で、移植量の目安ではありません。

| M | cadloomのモジュール | upstreamの対応 | 規模 | 主なLean証明 |
|---|---|---|---|---|
| **M0** | `core`、`math`、`exact` | `error`、`kernel`、`limits`、`math` | 1k | ベクトル恒等式、厳密な向き判定の符号の性質、倍精度値から二進有理数への変換 |
| **M0** | `nurbs`（基礎） | `nurbs/knots`、`basis_basic`、`crv_basic`、`bezier` | 一部 | de Boorでの単位の分割（凸結合）、ノット挿入による形状保存、de Casteljauの端点補間 |
| **M0** | `topology`（基礎）、`primitive/box`、`mass`（多面体） | `topology/brep*`、`primitive`、`mass` | 一部 | Euler–Poincaré（V−E+F=2）、発散定理による多面体の体積、箱の体積=w·h·d |
| **M1** | `nurbs`（曲面、微分、次数上げ） | `nurbs/srf_*`、`bezier`、`crv_tool` | 一部 | テンソル積de Boorの順序非依存・凸包性・等パラメーター曲線の一致、Bézier次数上げの端点・凸結合・形状保存（次数1・2） |
| **M1** | `curve`、`surface`（解析曲線・曲面とNURBS形式） | `curve`、`surface`、`geom`、`eval` | 一部 | A7.1の円弧が全パラメーターで円上、回転面A8.1が球・トーラス・円錐上、陰関数、法線の向きとGauss・平均曲率 |
| **M2** | `record`、`convert`、`tess`（表示メッシュ）、`topology`（解析幾何つきB-repの検証） | `solidcore-record`、`-convert`、`-tess`、`topology` | 30k | メッシュの水密性（各辺の使用回数が2）、耳切りの三角形数と面積の保存、recordの範囲検査の健全性・完全性と符号化の往復、継ぎ目のある円柱のEuler–Poincaréと対の保存 |
| **M3** | `primitive`（円柱、球、円錐、トーラス）、`prism`、`profile`、`sweep` | `primitive`、`prism`、`profile`、`sweep` | 52k | 押し出しや回転の位相計数 |
| **M4** | `interval`、`intersect`（曲線/曲線、曲線/曲面、曲面/曲面）、`query` | `intersect`、`query`、`ssi` | 108k | 区間演算と箱の分離による交差の除外の健全性、細分の完全性（作業リストのモデル）、Krawczyk作用素、閉じた式の正しさ、半開の交差規則の偶奇と向きへの不変性 |
| M5 | `boolean`、`heal`（縫合） | `boolean`、`heal` | 48k | 正則化した集合演算の代数法則（モデル） |
| M6 | `offset`（シェル）、`blend`（フィレット、面取り） | `offset`、`blend` | 242k | 転がり球の接触条件 |
| M7 | `ops`（モデリング操作API）、STEPの入出力 | `solidcore-ops`、`solidcore-step` | 50k | — |

各マイルストーンは[POLICY.md](POLICY.md) §6の流れで進め、`npm run check`が通った状態で完了とします。

## 状況

- **M0**: 完了。証明の対応表は[proofs/M0.md](proofs/M0.md)。
- **M1**: 実装済み（`npm run check`が通過）。証明の対応表は[proofs/M1.md](proofs/M1.md)。M1から後送りしたもの: NURBSのフィット（補間・近似）、偏微分とA5.9のLean証明（テストのみ）、最近点・射影の大域最小の保証、主方向、NURBSの陰関数による証明書。
- **M2**: 実装済み（`npm run check`が通過。テスト295件、Lean 12モジュール・270定理）。証明の対応表は[proofs/M2.md](proofs/M2.md)。M2から後送りしたもの:
  - recordの中立STEPモデル、upstreamの許容誤差・領域（void）・ワイヤー・頂点だけの殻、折れ線・交線・回転面・ブレンド面の種類（M5〜M7で、対応する形状とともに）。ビルダー順でないrecordの番号の付け直し。
  - 信頼できない`Brep`値（型を満たさない値）の検証で`TypeError`を投げずに`Result`を返すこと（現状はrecord/convertを通す）。ループの`(u, v)`での巻き数・自己交差の検査、pcurveのパラメーターの1対1対応の検査。
  - tessの面のたわみの真の最大値の保証（現状は重心で確認）、耳切りの`O(n²)`の改善、球の極・円錐の頂点を含む試験体（M3のプリミティブで）、穴が頂点で接する面。
  - Leanでの幾何の検査・Lawsonの辺の入れ替え・格子点の挿入・浮動小数点のモデル化。
  - `planePcurve`でのNURBS辺の部分区間への切り出し。
- **M3**: 実装済み（`npm run check`が通過。テスト399件、Lean 16モジュール・401定理）。証明の対応表は[proofs/M3.md](proofs/M3.md)。曲面のプリミティブ（円柱・円錐・球・トーラス、極は辺のない頂点）、`profile`（線分・円弧・NURBSのワイヤーの検証と面積）、`prism`（押し出し、共有の配置`buildPrismRegion`）、`sweep`（回転とPappusの体積、回転最小化標構、パスに沿うスイープ）。M3から後送りしたもの:
  - 部分的なプリミティブ（扇形）、裏返しの球、極のない球、楕円錐、プリミティブの厳密な質量特性（`mass`）。曲面を持つ物体の厳密な体積（現状は`prismVolume`・`revolveVolume`の面積・Pappusの式と、メッシュの体積との比較）。
  - NURBSのフィット（`src/sweep/interpolate.ts`の大域補間を`src/nurbs`へ移すこと、近似）。スキンのスイープの、測ったステーションの間と標構の誤差の上界。スイープの自己交差の検査と、曲がり具合のステーション以外での検査。
  - 有理NURBS曲面の評価のキャッシュ（`homogeneousNet`の作り直し）、平面のNURBS面の格子の上限、半径の違う円錐台の側面の標本化（上下の円の標本の対応）。
  - Leanでの押し出し・回転の`Paired`の全ての大きさのリストでの証明（現状は具体例で判定）、極のある回転の位相、円弧・NURBSのGreenモーメント、二重反射法の収束。
- **M4**: 実装済み（`npm run check`が通過。テスト539件、Lean 20モジュール・538定理）。証明の対応表は[proofs/M4.md](proofs/M4.md)。`interval`（外向き丸めの区間演算、証明つきの包含箱と法線錐）、`intersect`（曲線/曲線、曲線/曲面、レイ、曲面/曲面。結果は必ずexact・certified・名指しの拒否のどれか）、`query`（物体の包含箱、面の`(u, v)`での内外、レイと点の分類、最近点と距離、長さと面積）。M4から後送りしたもの:
  - 交差の結果の面のトリム（閉じた式の成分は解析曲面の全体、NURBSはノットの領域で報告）と、`SurfaceIntersection`を面の交線にする処理（M5の集合演算で）。曲面/曲面の境界の探索を曲線/曲面の交差に通すこと（現状は固定パラメーターのNewton法での磨き上げ）。
  - 特異な分岐点（鞍点、等しい半径の円柱の8の字）と球の極を通る交線の解決（現状は`tangent contact not resolved`での拒否）、平面/円錐の放物線・双曲線の閉じた式、斜めの平面/円柱の楕円・平面/円錐の断面のLeanの証明。
  - 重なり・接触・拒否の区別（17点の標本）、曲面/曲面の完全性の「覆われている」判定、フィットした曲線の区間の間の偏差の上界の証明。曲線/NURBS曲面の3×3の一意性の判定の証明。Newton法の収束の証明。
  - 区間の`sin`・`cos`、ノット挿入の丸め誤差の上界、IEEE-754の方向付き丸めのLeanでのモデル化。
  - `query`: 曲がったトリムの厳密な`(u, v)`領域（現状は多角形と帯）、トーラス・NURBSの最近点の大域最小の保証、楕円・NURBSの辺の距離、トリムした面の狭い包含箱、Jordan曲線定理の証明。
  - 接触・近接の曲線の交差の速さ（1件0.3〜1秒）と、`1e12`の規模の曲線の細分の予算。
