# NURBS平面交差枝の厳密な微分

`nurbsPlaneSectionEdgeDifferential3(section, piece, edge, parameter)` は、所有されたNURBS平面交差グラフの枝を評価し、対応する空間曲線の接線・二階微分・曲率の二乗を返します。既存のグラフと枝の選択を使うので、サンプル点を結ぶ折れ線の微分ではありません。

```ts
const section = intersectNurbsSurfacePlane3(surface, plane);
const d = nurbsPlaneSectionEdgeDifferential3(section, pieceId, edgeId, '1/2');
if (d.kind === 'regular') {
  const tangent = d.derivative;
  const squaredCurvature = d.curvatureSquared;
}
```

## パラメータと局所座標

入力 `parameter` の規則は既存の枝評価と同じです。通常の枝ではu、垂直なパラメータ辺ではvです。有効な枝の閉区間内で評価し、元の所有されたパッチを直接使います。節点で別のパッチの微分を選び直すことはありません。コピーしたsection、不正なpiece・edge番号、範囲外の値は拒否します。

通常の枝では、グラフが保持する重複因子を除いた非垂直暗黙式 `F(u,v)=0` を使います。`F_v != 0` なら、返す局所独立座標は `coordinate:'u'` で、次を計算します。

- `v'=-F_u/F_v`
- `v''=-(F_uu + 2 F_uv v' + F_vv (v')²)/F_v`
- `C'=S_u + S_v v'`
- `C''=S_uu + 2 S_uv v' + S_vv (v')² + S_v v''`

投影臨界点で `F_v=0` でも `F_u != 0` ならuとvを交換し、`coordinate:'v'` の局所微分を返します。入力parameterの規則自体を変更するものではありません。返す座標が増える向きは、グラフの巡回方向とは限りません。元の辺の入力座標での微分が無限になる点でも、有効な別座標での有限な局所微分を取得できます。

垂直辺はグラフが選択した定数uの枝として `C'=S_v`、`C''=S_vv` を使います。元の平面方程式に接触の重複因子があっても、正しい枝をゼロ勾配と誤認しません。

## 結果と保証の範囲

全結果に正確な空間 `point` と `parameterPoint:{u,v}` を保持します。

- `kind:'regular'`：非ゼロの空間速度と二階微分、`curvatureSquared=|C'×C''|²/|C'|⁶` を返します。
- `kind:'singular-parameter'`：重複因子を除いた暗黙式でも両偏微分がゼロです。この枝について高次の局所展開は解かず、微分を返しません。幾何的な特異点との断定ではなく、交差する個々の枝は滑らかな場合もあります。
- `kind:'stationary-image'`：局所パラメータの微分は得られますが、空間速度がゼロです。接線を正規化せず、二階微分までを保持し、曲率は返しません。空間の曲線集合そのものが特異との断定ではありません。

孤立接触点には元から辺がなく、平面に含まれるパッチは二次元領域です。このAPIでそれらを一次元の曲線へ変換しません。値は有理数・代数的実数の厳密計算で、有限差分やε判定を使いません。

トリム領域による新しい枝分割、空間自己交差の同一視、一般NURBS BodyやBRep曲線レコードへの採用、特異枝のPuiseux展開、CAD全体のフィレット処理は未実装です。計算時間とメモリの上限も未保証です。
