import { Rational } from "../../dist/index.js";
import type { ExtrudedMesh } from "../../dist/index.js";

export function createViewer(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("webgl",{antialias:true,preserveDrawingBuffer:true});
  if (!context) throw new Error("このブラウザーではWebGLを利用できません");
  const gl = context;
  function shader(type: number, source: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s,source); gl.compileShader(s);
    if (!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)??"Shader error");
    return s;
  }
  const program = gl.createProgram()!;
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 position,color;
    uniform float yaw,pitch,zoom,aspect; varying vec3 shade;
    void main(){float cy=cos(yaw),sy=sin(yaw),cp=cos(pitch),sp=sin(pitch);
    vec3 q=vec3(cy*position.x-sy*position.y,sy*position.x+cy*position.y,position.z);
    vec3 r=vec3(q.x,cp*q.y+sp*q.z,-sp*q.y+cp*q.z);
    gl_Position=vec4(r.x*zoom/aspect,r.y*zoom,-r.z*0.15,1.0);shade=color;}`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;
    varying vec3 shade;void main(){gl_FragColor=vec4(shade,1.0);}`));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)??"WebGL error");
  gl.useProgram(program);
  const buffers = ["position","color"].map(name=>({buffer:gl.createBuffer()!,location:gl.getAttribLocation(program,name)}));
  const uniform = (name:string)=>gl.getUniformLocation(program,name);
  const uniforms = {yaw:uniform("yaw"),pitch:uniform("pitch"),zoom:uniform("zoom"),aspect:uniform("aspect")};
  let yaw=-.6,pitch=.95,zoom=1.5,count=0;
  function draw() {
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(canvas.clientWidth*ratio); canvas.height=Math.round(canvas.clientHeight*ratio);
    gl.viewport(0,0,canvas.width,canvas.height); gl.enable(gl.DEPTH_TEST);
    gl.clearColor(.955,.97,.99,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.pitch,pitch);gl.uniform1f(uniforms.zoom,zoom*.9*Math.min(1,canvas.width/canvas.height));
    gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);gl.drawArrays(gl.TRIANGLES,0,count);
    canvas.dataset.view=[yaw,pitch,zoom].join(",");
  }
  function update(mesh: ExtrudedMesh) {
    const two=new Rational(2n);
    const bounds = (["x","y","z"] as const).map(axis=>{
      const start=mesh.vertices[0]![axis];
      const min=mesh.vertices.reduce((v,p)=>p[axis].compare(v)<0?p[axis]:v,start);
      const max=mesh.vertices.reduce((v,p)=>p[axis].compare(v)>0?p[axis]:v,start);
      return {axis,center:min.add(max).div(two),span:max.sub(min)};
    });
    const span=bounds.reduce((v,b)=>b.span.compare(v)>0?b.span:v,bounds[0]!.span);
    const display=(r:Rational)=>Number(r.numerator*1000000000000n/r.denominator)/1000000000000;
    const points=mesh.vertices.map(p=>bounds.map(b=>display(p[b.axis].sub(b.center).div(span))));
    const positions:number[]=[],colors:number[]=[];
    mesh.triangles.forEach((ids,i)=>{
      const [a,b,c]=ids.map(id=>points[id]!) as [number[],number[],number[]];
      const u=b.map((v,j)=>v-a[j]!),v=c.map((v,j)=>v-a[j]!);
      const normal=[u[1]!*v[2]!-u[2]!*v[1]!,u[2]!*v[0]!-u[0]!*v[2]!,u[0]!*v[1]!-u[1]!*v[0]!];
      const size=Math.hypot(...normal)||1;
      const light=.65+.35*Math.max(0,(normal[0]!*.3-normal[1]!*.4+normal[2]!*.866)/size);
      const base=Math.abs(normal[2]!/size)>.9?[.25,.53,.86]:[.18,.42,.64];
      ids.forEach(id=>{positions.push(...points[id]!);colors.push(...base.map(v=>v*light*(.94+i%3*.03)));});
    });
    [positions,colors].forEach((values,i)=>{
      const {buffer,location}=buffers[i]!;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.STATIC_DRAW);gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location,3,gl.FLOAT,false,0,0);
    });
    count=positions.length/3;draw();
  }
  let drag: [number,number]|null=null;
  canvas.addEventListener("pointerdown",e=>{canvas.setPointerCapture(e.pointerId);drag=[e.clientX,e.clientY];});
  canvas.addEventListener("pointermove",e=>{
    if(!drag)return;
    yaw+=(e.clientX-drag[0])*.008;pitch=Math.max(-1.5,Math.min(1.5,pitch+(e.clientY-drag[1])*.008));
    drag=[e.clientX,e.clientY];draw();
  });
  canvas.addEventListener("pointerup",()=>{drag=null;});canvas.addEventListener("pointercancel",()=>{drag=null;});
  canvas.addEventListener("wheel",e=>{e.preventDefault();zoom=Math.max(.3,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
  const observer=new ResizeObserver(draw);observer.observe(canvas);
  return {update,reset(){yaw=-.6;pitch=.95;zoom=1.5;draw();}};
}
