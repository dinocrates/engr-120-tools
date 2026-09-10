// Analytic teaching patterns, in printer coordinates (mm).
// Shared clipping keeps every deposited segment inside the available infill region.
const TAU=2*Math.PI;
const SQRT3=Math.sqrt(3);

function clip(a,b,r) {
  const dx=b[0]-a[0],dy=b[1]-a[1];let lo=0,hi=1;
  for(const [p,q] of [[-dx,a[0]-r[0]],[dx,r[1]-a[0]],[-dy,a[1]-r[2]],[dy,r[3]-a[1]]]) {
    if(Math.abs(p)<1e-12){if(q<0)return null;continue;}
    const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);
    if(lo>=hi-1e-10)return null;
  }
  return [[a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]];
}
const key=p=>`${Math.round(p[0]*1e6)},${Math.round(p[1]*1e6)}`;
const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;

// Walk each undirected edge exactly once, including shared hexagon boundaries.
function trails(edges,z,emit) {
  const nodes=new Map(),unique=new Set(),segments=[];
  const node=p=>{const k=key(p);if(!nodes.has(k))nodes.set(k,{p,links:[]});return nodes.get(k);};
  for(const [a,b] of edges) {
    const ak=key(a),bk=key(b);if(ak===bk)continue;
    const ek=ak<bk?`${ak}|${bk}`:`${bk}|${ak}`;if(unique.has(ek))continue;unique.add(ek);
    const A=node(a),B=node(b),i=segments.length;segments.push({a:A,b:B,used:false});A.links.push(i);B.links.push(i);
  }
  const walk=start=>{
    let n=start;const points=[[...n.p,z]];
    while(true){const i=n.links.find(i=>!segments[i].used);if(i===undefined)break;const s=segments[i];s.used=true;n=s.a===n?s.b:s.a;points.push([...n.p,z]);}
    if(points.length>1)emit(points,'infill');
  };
  // Start at odd-degree nodes, then consume any remaining closed loops.
  for(const n of nodes.values())if(n.links.length%2)walk(n);
  for(const n of nodes.values())if(n.links.some(i=>!segments[i].used))walk(n);
}

export function honeycomb(rect,density,width,z,emit) {
  // Ideal edge length / area = 2 / (sqrt(3) * side), without double-printing shared edges.
  const side=2*width/(SQRT3*density/100),pitchY=SQRT3*side,edges=[];
  const c0=Math.floor((rect[0]-50)/(1.5*side))-1,c1=Math.ceil((rect[1]-50)/(1.5*side))+1;
  for(let col=c0;col<=c1;col++) {
    const x=50+1.5*side*col,offset=((col%2)+2)%2*pitchY/2;
    const r0=Math.floor((rect[2]-50-offset)/pitchY)-1,r1=Math.ceil((rect[3]-50-offset)/pitchY)+1;
    for(let row=r0;row<=r1;row++) {
      const y=50+pitchY*row+offset;
      const points=Array.from({length:6},(_,i)=>[x+side*Math.cos(i*Math.PI/3),y+side*Math.sin(i*Math.PI/3)]);
      for(let i=0;i<6;i++){const e=clip(points[i],points[(i+1)%6],rect);if(e)edges.push(e);}
    }
  }
  trails(edges,z,emit);
}

function simplify(points,tolerance) {
  if(points.length<3)return points;
  const keep=new Uint8Array(points.length);keep[0]=keep[points.length-1]=1;
  const stack=[[0,points.length-1]],tol2=tolerance*tolerance;
  while(stack.length) {
    const [first,last]=stack.pop(),a=points[first],b=points[last],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
    let best=tol2,index=-1;
    for(let i=first+1;i<last;i++) {
      const p=points[i],t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2)):0;
      const d2=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2;
      if(d2>best){best=d2;index=i;}
    }
    if(index>=0){keep[index]=1;stack.push([first,index],[index,last]);}
  }
  return points.filter((_,i)=>keep[i]);
}

export function gyroid(rect,density,width,z,emit) {
  // Horizontal contours of the nodal gyroid approximation:
  // sin(X)cos(Y) + sin(Y)cos(Z) + sin(Z)cos(X) = 0.
  // Solve for Y(X) or X(Y), switching at |sin Z| = |cos Z| to avoid vertical tangents.
  // Mean XY contour length is about 2.42 * period per period-square, averaged over Z.
  const period=2.42*width/(density/100),k=TAU/period,phase=z*k;
  const sinZ=Math.sin(phase),cosZ=Math.cos(phase),alongX=Math.abs(cosZ)>=Math.abs(sinZ);
  const lo=alongX?rect[0]:rect[2],hi=alongX?rect[1]:rect[3];
  const crossLo=alongX?rect[2]:rect[0],crossHi=alongX?rect[3]:rect[1];
  const samples=Math.max(8,Math.ceil((hi-lo)/period*24)),branches=[[],[]];
  for(let i=0;i<=samples;i++) {
    const u=lo+(hi-lo)*i/samples,t=(u-50)*k;
    const a=alongX?Math.sin(t):sinZ,b=alongX?cosZ:Math.cos(t),c=alongX?-sinZ*Math.cos(t):-Math.sin(t)*cosZ;
    const alpha=Math.atan2(b,a),beta=Math.acos(Math.max(-1,Math.min(1,c/Math.hypot(a,b))));
    for(let branch=0;branch<2;branch++) {
      let v=alpha+(branch===0?beta:-beta);
      if(i){const previous=branches[branch][i-1][1];v+=TAU*Math.round((previous-v)/TAU);}
      branches[branch].push([u,v]);
    }
  }
  for(const branch of branches) {
    const waves=branch.map(([u,v])=>[u,50+v/k]);
    let min=Infinity,max=-Infinity;for(const p of waves){min=Math.min(min,p[1]);max=Math.max(max,p[1]);}
    const first=Math.ceil((crossLo-max)/period),last=Math.floor((crossHi-min)/period);
    for(let n=first;n<=last;n++) {
      let path=[];
      const flush=()=>{if(path.length>1)emit(simplify(path,width*.10).map(p=>[...p,z]),'infill');path=[];};
      for(let i=1;i<waves.length;i++) {
        const transform=([u,v])=>alongX?[u,v+n*period]:[v+n*period,u];
        const e=clip(transform(waves[i-1]),transform(waves[i]),rect);
        if(!e){flush();continue;}
        if(path.length&&!same(path.at(-1),e[0]))flush();
        if(!path.length)path.push(e[0]);path.push(e[1]);
      }
      flush();
    }
  }
}
