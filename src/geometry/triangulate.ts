import { Rational } from "../numeric/rational.js";
import { point2, pointsEqual } from "./point2.js";
import type { Point2 } from "./point2.js";
import { preparePolygon } from "./polygon-location.js";
import type { FillRule, PolygonRegion } from "./polygon-boolean.js";

export interface PolygonMesh {
  readonly vertices: readonly Point2[];
  /** Counterclockwise nondegenerate triangles indexing vertices. */
  readonly triangles: readonly (readonly [number, number, number])[];
  readonly twiceArea: Rational;
}

/** Exact conforming slab triangulation, adding rational boundary/interior vertices. */
export function triangulatePolygon(region: PolygonRegion, fillRule: FillRule = "even-odd"): PolygonMesh {
  const polygon = preparePolygon(region, fillRule);
  const two = new Rational(2n);
  const edges = polygon.rings.flatMap(ring => ring.map((p,i) => ({p,q:ring[(i+1)%ring.length]!})));
  const unique = (values: Rational[]) => [...new Map(values.map(v=>[v.toString(),v])).values()].sort((a,b)=>a.compare(b));
  const xs = unique(edges.map(e=>e.p.x));
  const yAt = (e: {p:Point2;q:Point2}, x:Rational) =>
    e.p.y.add(x.sub(e.p.x).mul(e.q.y.sub(e.p.y)).div(e.q.x.sub(e.p.x)));
  // Shared cuts on every slab wall prevent T-junctions between adjacent strips.
  const wallCuts = xs.map(x => unique(edges.flatMap(e => {
    if(e.p.x.equals(e.q.x)) return e.p.x.equals(x)?[e.p.y,e.q.y]:[];
    if(x.compare(e.p.x)<0 && x.compare(e.q.x)<0 || x.compare(e.p.x)>0 && x.compare(e.q.x)>0) return [];
    return [yAt(e,x)];
  })));
  const vertices: Point2[] = [], triangles: (readonly [number,number,number])[] = [];
  const indices = new Map<string,number>();
  const index = (p:Point2) => {
    const key=`${p.x},${p.y}`;
    let id=indices.get(key);
    if(id===undefined){id=vertices.length;vertices.push(p);indices.set(key,id);}
    return id;
  };
  for(let i=0;i+1<xs.length;i++){
    const left=xs[i]!,right=xs[i+1]!,mid=left.add(right).div(two);
    const crossing=edges.filter(e=>
      e.p.x.compare(mid)<0 && e.q.x.compare(mid)>0 || e.q.x.compare(mid)<0 && e.p.x.compare(mid)>0)
      .map(e=>({edge:e,y:yAt(e,mid)})).sort((a,b)=>a.y.compare(b.y));
    if(crossing.length%2!==0) throw new Error("Odd normalized boundary crossing count");
    for(let j=0;j<crossing.length;j+=2){
      const lower=crossing[j]!,upper=crossing[j+1]!;
      const ll=yAt(lower.edge,left),lr=yAt(lower.edge,right);
      const ul=yAt(upper.edge,left),ur=yAt(upper.edge,right);
      const boundary=[point2(left,ll),point2(right,lr),
        ...wallCuts[i+1]!.filter(y=>y.compare(lr)>0&&y.compare(ur)<0).map(y=>point2(right,y)),
        point2(right,ur),point2(left,ul),
        ...wallCuts[i]!.filter(y=>y.compare(ll)>0&&y.compare(ul)<0).reverse().map(y=>point2(left,y))];
      const center=index(point2(mid,lower.y.add(upper.y).div(two)));
      for(let k=0;k<boundary.length;k++){
        const a=boundary[k]!,b=boundary[(k+1)%boundary.length]!;
        if(!pointsEqual(a,b)) triangles.push(Object.freeze([center,index(a),index(b)] as const));
      }
    }
  }
  return Object.freeze({vertices:Object.freeze(vertices),triangles:Object.freeze(triangles),twiceArea:polygon.twiceArea});
}
