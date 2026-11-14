import { Rational } from "../numeric/rational.js";
import { point2 } from "./point2.js";
import type { ExactInput } from "./point2.js";
import type { FillRule, PolygonRegion } from "./polygon-boolean.js";
import { triangulatePolygon } from "./triangulate.js";
import { inspectMesh, point3 } from "./mesh3.js";
import type { TriangleIndices, TriangleMesh3 } from "./mesh3.js";

export interface ExtrudeOptions { readonly baseZ?: ExactInput; readonly fillRule?: FillRule }
export interface ExtrudedMesh extends TriangleMesh3 {
  readonly volume: Rational;
  readonly baseTwiceArea: Rational;
  readonly zMin: Rational;
  readonly zMax: Rational;
}

/** Outward-oriented closed surface of a vertical prism. Rejects pinched boundaries. */
export function extrudePolygon(region: PolygonRegion, height: ExactInput, options: ExtrudeOptions = {}): ExtrudedMesh {
  const h=point2(height,0n).x,base=point2(options.baseZ??0n,0n).x;
  if(h.sign()===0)throw new RangeError("Extrusion height must be nonzero");
  const end=base.add(h),zMin=h.sign()>0?base:end,zMax=h.sign()>0?end:base;
  const cap=triangulatePolygon(region,options.fillRule??"even-odd");
  const n=cap.vertices.length;
  const vertices=Object.freeze([
    ...cap.vertices.map(p=>point3(p.x,p.y,zMin)),
    ...cap.vertices.map(p=>point3(p.x,p.y,zMax)),
  ]);
  const triangles: TriangleIndices[]=[];
  const edges=new Map<string,{start:number;end:number;count:number}>();
  for(const [a,b,c] of cap.triangles){
    triangles.push(Object.freeze([a,c,b]),Object.freeze([a+n,b+n,c+n]));
    for(const [start,end] of [[a,b],[b,c],[c,a]] as const){
      const key=start<end?`${start}:${end}`:`${end}:${start}`;
      const edge=edges.get(key);
      if(edge)edge.count++;
      else edges.set(key,{start,end,count:1});
    }
  }
  const boundaryDegree=new Map<number,number>();
  for(const {start:a,end:b,count} of edges.values()){
    if(count!==1)continue;
    boundaryDegree.set(a,(boundaryDegree.get(a)??0)+1);
    boundaryDegree.set(b,(boundaryDegree.get(b)??0)+1);
    triangles.push(Object.freeze([a,b,b+n]),Object.freeze([a,b+n,a+n]));
  }
  if([...boundaryDegree.values()].some(degree=>degree!==2)) {
    throw new RangeError("Extrusion requires non-pinched boundaries; point-touching components are not supported");
  }
  const volume=cap.twiceArea.mul(zMax.sub(zMin)).div(new Rational(2n));
  const result=Object.freeze({vertices,triangles:Object.freeze(triangles),volume,baseTwiceArea:cap.twiceArea,zMin,zMax});
  const inspection=inspectMesh(result);
  if(!inspection.closed||!inspection.consistentlyOriented||!inspection.nondegenerate||
     !inspection.manifoldVertices||!inspection.signedVolume.equals(volume)) {
    throw new Error("Extrusion mesh invariant failed");
  }
  return result;
}
