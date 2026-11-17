# ロードマップ

upstreamのsolidcore（`solidcore/crates/solidcore/src`、Rust約98万行）のモジュールを、依存の順にマイルストーンへ割り当てます。行数はupstreamのテストを含む規模の目安で、移植量の目安ではありません。

| M | cadloomのモジュール | upstreamの対応 | 規模 | 主なLean証明 |
|---|---|---|---|---|
| **M0** | `core`、`math`、`exact` | `error`、`kernel`、`limits`、`math` | 1k | ベクトル恒等式、厳密な向き判定の符号の性質、倍精度値から二進有理数への変換 |
| **M0** | `nurbs`（基礎） | `nurbs/knots`、`basis_basic`、`crv_basic`、`bezier` | 一部 | de Boorでの単位の分割（凸結合）、ノット挿入による形状保存、de Casteljauの端点補間 |
| **M0** | `topology`（基礎）、`primitive/box`、`mass`（多面体） | `topology/brep*`、`primitive`、`mass` | 一部 | Euler–Poincaré（V−E+F=2）、発散定理による多面体の体積、箱の体積=w·h·d |
| M1 | `nurbs`（曲面、微分、次数上げ、フィット） | `nurbs/*` | 85k | 偏微分の公式、次数上げの不変性 |
| M1 | `curve`、`surface`（解析曲線・曲面とNURBS形式） | `curve`、`surface`、`geom`、`eval` | 280k | 解析形状とNURBS形式の一致（有理パラメーター化） |
| M2 | `record`、`convert`、`tess`（表示メッシュ） | `solidcore-record`、`-convert`、`-tess` | 30k | メッシュの水密性（各辺の使用回数が2） |
| M3 | `primitive`（円柱、球、円錐、トーラス）、`prism`、`profile`、`sweep` | `primitive`、`prism`、`profile`、`sweep` | 52k | 押し出しや回転の位相計数 |
| M4 | `intersect`（曲線/曲線、曲線/曲面、曲面/曲面）、`query` | `intersect`、`query`、`ssi` | 108k | 区間演算による交差の除外の健全性 |
| M5 | `boolean`、`heal`（縫合） | `boolean`、`heal` | 48k | 正則化した集合演算の代数法則（モデル） |
| M6 | `offset`（シェル）、`blend`（フィレット、面取り） | `offset`、`blend` | 242k | 転がり球の接触条件 |
| M7 | `ops`（モデリング操作API）、STEPの入出力 | `solidcore-ops`、`solidcore-step` | 50k | — |

各マイルストーンは[POLICY.md](POLICY.md) §6の流れで進め、`npm run check`が通った状態で完了とします。
