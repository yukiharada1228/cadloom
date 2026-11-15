import {Rational} from '../numeric/rational.js';
import {point3} from './point3.js';
import {createSurfaceLocator3} from './surface-location3.js';
import {assertOwnedPlanarSolid3} from './planar-solid3.js';
import type {PreparedPlanarSolid3} from './planar-solid3.js';
/** Geometry-derived shell adjacency and strict samples; no record declarations
 * are trusted. Shell IDs refer to the polygonal topology, not triangle shells.
 */
export function planarSolidRegions3(solid:PreparedPlanarSolid3){
  assertOwnedPlanarSolid3(solid);const t=solid.topology;
  const meta=t.shells.map((_,id)=>solid.shells.find(s=>t.faces[s.faces[0]!]!.shell===id)!);
  const triangles=t.shells.map((_,id)=>solid.triangles.filter((_,i)=>t.faces[solid.triangleFaces[i]!]!.shell===id)),queries=triangles.map(createSurfaceLocator3);
  const parents=meta.map((s,i)=>{
    const matches=meta.flatMap((p,j)=>p.depth===s.depth-1&&queries[j]!(triangles[i]![0]![0])==='inside'?[j]:[]);
    if(s.depth===0){if(matches.length)throw new Error('Root shell has a parent');return null;}
    if(matches.length!==1)throw new Error('Shell containment has no unique immediate parent');return matches[0]!;
  });
  const children=t.shells.map((_,id)=>parents.flatMap((parent,i)=>parent===id?[i]:[]));
  const regions=Object.freeze([Object.freeze({shells:Object.freeze(parents.flatMap((p,i)=>p===null?[i]:[])),void:false}),...meta.map((s,id)=>Object.freeze({shells:Object.freeze([id,...children[id]!]),void:s.depth%2===1}))]);
  const samples=Object.freeze(meta.flatMap((s,id)=>{
    if(s.depth%2===1)return [];
    const face=solid.polygons[s.faces[0]!]!,sum=face.reduce((a,p)=>point3(a.x.add(p.x),a.y.add(p.y),a.z.add(p.z)),point3(0n,0n)),n=t.faces[s.faces[0]!]!.surface;
    if(n.kind!=='plane')throw new Error('Planar shell has curved support');
    const count=new Rational(BigInt(face.length)),center=point3(sum.x.div(count),sum.y.div(count),sum.z.div(count));let step=new Rational(1n);
    while(true){const p=point3(center.x.sub(n.plane.normal.x.mul(step)),center.y.sub(n.plane.normal.y.mul(step)),center.z.sub(n.plane.normal.z.mul(step)));
      if(queries[id]!(p)==='inside'&&children[id]!.every(c=>queries[c]!(p)==='outside')&&solid.locate(p)==='inside')return [p];step=step.div(new Rational(2n));}
  }));
  return Object.freeze({regions,samples});
}
