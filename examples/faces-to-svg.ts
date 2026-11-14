import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { point2, segment2, buildFaces } from "../dist/index.js";
import type { Point2 } from "../dist/index.js";

const loaded: unknown = process.argv[2]
  ? JSON.parse(await readFile(process.argv[2], "utf8"))
  : { segments: [
    [["0", "0"], ["2", "0"]], [["2", "0"], ["2", "2"]],
    [["2", "2"], ["0", "2"]], [["0", "2"], ["0", "0"]],
    [["1", "1"], ["3", "1"]], [["3", "1"], ["3", "3"]],
    [["3", "3"], ["1", "3"]], [["1", "3"], ["1", "1"]],
  ] };
const fixture = typeof loaded === "object" && loaded !== null && "input" in loaded ? loaded.input : loaded;
if (typeof fixture !== "object" || fixture === null || !("segments" in fixture) || !Array.isArray(fixture.segments)) {
  throw new TypeError("Expected { segments: [[[x,y],[x,y]], ...] } using exact strings");
}
function parsePoint(value: unknown): Point2 {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(v => typeof v === "string")) {
    throw new TypeError("A point requires exactly two coordinate strings");
  }
  return point2(value[0]!, value[1]!);
}
const input = fixture.segments.map((value: unknown) => {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError("A segment requires two endpoints");
  return segment2(parsePoint(value[0]), parsePoint(value[1]));
});
const result = buildFaces(input);
const directory = resolve(process.argv[3] ?? "artifacts");
await mkdir(directory, { recursive: true });
await writeFile(resolve(directory, "faces.json"), JSON.stringify({ input: fixture, result }, null, 2) + "\n");
const points = result.vertices.map(v => v.point);
const origin = points[0] ?? point2(0n, 0n);
const minX = points.reduce((v, p) => p.x.compare(v) < 0 ? p.x : v, origin.x);
const minY = points.reduce((v, p) => p.y.compare(v) < 0 ? p.y : v, origin.y);
const maxX = points.reduce((v, p) => p.x.compare(v) > 0 ? p.x : v, origin.x);
const maxY = points.reduce((v, p) => p.y.compare(v) > 0 ? p.y : v, origin.y);
const width = maxX.sub(minX), height = maxY.sub(minY);
const extent = width.compare(height) >= 0 ? width : height;
function display(p: Point2): [number, number] {
  const project = (axis: "x" | "y") => {
    if (!extent.sign()) return 260;
    const t = p[axis].sub(axis === "x" ? minX : minY).div(extent);
    return 45 + Number(t.numerator * 430000000n / t.denominator) / 1000000;
  };
  return [project("x"), 520 - project("y")];
}
const colors = ["#2563eb", "#dc2626", "#7c3aed", "#15803d"];
const fills = result.faces.slice(1).map((face, i) => {
  const d = face.boundaries.map(boundary => {
    const coords = result.boundaries[boundary]!.halfEdges.map(id => {
      const h = result.halfEdges[id]!;
      return display(result.vertices[h.origin]!.point).join(",");
    });
    return `M${coords.join(" L")} Z`;
  }).join(" ");
  return `<path d="${d}" fill="${colors[i % colors.length]}" fill-opacity="0.3" fill-rule="nonzero"><title>face ${i+1}; twice area ${face.twiceArea}</title></path>`;
}).join("\n");
const edges = result.edges.map((e, i) => {
  const [x1, y1] = display(result.vertices[e.start]!.point);
  const [x2, y2] = display(result.vertices[e.end]!.point);
  return `<g><title>edge ${i}; inputs ${e.sources.join(",")}</title>
<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${colors[e.sources[0]! % colors.length]}" stroke-width="${e.sources.length > 1 ? 5 : 3}"/>
<text x="${(x1 + x2) / 2 + 7}" y="${(y1 + y2) / 2 - 7}">e${i}</text></g>`;
}).join("\n");
const vertices = result.vertices.map((v, i) => {
  const [cx, cy] = display(v.point);
  return `<g><title>vertex ${i}; inputs ${v.sources.join(",")}</title><circle cx="${cx}" cy="${cy}" r="5" fill="#111827"/>
<text x="${cx + 8}" y="${cy + 17}">v${i}</text></g>`;
}).join("\n");
await writeFile(resolve(directory, "faces.svg"), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 570" role="img" aria-label="Exact planar faces">
<rect width="520" height="570" fill="white"/>
<g font-family="sans-serif" font-size="12">${fills}${edges}${vertices}
<text x="20" y="545">${points.length} vertices, ${result.edges.length} edges, ${result.faces.length-1} bounded faces; exact data in JSON</text></g>
</svg>\n`);
console.log(`Saved ${directory}/faces.{json,svg}: ${points.length} vertices, ${result.edges.length} edges`);
