import { cross3, dot3, point3, vector3, subtract3 } from './point3.js';
import type { Point3 } from './point3.js';
import { evaluatePlane3, planeFromPoints, plane3 } from './plane3.js';
import type { Plane3 } from './plane3.js';
import type { Triangle3 } from './triangle3.js';
import type { PointLocation } from './polygon-location.js';

/** Internal query against certified closed material boundaries, including Boolean contact complexes. */
export function createSurfaceLocator3(triangles: readonly Triangle3[]) {
  const axes=['x','y','z'] as const;
  function prepareFace(triangle:Triangle3,plane:Plane3){
    const bounds=axes.map(axis=>{
      const values=triangle.map(p=>p[axis]).sort((a,b)=>a.compare(b));
      return {min:values[0]!,max:values[2]!};
    });
    const edges=triangle.map((a,i)=>{
      // ((b-a) × (p-a)) · n = (n × (b-a)) · p - (n × (b-a)) · a.
      const normal=cross3(plane.normal,subtract3(triangle[(i+1)%3]!,a));
      return {normal,offset:dot3(normal,a).neg()};
    });
    return {bounds,edges};
  }
  type Face=ReturnType<typeof prepareFace>;
  const groups=new Map<string,{plane:Plane3;faces:Face[]}>();
  for(const triangle of triangles){
    const plane=planeFromPoints(...triangle),n=plane.normal;
    const first=[n.x,n.y,n.z].find(v=>v.sign()!==0)!;
    const canonical=plane3(n.x.div(first),n.y.div(first),n.z.div(first),plane.offset.div(first));
    const key=`${canonical.normal.x},${canonical.normal.y},${canonical.normal.z},${canonical.offset}`;
    let group=groups.get(key);
    if(!group){group={plane:canonical,faces:[]};groups.set(key,group);}
    // Edge halfplanes use the original triangle's normal, preserving inward winding too.
    group.faces.push(prepareFace(triangle,plane));
  }
  const planes=[...groups.values()];
  function classify(p:Point3,face:Face):-1|0|1 {
    if(axes.some((axis,i)=>p[axis].compare(face.bounds[i]!.min)<0||p[axis].compare(face.bounds[i]!.max)>0))return -1;
    let boundary=false;
    for(const edge of face.edges){
      const sign=dot3(edge.normal,p).add(edge.offset).sign();
      if(sign<0)return -1;
      if(sign===0)boundary=true;
    }
    return boundary?0:1;
  }
  return (input:Point3):PointLocation=>{
    const p=point3(input.x,input.y,input.z);
    const values=planes.map(f=>evaluatePlane3(f.plane,p));
    if(planes.some((f,i)=>values[i]!.sign()===0&&f.faces.some(face=>classify(p,face)>=0)))return 'boundary';
    // Grouping rescales plane values and slopes equally, preserving every ray parameter.
    // At most 2 bad directions per plane and 2 per edge: 8 per original face.
    for(let n=0n;n<=8n*BigInt(triangles.length);n++){
      const direction=vector3(1n,n,n*n);
      const slopes=planes.map(f=>dot3(f.plane.normal,direction));
      if(slopes.some(s=>s.sign()===0))continue;
      let crossings=0,bad=false;
      for(let i=0;i<planes.length;i++){
        const t=values[i]!.neg().div(slopes[i]!);
        if(t.sign()<=0)continue;
        const q=point3(p.x.add(direction.x.mul(t)),p.y.add(direction.y.mul(t)),p.z.add(direction.z.mul(t)));
        for(const face of planes[i]!.faces){
          const location=classify(q,face);
          if(location<0)continue;
          if(location===0){bad=true;break;}
          crossings++;
        }
        if(bad)break;
      }
      if(!bad)return crossings%2===1?'inside':'outside';
    }
    throw new Error('Generic rational ray bound violated');
  };
}
