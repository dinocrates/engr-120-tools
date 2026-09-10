import assert from 'node:assert/strict';
import {honeycomb,gyroid} from '../infill.mjs';
import {sliceModel,regions,LINE_WIDTH} from '../engine.mjs';

const rect=[33.125,66.875,39.125,60.875];
const collect=(fn,density,z)=>{const lines=[];fn(rect,density,LINE_WIDTH,z,p=>lines.push(p));return lines;};
const length=lines=>lines.reduce((sum,ps)=>sum+ps.slice(1).reduce((s,p,i)=>s+Math.hypot(p[0]-ps[i][0],p[1]-ps[i][1]),0),0);
const xy=lines=>lines.map(ps=>ps.map(p=>p.slice(0,2)));

for(const fn of [honeycomb,gyroid]) {
  for(const density of [5,20,50,95])for(const z of [.3,1.7,9]) {
    const paths=collect(fn,density,z);assert.ok(paths.length);
    for(const ps of paths)for(const p of ps){assert.ok(p.every(Number.isFinite));assert.equal(p[2],z);assert.ok(p[0]>=rect[0]-1e-6&&p[0]<=rect[1]+1e-6&&p[1]>=rect[2]-1e-6&&p[1]<=rect[3]+1e-6);}
  }
  assert.ok(length(collect(fn,50,9))>length(collect(fn,20,9)));
  assert.ok(length(collect(fn,20,9))>length(collect(fn,5,9)));
}

const hex=collect(honeycomb,20,9),seen=new Set();
for(const ps of hex)for(let i=1;i<ps.length;i++) {
  const a=ps[i-1],b=ps[i];const key=[a,b].map(p=>p.slice(0,2).map(x=>x.toFixed(5)).join(',')).sort().join('|');
  assert.ok(!seen.has(key),'Honeycomb must not double-print shared edges');seen.add(key);
  const angle=Math.atan2(b[1]-a[1],b[0]-a[0])/(Math.PI/3);
  assert.ok(Math.abs(angle-Math.round(angle))<1e-7,'Hexagon edges must follow 60-degree directions');
}
assert.deepEqual(xy(collect(honeycomb,20,.3)),xy(collect(honeycomb,20,.6)));
assert.notDeepEqual(xy(collect(gyroid,20,.3)),xy(collect(gyroid,20,.6)));

// Endpoints satisfy the gyroid nodal equation, within sampled-curve clipping error.
for(const z of [.3,.6,1.7,9])for(const ps of collect(gyroid,20,z))for(const p of ps) {
  const k=2*Math.PI/(2.42*LINE_WIDTH/.2),X=(p[0]-50)*k,Y=(p[1]-50)*k,Z=p[2]*k;
  assert.ok(Math.abs(Math.sin(X)*Math.cos(Y)+Math.sin(Y)*Math.cos(Z)+Math.sin(Z)*Math.cos(X))<.04,'Gyroid paths must follow the level set');
}

for(const model of ['block','steps','overhang'])for(const height of [.1,.2,.3])for(const pattern of ['honeycomb','gyroid']) {
  const d=sliceModel({model,height,pattern,density:20,walls:2,supports:true});
  for(let i=0;i<d.paths.length;i++) {
    const p=d.paths[i];if(i){assert.deepEqual(p.from,d.paths[i-1].to);assert.equal(p.start,d.paths[i-1].end);}
    if(p.type==='travel')assert.equal(p.eStart,p.eEnd);else assert.ok(p.eEnd>p.eStart);
    if(p.type==='infill')for(const v of [p.from,p.to])assert.ok(regions(model,v[2]-height/2).some(r=>v[0]>=r[0]&&v[0]<=r[1]&&v[1]>=r[2]&&v[1]<=r[3]));
  }
  assert.ok(d.extrusionTotals.infill>0);
}
for(const density of [0,100])for(const pattern of ['honeycomb','gyroid']) {
  const opts={model:'block',height:.3,density,walls:2,supports:false};
  assert.deepEqual(sliceModel({...opts,pattern}).paths,sliceModel({...opts,pattern:'lines'}).paths);
}
console.log('PASS: both patterns, boundary clipping, density response, unique hexagon edges, Z-dependent gyroid contours, 18 complete slicing configurations, and 0%/100% behavior.');
