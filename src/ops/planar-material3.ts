import {assertOwnedSimilarityTransform3,transformPointBySimilarity3} from '../geometry/similarity3.js';
import type {SimilarityTransform3} from '../geometry/similarity3.js';
import {analyzePlanarMaterialRegions3} from '../geometry/planar-material-regions3.js';
import {Rational} from '../numeric/rational.js';
import {point3,cross3,dot3} from '../geometry/point3.js';
import type {Point3} from '../geometry/point3.js';
import type {AlgebraicCoordinates3} from '../geometry/algebraic-point3.js';
import {preparePlanarSolid3} from '../geometry/planar-solid3.js';
import {booleanPlanarSolids3} from '../geometry/planar-solid-boolean3.js';
import type {PlanarSolidBooleanOperand3} from '../geometry/planar-solid-boolean3.js';
import type {BooleanOperation} from '../geometry/polygon-boolean.js';
import {createExactPlanarLocator3} from '../geometry/exact-planar-location3.js';
import {assertOwnedBody3,planarSourceOfBody3} from '../model/body3.js';
import type {Body3} from '../model/body3.js';
import {planarSolidFromBoundary3} from '../convert/planar-body3.js';
import {createPlanarBody3} from './body3.js';

/** An owned regularized planar material; contact complexes need not be manifold Bodies. */
export interface PlanarMaterial3 {
 readonly topology:PlanarSolidBooleanOperand3['topology'];
 readonly polygons:PlanarSolidBooleanOperand3['polygons'];
 readonly volume:Rational;
 readonly boundaryKind:'manifold'|'contact';
}
type Recipe={kind:'solid';source:PlanarSolidBooleanOperand3}|{kind:'boolean';operation:BooleanOperation;left:Recipe;right:Recipe};
type State={source:PlanarSolidBooleanOperand3;recipe:Recipe;locate?:ReturnType<typeof createExactPlanarLocator3>};
const states=new WeakMap<PlanarMaterial3,State>();
function state(m:PlanarMaterial3):State {const s=states.get(m);if(!s)throw new RangeError('Operation requires a factory-created planar material');return s;}
function publish(source:PlanarSolidBooleanOperand3,recipe:Recipe):PlanarMaterial3 {
 const result=Object.freeze({topology:source.topology,polygons:source.polygons,volume:source.volume,boundaryKind:source.topology.closedOrientedIncidence?'manifold' as const:'contact' as const});
 states.set(result,{source,recipe});return result;
}
export function createPlanarMaterial3(polygons:readonly (readonly Point3[])[]):PlanarMaterial3 {
 const source=preparePlanarSolid3(polygons);return publish(source,{kind:'solid',source});
}
/** Validates the actual owned Body boundary; curved or nonrational faces are rejected. */
export function planarMaterialFromBody3(body:Body3):PlanarMaterial3 {
 assertOwnedBody3(body);const source=planarSourceOfBody3(body)??planarSolidFromBoundary3(body.topology);
 return publish(source,{kind:'solid',source});
}
export function booleanPlanarMaterials3(a:PlanarMaterial3|Body3,b:PlanarMaterial3|Body3,operation:BooleanOperation):PlanarMaterial3 {
 const resolve=(v:PlanarMaterial3|Body3)=>states.has(v as PlanarMaterial3)?state(v as PlanarMaterial3):state(planarMaterialFromBody3(v as Body3));
 const left=resolve(a),right=resolve(b),source=booleanPlanarSolids3(left.source,right.source,operation);
 return publish(source,{kind:'boolean',operation,left:left.recipe,right:right.recipe});
}
export function locatePlanarMaterial3(material:PlanarMaterial3,point:Point3|AlgebraicCoordinates3){
 const s=state(material);s.locate??=createExactPlanarLocator3(s.source.triangles);return s.locate(point);
}
/** Revalidates embedding, shell nesting and orientation; contacts are never silently split. */
export function planarBodyFromMaterial3(material:PlanarMaterial3):Body3 {
 const s=state(material);if(material.boundaryKind==='contact')throw new RangeError('Contact material cannot be adopted as a manifold Body');
 return createPlanarBody3(s.source.polygons);
}
type EncodedPoint=readonly [string,string,string];
export type PlanarMaterialNodeRecord3=
 |Readonly<{kind:'solid';polygons:readonly (readonly EncodedPoint[])[]}>
 |Readonly<{kind:'boolean';operation:BooleanOperation;left:number;right:number}>;
/** A shared construction DAG, not an unchecked boundary or an editing history. Root is the last node. */
export interface PlanarMaterialDocument3 {readonly version:1;readonly kind:'planar-material';readonly nodes:readonly PlanarMaterialNodeRecord3[];}
export function planarMaterialDocument3(material:PlanarMaterial3):PlanarMaterialDocument3 {
 const root=state(material).recipe,ids=new Map<Recipe,number>(),nodes:PlanarMaterialNodeRecord3[]=[],stack:[Recipe,boolean][]=[[root,false]];
 while(stack.length){
  const [r,ready]=stack.pop()!;if(ids.has(r))continue;
  if(r.kind==='boolean'&&!ready){stack.push([r,true],[r.right,false],[r.left,false]);continue;}
  const record:PlanarMaterialNodeRecord3=r.kind==='solid'?Object.freeze({kind:'solid',polygons:Object.freeze(r.source.polygons.map(p=>Object.freeze(p.map(q=>Object.freeze([q.x.toString(),q.y.toString(),q.z.toString()] as const)))))}):Object.freeze({kind:'boolean',operation:r.operation,left:ids.get(r.left)!,right:ids.get(r.right)!});
  ids.set(r,nodes.length);nodes.push(record);
 }
 return Object.freeze({version:1,kind:'planar-material',nodes:Object.freeze(nodes)});
}
export function serializePlanarMaterial3(material:PlanarMaterial3):string {return JSON.stringify(planarMaterialDocument3(material));}
export interface PlanarMaterialReadLimits3 {readonly maxNodes?:number;readonly maxVertices?:number;readonly maxCoordinateChars?:number;readonly maxChars?:number;}
/** Validate the entire graph before replay. Every solid leaf is geometrically revalidated. */
export function restorePlanarMaterial3(input:unknown,limits:PlanarMaterialReadLimits3={}):PlanarMaterial3 {
 const limit=(v:number|undefined,fallback:number)=>{const n=v??fallback;if(!Number.isSafeInteger(n)||n<1)throw new RangeError('Invalid planar material read limit');return n;};
 const maxNodes=limit(limits.maxNodes,1000),maxVertices=limit(limits.maxVertices,100000),maxCoordinateChars=limit(limits.maxCoordinateChars,4096),maxChars=limit(limits.maxChars,10000000);
 if(typeof input==='string'){if(input.length>maxChars)throw new RangeError('Planar material document exceeds character limit');input=JSON.parse(input);}
 const fail=():never=>{throw new RangeError('Invalid planar material document');};
 const object=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:fail();
 const doc=object(input);if(doc.version!==1||doc.kind!=='planar-material'||!Array.isArray(doc.nodes)||doc.nodes.length===0||doc.nodes.length>maxNodes)fail();
 const raw=doc.nodes as unknown[],nodes:PlanarMaterialNodeRecord3[]=[];let vertices=0;
 // Snapshot and check all resource bounds before any geometry or BigInt parsing.
 for(let i=0;i<raw.length;i++){
  const n=object(raw[i]);
  if(n.kind==='solid'){
   if(!Array.isArray(n.polygons)||n.polygons.length>maxVertices)fail();
   const polygons=(n.polygons as unknown[]).map(p=>{
    if(!Array.isArray(p)||p.length<3||(vertices+=p.length)>maxVertices)fail();
    return (p as unknown[]).map(q=>{if(!Array.isArray(q)||q.length!==3||!q.every(x=>typeof x==='string'&&x.length>0&&x.length<=maxCoordinateChars&&/^[+-]?\d+(?:\/[+-]?\d+|\.\d+)?$/.test(x)))fail();return [...q as string[]] as [string,string,string];});
   });nodes.push({kind:'solid',polygons});
  }else if(n.kind==='boolean'){
   if(!['union','intersection','difference','xor'].includes(n.operation as string)||!Number.isSafeInteger(n.left)||!Number.isSafeInteger(n.right)||(n.left as number)<0||(n.right as number)<0||(n.left as number)>=i||(n.right as number)>=i)fail();
   nodes.push({kind:'boolean',operation:n.operation as BooleanOperation,left:n.left as number,right:n.right as number});
  }else fail();
 }
 const reachable=new Set<number>(),pending=[nodes.length-1];
 while(pending.length){const i=pending.pop()!;if(reachable.has(i))continue;reachable.add(i);const n=nodes[i]!;if(n.kind==='boolean')pending.push(n.left,n.right);}
 if(reachable.size!==nodes.length)fail();
 const values:PlanarMaterial3[]=[];
 for(const n of nodes)values.push(n.kind==='solid'?createPlanarMaterial3(n.polygons.map(p=>p.map(q=>point3(...q.map(x=>Rational.parse(x)) as [Rational,Rational,Rational])))):booleanPlanarMaterials3(values[n.left]!,values[n.right]!,n.operation));
 return values[values.length-1]!;
}

/** Open material/void components, including contacts and bounded cavities. */
export function planarMaterialRegions3(material:PlanarMaterial3){return analyzePlanarMaterialRegions3(state(material).source);}

/** Transform the complete construction DAG, retaining contacts and shared operands. */
export function transformPlanarMaterial3(material:PlanarMaterial3,transform:SimilarityTransform3):PlanarMaterial3 {
 const root=state(material).recipe;assertOwnedSimilarityTransform3(transform);
 const [a,b,c]=transform.columns,reverse=dot3(a,cross3(b,c)).sign()<0,values=new Map<Recipe,PlanarMaterial3>(),stack:[Recipe,boolean][]=[[root,false]];
 while(stack.length){
  const [r,ready]=stack.pop()!;if(values.has(r))continue;
  if(r.kind==='boolean'&&!ready){stack.push([r,true],[r.right,false],[r.left,false]);continue;}
  const result=r.kind==='solid'?createPlanarMaterial3(r.source.polygons.map(p=>{const points=p.map(q=>transformPointBySimilarity3(transform,q));return reverse?points.reverse():points;})):booleanPlanarMaterials3(values.get(r.left)!,values.get(r.right)!,r.operation);
  values.set(r,result);
 }
 return values.get(root)!;
}
