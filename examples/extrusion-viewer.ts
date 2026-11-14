import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { extrudePolygon, inspectMesh, point2, Rational } from "../dist/index.js";
const box=(x:bigint,y:bigint,w:bigint)=>[point2(x,y),point2(x+w,y),point2(x+w,y+w),point2(x,y+w)];
const input=[box(0n,0n,8n),box(2n,2n,4n)];
const mesh=extrudePolygon(input,'2');
const report=inspectMesh(mesh);
const directory=resolve('artifacts');
await mkdir(directory,{recursive:true});
await writeFile(resolve(directory,'extrusion.json'),JSON.stringify({input,mesh,report},null,2)+'\n');
// Approximate only the display copy. The exported JSON retains rational coordinates.
const project=(v:Rational)=>Number(v.numerator*1000000n/v.denominator)/1000000;
const vertices=mesh.vertices.map(p=>[project(p.x.sub(new Rational(4n)).div(new Rational(8n))),project(p.y.sub(new Rational(4n)).div(new Rational(8n))),project(p.z.sub(new Rational(1n)).div(new Rational(8n)))]);
await writeFile(resolve(directory,'extrusion.html'),`<!doctype html>
<html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>cadloom — 穴のある板の押し出し</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef2f6;color:#172033;font-family:system-ui,sans-serif}main{max-width:1000px;margin:32px auto;padding:24px}h1{font-size:26px;margin-bottom:8px}p{line-height:1.7;color:#4b5870}.panel{background:white;border:1px solid #d8e0eb;border-radius:16px;overflow:hidden}canvas{display:block;width:100%;height:540px;touch-action:none;cursor:grab}canvas:active{cursor:grabbing}footer{display:flex;justify-content:space-between;align-items:center;padding:16px 20px;border-top:1px solid #e2e8f0;gap:16px}button{padding:10px 16px;border:1px solid #b7c6da;border-radius:8px;background:white;cursor:pointer}#status{font-size:14px}small{display:block;color:#59677b;margin-top:18px}@media(max-width:600px){main{margin:0;padding:16px}canvas{height:400px}footer{flex-wrap:wrap}}
</style>
<main><h1>穴のある板を、厳密に押し出す</h1><p>ドラッグで回転、ホイールで拡大縮小。底面積48 × 高さ2 = 体積96。</p>
<div class="panel"><canvas aria-label="穴のある板の3Dメッシュ" id="view"></canvas><footer><span id="status">3D表示を準備しています</span><button id="reset">表示をリセット</button></footer></div>
<small>座標と体積の計算は有理数。画面表示のみ浮動小数点に変換しています。曲面や3D集合演算はこの例の対象外です。</small></main>
<script>
const vertices=${JSON.stringify(vertices)}, triangles=${JSON.stringify(mesh.triangles)};
const canvas=document.getElementById('view'),status=document.getElementById('status');
const gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});
if(!gl){status.textContent='WebGLを利用できません。WebGL対応ブラウザーで開いてください。';}else{
function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
const program=gl.createProgram();
gl.attachShader(program,shader(gl.VERTEX_SHADER,
'attribute vec3 position; attribute vec3 color; uniform float yaw,pitch,zoom,aspect; varying vec3 shade; void main(){float cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);vec3 q=vec3(cy*position.x-sy*position.y,sy*position.x+cy*position.y,position.z);vec3 r=vec3(q.x,cp*q.y+sp*q.z,-sp*q.y+cp*q.z);gl_Position=vec4(r.x*zoom/aspect,r.y*zoom,-r.z*0.2,1.0);shade=color;}'));
gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 shade; void main(){gl_FragColor=vec4(shade,1.0);}'));
gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
const positions=[],colors=[];
triangles.forEach((ids,i)=>{const [a,b,c]=ids.map(id=>vertices[id]);const u=b.map((n,j)=>n-a[j]),v=c.map((n,j)=>n-a[j]);const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];const size=Math.hypot(...n);const light=.65+.35*Math.max(0,(n[0]*.3-n[1]*.4+n[2]*.866)/size);const base=Math.abs(n[2]/size)>.9?[.28,.57,.88]:[.21,.47,.66];const facet=.94+(i%3)*.03;ids.forEach(id=>{positions.push(...vertices[id]);colors.push(...base.map(x=>x*light*facet));});});
function attribute(name,values){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,0,0);}
attribute('position',positions);attribute('color',colors);
const uniforms=Object.fromEntries(['yaw','pitch','zoom','aspect'].map(name=>[name,gl.getUniformLocation(program,name)]));
let yaw=-.6,pitch=.95,zoom=1.5;
function draw(){const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(canvas.clientWidth*ratio);canvas.height=Math.round(canvas.clientHeight*ratio);gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(.97,.98,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);for(const [name,value] of Object.entries({yaw,pitch,zoom,aspect:canvas.width/canvas.height}))gl.uniform1f(uniforms[name],value);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);canvas.dataset.view=[yaw,pitch,zoom].join(',');}
let drag=null;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag[1])*.008));drag=[e.clientX,e.clientY];draw();});
canvas.addEventListener('pointerup',()=>{drag=null;});canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.3,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
document.getElementById('reset').addEventListener('click',()=>{yaw=-.6;pitch=.95;zoom=1.5;draw();});
addEventListener('resize',draw);draw();status.textContent='${mesh.vertices.length}頂点・${mesh.triangles.length}三角形 ｜ 閉じたメッシュ ｜ 体積 ${mesh.volume}';
}
</script></html>`);
console.log(`Saved ${directory}/extrusion.{json,html}`);
