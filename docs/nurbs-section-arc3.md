# NURBS平面交差枝の有限区間

`nurbsSectionArc3(section, piece, edge, lower?, upper?, direction=1)` は、所有された交差グラフの単一の辺を、正の幅を持つ有限パラメータ区間として切り出します。境界値は有理数・代数的実数のまま保持します。交差枝を有理NURBS曲線や折れ線へ近似変換する処理ではありません。

```ts
const arc = nurbsSectionArc3(section, pieceId, edgeId);
const fragments = splitNurbsSectionArc3(arc, ['1/2', algebraicCut]);
const backward = reverseNurbsSectionArc3(arc);
const subarc = restrictNurbsSectionArc3(backward, lower, upper);
const point = nurbsSectionArcPoint3(subarc, parameter);
const differential = nurbsSectionArcDifferential3(subarc, parameter);
```

## 範囲と向き

`lower`・`upper` を省略すると元のグラフ辺の全閉区間を使います。指定する場合は常に `lower < upper` で、元の辺の範囲内にある必要があります。長さゼロのパラメータ区間は拒否します。

`coordinate` は元のグラフ辺の座標です。通常の枝はu、垂直な辺はvで、正規化した `[0,1]` ではありません。`direction:-1` の場合も境界値は昇順のままですが、空間の `start` と `end` は逆になります。反転はこの巡回方向を変え、元のパラメータやパッチ番号は変えません。

点・微分の照会は、この有限区間の閉範囲を検査します。微分が返す局所独立座標は[交差枝微分](nurbs-section-differential3.md)の規則に従い、投影臨界点ではarcの元の座標と異なる場合があります。反転しても、微分は明示された局所座標が増える向きの微分です。arcの巡回に沿う正規化パラメータの微分ではありません。

## 分割と制限

`restrictNurbsSectionArc3` は既存arcの範囲内にだけ制限できます。元のsection全体の範囲へ戻して拡張することはできません。

`splitNurbsSectionArc3` は全切断値を厳密に比較して整列・重複除去し、元の区間を隙間もパラメータ重複もない正の幅の区間へ分けます。隣接区間は端点だけを共有します。入力端点と同じ切断値は追加のゼロ幅片を作らず、範囲外の切断値はエラーです。返す配列は巡回順で、反転arcでは降順に並ぶ区間群となります。各片の `direction` は元のarcと同じです。入力の切断値配列は変更しません。

## 由来と認定の区別

結果は不変で、元の所有された `section`、実際の `piece`・`edge`、元の座標と境界値を保持します。全操作は所有されたarcだけを受理し、コピーしたオブジェクトは拒否します。sectionを他のオブジェクトへ差し替えてパッチや枝の所有を偽装することはできません。

これはパラメータグラフの有限区間の認定です。空間像の単純性・埋め込み・非停留性を認定しません。端点が空間で一致しても、その間で折り返す非定数の像かもしれないため、区間を捨てたり単純閉曲線と認定したりしません。同じ節点パラメータでも、別の不連続パッチは別の空間像として保持します。

トリム領域との交差、別の枝同士の空間一致・接続判定、BRep辺の採用、保存交換レコード、一般NURBS Bodyの認定は後続です。この型を既存の単純な `PreparedNurbsEdge3` と同一視しません。時間・メモリの上限も未保証です。
