import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { point2, segment2, intersectSegments } from "../dist/index.js";
import type { Point2, Segment2 } from "../dist/index.js";

// JSON coordinates are strings, never floating-point JSON numbers.
const inputPath = process.argv[2];
const loaded: unknown = inputPath ? JSON.parse(await readFile(inputPath, "utf8")) : {
  a: [["0", "0"], ["1", "1"]], b: [["0", "1"], ["2", "0"]],
};
// Both a raw fixture and the saved diagnostic artifact can be replayed.
const fixture = typeof loaded === "object" && loaded !== null && "input" in loaded
  ? loaded.input : loaded;
function parseSegment(value: unknown): Segment2 {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError("Expected two endpoints");
  const points = value.map(v => {
    if (!Array.isArray(v) || v.length !== 2 || !v.every(x => typeof x === "string")) {
      throw new TypeError("Each point requires two exact coordinate strings");
    }
    return point2(v[0], v[1]);
  });
  return segment2(points[0]!, points[1]!);
}
if (typeof fixture !== "object" || fixture === null || !("a" in fixture) || !("b" in fixture)) {
  throw new TypeError("Expected { a: [[x,y],[x,y]], b: [[x,y],[x,y]] }");
}
const a = parseSegment(fixture.a), b = parseSegment(fixture.b);
const result = intersectSegments(a, b);
const output = resolve(process.argv[3] ?? "artifacts");
await mkdir(output, { recursive: true });
// Persist exact input/output before attempting any approximate visualization.
await writeFile(resolve(output, "intersection.json"), JSON.stringify({ input: fixture, result }, null, 2) + "\n");

const points = [a.start, a.end, b.start, b.end];
const min = (values: Point2[], axis: "x" | "y") => values.reduce((v, p) => p[axis].compare(v) < 0 ? p[axis] : v, values[0]![axis]);
const max = (values: Point2[], axis: "x" | "y") => values.reduce((v, p) => p[axis].compare(v) > 0 ? p[axis] : v, values[0]![axis]);
const minX = min(points, "x"), minY = min(points, "y");
const width = max(points, "x").sub(minX), height = max(points, "y").sub(minY);
const extent = width.compare(height) >= 0 ? width : height;
// Normalize exactly first; bounded fixed-point conversion avoids Infinity/Infinity.
function display(p: Point2): [number, number] {
  const project = (axis: "x" | "y") => {
    if (extent.sign() === 0) return 240;
    const t = p[axis].sub(axis === "x" ? minX : minY).div(extent);
    return 40 + Number(t.numerator * 400000000n / t.denominator) / 1000000;
  };
  return [project("x"), 480 - project("y")];
}
function line(s: Segment2, color: string, stroke = 3): string {
  const [x1,y1] = display(s.start), [x2,y2] = display(s.end);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${stroke}"/>`;
}
let highlight = "";
if (result.kind === "point") {
  const [cx, cy] = display(result.point);
  highlight = `<circle cx="${cx}" cy="${cy}" r="6" fill="#15803d"/>`;
} else if (result.kind === "overlap") highlight = line(result.segment, "#15803d", 7);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 520" role="img" aria-label="Exact segment intersection: ${result.kind}">
<rect width="480" height="520" fill="white"/>
${line(a, "#2563eb")}${line(b, "#dc2626")}${highlight}
<text x="20" y="505" font-family="sans-serif" font-size="14">${result.kind} — approximate display; exact result in JSON</text>
</svg>\n`;
await writeFile(resolve(output, "intersection.svg"), svg);
console.log(JSON.stringify(result, null, 2));
console.log(`Saved ${output}/intersection.{json,svg}`);
