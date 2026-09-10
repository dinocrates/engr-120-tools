// Printer-space geometry: X right, Y toward the back, Z upward. Units: mm.
import {honeycomb,gyroid} from './infill.mjs';
export const LINE_WIDTH = 0.45;
export const HEIGHTS = {block:18, steps:18, overhang:21};
export const COLORS = {wall:0x55d9fa,infill:0xb091ff,skin:0x64dfb1,support:0xffb24a,travel:0xb4c6e5};
export const NAMES = {wall:'Wall',infill:'Infill',skin:'Solid surface',support:'Support',travel:'Travel · no extrusion'};

export function regions(model,z) {
  if(model==='steps') return [[32,68-(z>12?24:z>6?12:0),38,62]];
  if(model==='overhang') return z>15?[[30,70,40,60]]:[[44,56,40,60]];
  return [[32,68,38,62]];
}
export function solidBoxes(model) {
  if(model==='steps') return [[32,68,38,62,0,6],[32,56,38,62,6,12],[32,44,38,62,12,18]];
  if(model==='overhang') return [[44,56,40,60,0,15],[30,70,40,60,15,21]];
  return [[32,68,38,62,0,18]];
}
const inset=(r,d)=>[r[0]+d,r[1]-d,r[2]+d,r[3]-d];
const valid=r=>r[1]>r[0]&&r[3]>r[2];

function hatch(rect,pitch,vertical,emit,type,z) {
  if(!valid(rect))return;
  const [x0,x1,y0,y1]=rect;
  const lo=vertical?x0:y0,hi=vertical?x1:y1;
  const n=Math.max(1,Math.floor((hi-lo)/pitch)+1);
  const start=(lo+hi-(n-1)*pitch)/2;
  for(let i=0;i<n;i++) {
    const q=start+i*pitch;
    let a=vertical?[q,y0,z]:[x0,q,z],b=vertical?[q,y1,z]:[x1,q,z];
    if(i%2)[a,b]=[b,a];
    emit([a,b],type);
  }
}

export function sliceModel(settings) {
  const {model='block',height=0.3,density=20,walls=2,pattern='lines',supports=true}=settings;
  const totalLayers=Math.round(HEIGHTS[model]/height);
  const paths=[],layers=[];let pos=[25,25,0],distance=0,e=0;
  const extrusionTotals={wall:0,infill:0,skin:0,support:0};
  function segment(to,type,layer) {
    const len=Math.hypot(...to.map((v,i)=>v-pos[i]));
    if(len<1e-7)return;
    const eStart=e;
    if(type!=='travel'){e+=len*LINE_WIDTH*height/(Math.PI*1.75**2/4);extrusionTotals[type]+=len;}
    paths.push({from:pos.slice(),to:to.slice(),type,layer,length:len,start:distance,end:distance+len,eStart,eEnd:e});
    distance+=len;pos=to.slice();
  }
  for(let layer=0;layer<totalLayers;layer++) {
    const z=+(height*(layer+1)).toFixed(5), sample=z-height/2;
    const info={start:paths.length,startDistance:distance,z};
    // Separate Z lift from XY travel so students can see the layer change.
    segment([pos[0],pos[1],z],'travel',layer);
    const emit=(points,type)=>{
      segment(points[0],'travel',layer);
      for(let i=1;i<points.length;i++)segment(points[i],type,layer);
    };
    if(model==='overhang'&&supports&&z<=15-height+1e-6) {
      // One-layer contact gap under the cantilever. A denser interface near the top.
      const pitch=z>15-3*height?0.6:2.25;
      for(const r of [[30,43.6,40,60],[56.4,70,40,60]])hatch(inset(r,LINE_WIDTH/2),pitch,layer%2===1,emit,'support',z);
    }
    for(const r of regions(model,sample)) {
      for(let w=0;w<walls;w++) {
        const [a,b,c,d]=inset(r,LINE_WIDTH*(w+0.5));
        if(a<b&&c<d)emit([[a,c,z],[b,c,z],[b,d,z],[a,d,z],[a,c,z]],'wall');
      }
      const inner=inset(r,LINE_WIDTH*walls+LINE_WIDTH/2);
      const surfaceRects=[];
      if(layer<3||layer>=totalLayers-3)surfaceRects.push(inner);
      else if(model==='steps') {
        // Close only the exposed terrace, leaving the continuing tower sparse.
        if(z<=6+1e-6&&z>6-3*height)surfaceRects.push([Math.max(inner[0],56),inner[1],inner[2],inner[3]]);
        if(z<=12+1e-6&&z>12-3*height)surfaceRects.push([Math.max(inner[0],44),inner[1],inner[2],inner[3]]);
      } else if(model==='overhang'&&z>15&&z<=15+3*height+1e-6) {
        surfaceRects.push([inner[0],44,inner[2],inner[3]],[56,inner[1],inner[2],inner[3]]);
      }
      // Subtract rectangular solid-surface zones from the sparse region.
      let sparse=[inner];
      for(const s of surfaceRects.filter(valid)) {
        hatch(s,LINE_WIDTH,layer%2===1,emit,'skin',z);
        sparse=sparse.flatMap(a=>{
          const lo=Math.max(a[0],s[0]),hi=Math.min(a[1],s[1]);
          return hi<=lo?[a]:[[a[0],lo,a[2],a[3]],[hi,a[1],a[2],a[3]]].filter(valid);
        });
      }
      if(density>0)for(const s of sparse.filter(valid)) {
        if(pattern==='honeycomb'&&density<100) {
          honeycomb(s,density,LINE_WIDTH,z,emit);
        } else if(pattern==='gyroid'&&density<100) {
          gyroid(s,density,LINE_WIDTH,z,emit);
        } else if(pattern==='grid'&&density<100) {
          const pitch=LINE_WIDTH/(1-Math.sqrt(1-density/100));
          hatch(s,pitch,false,emit,'infill',z);hatch(s,pitch,true,emit,'infill',z);
        } else hatch(s,LINE_WIDTH/(density/100),layer%2===1,emit,'infill',z);
      }
    }
    info.end=paths.length;info.endDistance=distance;layers.push(info);
  }
  return {paths,layers,totalLayers,distance,extrusionTotals,filament:e,height,model};
}

export function locate(paths,distance) {
  let a=0,b=paths.length-1;
  while(a<b){const m=(a+b)>>1;if(paths[m].end<distance)a=m+1;else b=m;}
  const p=paths[a],t=Math.max(0,Math.min(1,(distance-p.start)/p.length));
  return {index:a,path:p,t,position:p.from.map((v,i)=>v+(p.to[i]-v)*t)};
}
