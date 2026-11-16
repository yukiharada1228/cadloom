# 完了した全体回帰のコミット照合 — 版191

2026-11-16時点で完了していた版164〜172の9実行を監査した。いずれも失敗・キャンセル・スキップ0。以下の件数は各実行の成功数であり、重複するテストを合計して新規テスト数とは扱わない。

| 版 | 対象コミット | 成功 | ソース | 実行テストファイル | 再ビルド生成物 | PR |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| 164 | [`fdd8f31`](https://github.com/yukiharada1228/cadloom/commit/fdd8f31dd6ba2b591d3f7de0d9e1ba24b8ba6008) | 1130 | 182 | 208 | 364 | [#177](https://github.com/yukiharada1228/cadloom/pull/177) |
| 165 | [`0bd0fcb`](https://github.com/yukiharada1228/cadloom/commit/0bd0fcbcb53ece71488f136f93e8e3d41c8c9eb9) | 1136 | 183 | 209 | 366 | [#178](https://github.com/yukiharada1228/cadloom/pull/178) |
| 166 | [`294c228`](https://github.com/yukiharada1228/cadloom/commit/294c228197455e2377098c6cd829ed5ee14c79c1) | 1142 | 186 | 210 | 372 | [#179](https://github.com/yukiharada1228/cadloom/pull/179) |
| 167 | [`3341ff0`](https://github.com/yukiharada1228/cadloom/commit/3341ff0ebee0e39a5668ee702c5d3734246e7b50) | 1152 | 187 | 212 | 374 | [#180](https://github.com/yukiharada1228/cadloom/pull/180) |
| 168 | [`62305a6`](https://github.com/yukiharada1228/cadloom/commit/62305a6cdf1f361d0d5ae62515a9c3c51f0b18c1) | 1158 | 188 | 213 | 376 | [#181](https://github.com/yukiharada1228/cadloom/pull/181) |
| 169 | [`f4c2722`](https://github.com/yukiharada1228/cadloom/commit/f4c27225d45c183ca922be590d5d7bea2c9d99e7) | 1163 | 189 | 214 | 378 | [#182](https://github.com/yukiharada1228/cadloom/pull/182) |
| 170 | [`0e9f648`](https://github.com/yukiharada1228/cadloom/commit/0e9f648e7963afeb8ab4476fda7995e829c72c11) | 1167 | 189 | 215 | 378 | [#183](https://github.com/yukiharada1228/cadloom/pull/183) |
| 171 | [`fe80fa1`](https://github.com/yukiharada1228/cadloom/commit/fe80fa1060ecc673378ff30ed3fd55c0cae61408) | 1173 | 191 | 216 | 382 | [#184](https://github.com/yukiharada1228/cadloom/pull/184) |
| 172 | [`bf8a1e2`](https://github.com/yukiharada1228/cadloom/commit/bf8a1e26f995126761ec96ee4c4871f72021a5c5) | 1180 | 193 | 218 | 386 | [#185](https://github.com/yukiharada1228/cadloom/pull/185) |

## 照合した入力と実行結果

1. 各コミットからsrc、tests、package.json、tsconfig.json、ソースSHA記録を取得し、保存した提出対象スナップショットへ全バイト照合した。ソース一覧と各SHAも一致した。
2. 実際に実行した全テストファイルを、コミットのテストのdist参照だけを実行ビルドの絶対パスへ置き換えた内容と照合した。全fixturesもバイト一致した。
3. 各コミットを新しい出力先へ再ビルドし、全JavaScript・型定義の一覧と全バイトが実行時のビルドに一致することを検査した。実行済みスナップショットは変更していない。
4. 終端ログの成功・失敗・キャンセル・スキップ・所要時間を確認した。PR #177〜#185の未完了の検証記録を、対象コミットを明記した完了結果へ更新した。

固定した平面Body fixtureは全9実行で680720バイト、SHA-256 `ee1a2ff6945a62190d9d8ea0d9db35a3527ef1acd9f9aa7c65aa686f020a6903`のまま一致した。fixtureは再生成していない。

[機械可読の監査結果](verification/regression-audit191.json)に所要時間、全コミットID、Node/TypeScript版、実行ログ・ソース一覧・実行テスト一覧・生成物一覧のSHAを記録する。SHAは入力の対応を識別するためであり、幾何学的正しさの証明ではない。

## 未完了の範囲

確認時点では版173の全体回帰が並列数2で実行中で、後続は順に待機していた。最新版の版190（ソースコミット875034c）の全体回帰が完了したとは扱わない。新しい全体回帰を重ねて起動せず、既存の逐次キューを継続する。

今回の監査は既存の実行結果の対象と再現性を確定するもので、ソフトウェア全体の形式証明、SolidCraft互換の完成、一般NURBS BRep・埋め込み・材料認定を意味しない。マージ・npm公開は行っていない。
