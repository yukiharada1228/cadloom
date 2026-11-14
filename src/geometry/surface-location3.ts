import { cross3, dot3, point3, vector3, subtract3 } from './point3.js';
import type { Point3 } from './point3.js';
import { evaluatePlane3, planeFromPoints } from './plane3.js';
import type { Triangle3 } from './triangle3.js';
import type { PointLocation } from './polygon-location.js';

/** Internal query against certified closed material boundaries, including Boolean contact complexes. */
export function createSurfaceLocator3(triangles: readonly Triangle3[]) {
  const faces=triangles.map(triangle=>({triangle,plane:planeFromPoints(...triangle)}));
  function edgeSigns(p:Point3,face:typeof faces[number]) {
    return face.triangle.map((a,i)=>dot3(cross3(subtract3(face.triangle[(i+1)%3]!,a),subtract3(p,a)),face.plane.normal).sign());
  }
  return (input:Point3):PointLocation=>{
    const p=point3(input.x,input.y,input.z);
    const values=faces.map(f=>evaluatePlane3(f.plane,p));
    if(faces.some((f,i)=>values[i]!.sign()===0&&edgeSigns(p,f).every(s=>s>=0)))return 'boundary';
    // At most 2 bad directions per plane and 2 per edge: 8 per face.
    for(let n=0n;n<=8n*BigInt(faces.length);n++){
      const direction=vector3(1n,n,n*n);
      let crossings=0,bad=false;
      for(let i=0;i<faces.length;i++){
        const f=faces[i]!,denominator=dot3(f.plane.normal,direction);
        if(denominator.sign()===0){bad=true;break;}
        const t=values[i]!.neg().div(denominator);
        if(t.sign()<=0)continue;
        const q=point3(p.x.add(direction.x.mul(t)),p.y.add(direction.y.mul(t)),p.z.add(direction.z.mul(t)));
        const signs=edgeSigns(q,f);
        if(signs.some(s=>s<0))continue;
        if(signs.some(s=>s===0)){bad=true;break;}
        crossings++;
      }
      if(!bad)return crossings%2===1?'inside':'outside';
    }
    throw new Error('Generic rational ray bound violated');
  };
}

