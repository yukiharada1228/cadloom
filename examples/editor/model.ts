import { Rational, point2, extrudePolygon } from "../../dist/index.js";
import type { ExtrudedMesh } from "../../dist/index.js";

export interface HoleParameters { readonly x: string; readonly y: string; readonly width: string; readonly depth: string }
export interface PlateParameters {
  readonly width: string;
  readonly depth: string;
  readonly thickness: string;
  readonly hole: HoleParameters | null;
}
export interface PlateDocument {
  readonly format: "cadloom.plate";
  readonly version: 1;
  readonly parameters: PlateParameters;
}
export interface PlateModel { readonly document: PlateDocument; readonly mesh: ExtrudedMesh }
export const defaultParameters: PlateParameters = Object.freeze({
  width: "8", depth: "8", thickness: "2",
  hole: Object.freeze({ x: "2", y: "2", width: "4", depth: "4" }),
});
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new TypeError("寸法データの形式が正しくありません");
  return value as Record<string, unknown>;
}
function positive(value: unknown, label: string): Rational {
  if (typeof value !== "string") throw new TypeError(`${label}は文字列で指定してください`);
  let parsed: Rational;
  try { parsed = Rational.parse(value); }
  catch { throw new TypeError(`${label}には整数・小数・分数を入力してください`); }
  if (parsed.sign() <= 0) throw new RangeError(`${label}は0より大きくしてください`);
  return parsed;
}

/** Source dimensions are authoritative; all derived geometry is recomputed exactly. */
export function buildPlate(input: unknown): PlateModel {
  const data = record(input);
  const width = positive(data.width, "板の幅"), depth = positive(data.depth, "板の奥行き");
  const thickness = positive(data.thickness, "板の厚さ");
  const zero = new Rational(0n);
  const rectangle = (x: Rational, y: Rational, w: Rational, d: Rational) => [
    point2(x,y), point2(x.add(w),y), point2(x.add(w),y.add(d)), point2(x,y.add(d)),
  ];
  const region = [rectangle(zero,zero,width,depth)];
  let hole: HoleParameters | null = null;
  if (data.hole !== null) {
    const h = record(data.hole);
    const x = positive(h.x,"穴の左位置"), y = positive(h.y,"穴の手前位置");
    const w = positive(h.width,"穴の幅"), d = positive(h.depth,"穴の奥行き");
    if (x.add(w).compare(width) >= 0 || y.add(d).compare(depth) >= 0) {
      throw new RangeError("穴は板の内側に収めてください（外周との接触はできません）");
    }
    region.push(rectangle(x,y,w,d));
    hole = Object.freeze({x:x.toString(),y:y.toString(),width:w.toString(),depth:d.toString()});
  }
  const parameters = Object.freeze({width:width.toString(),depth:depth.toString(),thickness:thickness.toString(),hole});
  const document: PlateDocument = Object.freeze({format:"cadloom.plate",version:1,parameters});
  return Object.freeze({document,mesh:extrudePolygon(region,thickness)});
}

/** Includes an exact geometry snapshot for inspection; parameters drive restoration. */
export function serializePlate(model: PlateModel): string {
  return JSON.stringify({...model.document,mesh:model.mesh},null,2)+"\n";
}
export function restorePlate(text: string): PlateModel {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new SyntaxError("JSONファイルを読み取れません"); }
  const data = record(parsed);
  if (data.format !== "cadloom.plate" || data.version !== 1) {
    throw new TypeError("対応していないファイル形式・バージョンです");
  }
  return buildPlate(data.parameters);
}
