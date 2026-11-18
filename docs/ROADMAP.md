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
| M3 | `primitive`（円柱、球、円錐、トーラス）、`prism`、`profile`、`sweep` | `primitive`、`prism`、`profile`、`sweep` | 52k | 押し出しや回転の位相計数 |
| M4 | `intersect`（曲線/曲線、曲線/曲面、曲面/曲面）、`query` | `intersect`、`query`、`ssi` | 108k | 区間演算による交差の除外の健全性 |
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
