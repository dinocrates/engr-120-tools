import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {sliceModel,locate,solidBoxes,HEIGHTS,COLORS,NAMES,LINE_WIDTH} from './engine.mjs';

const $=id=>document.getElementById(id);
const defaults={model:'block',height:0.3,density:20,walls:2,pattern:'lines',supports:true};
const patternNotes={
  lines:'Parallel lines turn 90° on the next layer. Isolate a layer to compare patterns.',
  grid:'Two crossing sets of straight lines form a square grid in each layer.',
  honeycomb:'Hexagonal cells repeat through the height. Shared edges are printed once in this teaching model.',
  gyroid:'Curves shift with Z to build a connected 3D pattern. Isolate a layer, then scrub up and down to see it change.'
};
let settings={...defaults},data,stage='paths',distance=0,playing=false,lastFrame=0,lastReadout=0,currentLayer=0,sliceTimer=0;
let scene,camera,renderer,controls,bed,models,ghost,plane,nozzle,gantry,pathGroup,partial,guideGroup;
let renderSets={},travelSet,webgl=true;
const stageOrder=['model','layers','paths','supports','motion'];
const lesson={
  model:{title:'The shape is only the beginning.',copy:'A 3D model describes the shape of the finished part. It does not tell the printer where to move. A slicer turns that geometry into instructions.',try:'Choose the stepped tower and rotate it. Imagine a horizontal plane moving upward: how would the outline change?',action:'Explore the stepped tower',view:'MODEL VIEW'},
  layers:{title:'A stack of cross-sections.',copy:'The slicer intersects the model with horizontal planes. Each cross-section becomes one layer. A smaller layer height means more layers for the same part height.',try:'Move the layer slider through the stepped tower. Then compare 0.30 mm and 0.10 mm: the part stays 18 mm tall.',action:'Compare a finer slice',view:'LAYER VIEW'},
  paths:{title:'A layer is a set of paths.',copy:'The slicer traces walls around the boundary, then fills the interior. The nozzle follows each line, depositing a narrow bead of plastic. Travel moves connect paths without depositing plastic.',try:'Isolate a middle layer and look from the top. Play the paths, then change the infill density. What stays the same?',action:'Isolate this layer ↗',view:'TOOLPATH VIEW'},
  supports:{title:'Plastic needs something beneath it.',copy:'Infill stays inside the finished part. Supports are temporary structures beneath overhangs. This T-shaped part has free ends that extend beyond its center column.',try:'Turn supports off. Move to the first layer of the wide cap and look underneath. What would those new paths rest on?',action:'Inspect the first overhang',view:'SUPPORT VIEW'},
  motion:{title:'Three axes. One planned move.',copy:'X and Y change position across the bed. Z increases between layers. Watch the coordinates as the nozzle travels, extrudes a bead, and rises to the next layer.',try:'Play a layer, or advance one move at a time. A travel move has no added E; an extrusion move advances filament.',action:'Watch a layer change',view:'NOZZLE VIEW'}
};

function disposeGroup(group) {
  if(!group)return;
  group.traverse(o=>{if(o.isInstancedMesh)o.dispose();o.geometry?.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});
  group.removeFromParent();
}
function meshBox(x,y,z,w,d,h,color,opacity=1) {
  const m=new THREE.Mesh(new THREE.BoxGeometry(w,d,h),new THREE.MeshStandardMaterial({color,roughness:0.68,metalness:0.15,transparent:opacity<1,opacity}));m.position.set(x,y,z);return m;
}
function label(text,color,position,size=3) {
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=80;
  const ctx=canvas.getContext('2d');ctx.font='bold 45px monospace';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,64,40);
  const tex=new THREE.CanvasTexture(canvas),mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
  const sprite=new THREE.Sprite(mat);sprite.scale.set(size*1.6,size,1);sprite.position.copy(position);return sprite;
}
function lineBetween(a,b,color,opacity=1) {
  const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a),new THREE.Vector3(...b)]);
  return new THREE.Line(geo,new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity}));
}
function initScene() {
  try {
    scene=new THREE.Scene();scene.background=new THREE.Color(0x0a142a);
    camera=new THREE.PerspectiveCamera(36,1,0.1,500);camera.up.set(0,0,1);
    renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x0a142a);renderer.outputColorSpace=THREE.SRGBColorSpace;
    $('scene').prepend(renderer.domElement);renderer.domElement.setAttribute('aria-hidden','true');
    controls=new OrbitControls(camera,renderer.domElement);controls.target.set(50,50,9);controls.enableDamping=true;controls.dampingFactor=0.12;controls.minDistance=30;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*0.49;controls.enablePan=true;
    scene.add(new THREE.AmbientLight(0xb3d2ff,2.2));
    const light=new THREE.DirectionalLight(0xe9faff,3);light.position.set(20,-30,100);scene.add(light);
    const sideLight=new THREE.DirectionalLight(0x3d8eff,1.5);sideLight.position.set(100,80,50);scene.add(sideLight);
    bed=new THREE.Group();bed.add(meshBox(50,50,-1.2,66,66,2,0x142944));
    const grid=[];for(let v=20;v<=80;v+=5){grid.push(20,v,0,80,v,0,v,20,0,v,80,0);}
    const gridGeo=new THREE.BufferGeometry();gridGeo.setAttribute('position',new THREE.Float32BufferAttribute(grid,3));bed.add(new THREE.LineSegments(gridGeo,new THREE.LineBasicMaterial({color:0x345176,transparent:true,opacity:0.52})));
    const origin=new THREE.Vector3(22,22,0.3);
    for(const [v,col,txt,end] of [[new THREE.Vector3(1,0,0),0xff8394,'X',[78,22,0.6]],[new THREE.Vector3(0,1,0),0x83e9bb,'Y',[22,78,0.6]],[new THREE.Vector3(0,0,1),0x7ec1ff,'Z',[22,22,33]]]) {
      const arrow=new THREE.ArrowHelper(v,origin,txt==='Z'?28:50,col,2,1);bed.add(arrow);bed.add(label(txt,'#'+col.toString(16),new THREE.Vector3(...end),3.4));
    }
    bed.add(label('10 mm','#91a6c5',new THREE.Vector3(71,18,0),2.2));
    bed.add(lineBetween([65,20,0.4],[75,20,0.4],0x91a6c5));scene.add(bed);
    nozzle=new THREE.Group();
    const tip=new THREE.Mesh(new THREE.ConeGeometry(0.85,2.2,6),new THREE.MeshStandardMaterial({color:0xffcb75,metalness:0.45,roughness:0.35}));tip.rotation.x=-Math.PI/2;tip.position.z=1.1;nozzle.add(tip);
    nozzle.add(meshBox(0,0,3.05,2.7,2.7,1.7,0xf5a44c));
    nozzle.add(meshBox(0,0,5.5,4.4,4.4,3.3,0x243b58));
    nozzle.add(meshBox(0,-2.22,5.5,2.8,0.1,2,0x5b7e9b));
    const fins=[];for(let i=0;i<3;i++)fins.push(lineBetween([-1,-2.32,4.9+i*.5],[1,-2.32,4.9+i*.5],0x8cb1cc));fins.forEach(f=>nozzle.add(f));scene.add(nozzle);
    gantry=new THREE.Group();gantry.add(meshBox(50,50,34,60,1,1,0x3c587b,.35));scene.add(gantry);
    plane=new THREE.Mesh(new THREE.PlaneGeometry(46,34),new THREE.MeshBasicMaterial({color:0x73e2ff,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));plane.position.set(50,50,9);scene.add(plane);
    guideGroup=new THREE.Group();scene.add(guideGroup);
    const resize=()=>{const r=$('scene').getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe($('scene'));resize();setCamera('iso');
    renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();webgl=false;playing=false;$('scene-error').hidden=false;});
  }catch(e){webgl=false;$('scene-error').hidden=false;console.error('WebGL initialization failed',e);}
}

// A bead has a rectangular teaching cross-section; actual extrusions have rounded edges.
function beadVertices(a,b,h,out,normals) {
  const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<1e-8)return;
  const nx=-dy/len,ny=dx/len,w=LINE_WIDTH/2;
  const A=[a[0]+nx*w,a[1]+ny*w,a[2]-.005],B=[b[0]+nx*w,b[1]+ny*w,b[2]-.005];
  const C=[b[0]-nx*w,b[1]-ny*w,b[2]-.005],D=[a[0]-nx*w,a[1]-ny*w,a[2]-.005];
  const down=v=>[v[0],v[1],v[2]-h+.01];
  const face=(p,q,r,s,n)=>{out.push(...p,...q,...r,...p,...r,...s);for(let k=0;k<6;k++)normals.push(...n);};
  face(A,D,C,B,[0,0,1]);face(A,B,down(B),down(A),[nx,ny,0]);face(D,down(D),down(C),C,[-nx,-ny,0]);
}
const lowerBound=(arr,n)=>{let a=0,b=arr.length;while(a<b){const m=(a+b)>>1;if(arr[m]<n)a=m+1;else b=m;}return a;};

function buildGeometry() {
  if(!webgl)return;
  disposeGroup(pathGroup);disposeGroup(models);disposeGroup(ghost);
  pathGroup=new THREE.Group();scene.add(pathGroup);renderSets={};
  models=new THREE.Group();ghost=new THREE.Group();scene.add(models,ghost);
  for(const [x0,x1,y0,y1,z0,z1] of solidBoxes(settings.model)) {
    models.add(meshBox((x0+x1)/2,(y0+y1)/2,(z0+z1)/2,x1-x0,y1-y0,z1-z0,0x4ec6e4));
    const geometry=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),new THREE.LineBasicMaterial({color:0x9ab8d9,transparent:true,opacity:.33}));geometry.dispose();edges.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);ghost.add(edges);
  }
  for(const type of ['wall','infill','skin','support']) {
    // Reuse one bead geometry; dense curved infill needs many short segments.
    const indices=[],perLayer=new Uint32Array(data.totalLayers);
    data.paths.forEach((p,i)=>{if(p.type===type){indices.push(i);perLayer[p.layer]++;}});
    const geometry=new THREE.BoxGeometry(1,1,1);
    const material=new THREE.MeshStandardMaterial({color:COLORS[type],roughness:.6,metalness:.1,side:THREE.DoubleSide});
    const mesh=new THREE.InstancedMesh(geometry,material,Math.max(1,indices.length));
    const layerMesh=new THREE.InstancedMesh(geometry,material,Math.max(1,...perLayer));
    const transform=new THREE.Object3D();
    indices.forEach((index,i)=>{
      const p=data.paths[index],a=p.from,b=p.to;
      transform.position.set((a[0]+b[0])/2,(a[1]+b[1])/2,a[2]-settings.height/2);
      transform.rotation.set(0,0,Math.atan2(b[1]-a[1],b[0]-a[0]));
      transform.scale.set(p.length,LINE_WIDTH,settings.height-.01);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate=true;mesh.count=0;layerMesh.count=0;
    mesh.frustumCulled=false;layerMesh.frustumCulled=false;
    pathGroup.add(mesh,layerMesh);renderSets[type]={mesh,layerMesh,indices,cachedLayer:-1};
  }
  const travelVertices=[],travelIndices=[];data.paths.forEach((p,i)=>{if(p.type==='travel'){travelVertices.push(...p.from,...p.to);travelIndices.push(i);}});
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(travelVertices,3));
  const lines=new THREE.LineSegments(geo,new THREE.LineDashedMaterial({color:COLORS.travel,dashSize:.7,gapSize:.6,transparent:true,opacity:.45}));lines.computeLineDistances();lines.frustumCulled=false;pathGroup.add(lines);travelSet={mesh:lines,indices:travelIndices};
  const pGeo=new THREE.BufferGeometry();pGeo.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(54),3));pGeo.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(54),3));
  partial=new THREE.Mesh(pGeo,new THREE.MeshStandardMaterial({color:COLORS.wall,side:THREE.DoubleSide}));partial.frustumCulled=false;pathGroup.add(partial);
  applyStageVisibility();
}

function updateGeometry(loc) {
  if(!webgl)return;
  const layer=data.layers[loc.path.layer],isolate=$('isolate').checked;
  for(const value of Object.values(renderSets)) {
    const start=lowerBound(value.indices,layer.start),end=lowerBound(value.indices,loc.index);
    value.mesh.visible=!isolate;value.layerMesh.visible=isolate;value.mesh.count=end;
    if(isolate) {
      if(value.cachedLayer!==loc.path.layer){
        const layerEnd=lowerBound(value.indices,layer.end);
        value.layerMesh.instanceMatrix.array.set(value.mesh.instanceMatrix.array.subarray(start*16,layerEnd*16));
        value.layerMesh.instanceMatrix.needsUpdate=true;value.cachedLayer=loc.path.layer;
      }
      value.layerMesh.count=Math.max(0,end-start);
    }
  }
  const travelStart=lowerBound(travelSet.indices,layer.start),travelEnd=lowerBound(travelSet.indices,layer.end);
  travelSet.mesh.geometry.setDrawRange(travelStart*2,(travelEnd-travelStart)*2);travelSet.mesh.visible=$('travel').checked;
  partial.visible=loc.path.type!=='travel'&&loc.t>0;
  if(partial.visible){const verts=[],norms=[];beadVertices(loc.path.from,loc.position,settings.height,verts,norms);const attr=partial.geometry.attributes.position;attr.array.set(verts);attr.needsUpdate=true;partial.geometry.attributes.normal.array.set(norms);partial.geometry.attributes.normal.needsUpdate=true;partial.material.color.setHex(COLORS[loc.path.type]);partial.geometry.setDrawRange(0,verts.length/3);}
  nozzle.position.set(...loc.position);plane.position.z=layer.z+.04;
  if(stage==='motion') {
    for(const o of [...guideGroup.children]){guideGroup.remove(o);o.geometry?.dispose();o.material?.dispose();}
    const [x,y,z]=loc.position;
    guideGroup.add(lineBetween([22,22,z],[x,22,z],0xff8394,.65),lineBetween([x,22,z],[x,y,z],0x83e9bb,.65),lineBetween([x,y,0],[x,y,z],0x7ec1ff,.65));
    gantry.children[0].position.set(50,y,z+9);
  }
  $('overhang-warning').hidden=!(settings.model==='overhang'&&!settings.supports&&layer.z>15&&stage!=='model');
}

function applyStageVisibility() {
  if(!webgl||!models)return;
  models.visible=stage==='model';pathGroup.visible=stage!=='model';ghost.visible=$('ghost').checked&&stage!=='model';
  plane.visible=stage==='layers';nozzle.visible=stage==='paths'||stage==='motion'||(stage==='supports'&&playing);gantry.visible=stage==='motion';guideGroup.visible=stage==='motion';
}

function setCamera(view) {
  if(!webgl)return;
  controls.target.set(50,50,view==='top'?0:9);
  if(view==='top')camera.position.set(50,49.99,111);
  else if(view==='front')camera.position.set(50,-53,16);
  else camera.position.set(110,-28,76);
  camera.zoom=1.35;camera.updateProjectionMatrix();controls.update();
  ['iso','top','front'].forEach(id=>{$(id).classList.toggle('selected',id===view);$(id).setAttribute('aria-pressed',String(id===view));});
}

function updateReadout(loc,force=false) {
  const layer=data.layers[loc.path.layer],number=loc.path.layer+1;
  const percent=Math.max(0,Math.min(1,(distance-layer.startDistance)/(layer.endDistance-layer.startDistance)));
  currentLayer=loc.path.layer;
  $('layer').value=number;$('layer-value').textContent=`${number} of ${data.totalLayers}`;$('layer-badge').innerHTML=`${number}<span>/ ${data.totalLayers}</span>`;
  $('z-badge').textContent=`Z = ${loc.position[2].toFixed(2)} mm`;
  $('progress').value=Math.round(percent*1000);$('progress-value').textContent=Math.round(percent*100)+'%';
  ['x','y','z'].forEach((axis,i)=>{$('pos-'+axis).textContent=loc.position[i].toFixed(2);});
  const zMove=loc.path.type==='travel'&&Math.abs(loc.path.to[2]-loc.path.from[2])>1e-6;
  $('path-type').textContent=zMove?'Z rise · next layer':NAMES[loc.path.type];$('path-dot').style.background='#'+COLORS[loc.path.type].toString(16).padStart(6,'0');
  $('path-number').textContent=`${loc.index-layer.start+1}/${layer.end-layer.start}`;
  const p=loc.path;const travel=p.type==='travel';
  $('gcode').textContent=`${travel?'G0':'G1'} X${p.to[0].toFixed(2)} Y${p.to[1].toFixed(2)} Z${p.to[2].toFixed(2)}${travel?'':` E${p.eEnd.toFixed(3)}`}`;
  $('extrusion-state').textContent=travel?'NO EXTRUSION':'EXTRUSION';
  $('prev-layer').disabled=number===1;$('next-layer').disabled=number===data.totalLayers;
}

function sync(force=true) {
  if(!data)return;
  const loc=locate(data.paths,distance);updateGeometry(loc);updateReadout(loc,force);applyStageVisibility();
}
function setPlaying(value) {
  playing=value;$('play').textContent=playing?'Ⅱ Pause':'▶ Play paths';$('play').setAttribute('aria-pressed',String(playing));applyStageVisibility();
}
function gotoLayer(index,progress=1) {
  setPlaying(false);index=Math.max(0,Math.min(data.totalLayers-1,index));const l=data.layers[index];
  // A tiny positive offset selects the new layer at an exact shared boundary.
  distance=l.startDistance+(l.endDistance-l.startDistance)*progress;
  if(progress===0)distance+=1e-6;
  sync();
}
function regenerate(keep=true) {
  clearTimeout(sliceTimer);
  const fraction=keep&&data?(currentLayer+.5)/data.totalLayers:.5;
  setPlaying(false);data=sliceModel(settings);buildGeometry();
  $('layer').max=data.totalLayers;$('total-layers').textContent=data.totalLayers;
  $('path-length').textContent=(Object.values(data.extrusionTotals).reduce((a,b)=>a+b,0)/1000).toFixed(2)+' m';
  $('support-length').textContent=(data.extrusionTotals.support/1000).toFixed(2)+' m';
  $('height-value').textContent=settings.height.toFixed(2)+' mm';$('density-value').textContent=settings.density+'%';$('walls-value').textContent=settings.walls+(settings.walls===1?' wall':' walls');
  $('pattern-note').textContent=settings.density===100?'At 100% density, solid alternating lines replace the selected sparse pattern.':settings.density===0?'At 0% density, interior infill is off. Walls and solid surface layers remain.':patternNotes[settings.pattern];
  const desc={block:['CALIBRATION BLOCK','36 × 24 × 18 mm','A simple shape with a lot happening inside.'],steps:['STEPPED TOWER','36 × 24 × 18 mm','Three levels. Watch the cross-section change.'],overhang:['T-SHAPED OVERHANG','40 × 20 × 21 mm','A narrow column with a wide, unsupported cap.']}[settings.model];
  $('scene-model').textContent=desc[0];$('dimensions').textContent=desc[1];$('model-note').textContent=desc[2];
  $('support-help').textContent=settings.model==='overhang'?'Temporary material beneath both free ends':'This model needs no generated supports';
  $('settings-status').textContent=`Sliced into ${data.totalLayers} layers. ${settings.density===0?'Interior infill is off; solid surfaces remain.':'Paths updated.'}`;
  gotoLayer(Math.floor(fraction*data.totalLayers));
}

function changeStage(next) {
  setPlaying(false);stage=next;
  document.querySelectorAll('[data-stage]').forEach(b=>{const yes=b.dataset.stage===stage;b.classList.toggle('active',yes);if(yes)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
  const l=lesson[stage];$('lesson-title').textContent=l.title;$('lesson-copy').textContent=l.copy;$('try-copy').textContent=l.try;$('try-action').textContent=l.action;$('view-title').textContent=l.view;$('chapter-count').textContent=`0${stageOrder.indexOf(stage)+1} / 05`;
  $('isolate').checked=false;
  if(stage==='supports'&&settings.model!=='overhang'){settings.model='overhang';$('model').value='overhang';regenerate(false);gotoLayer(Math.ceil(15/settings.height));}
  if(stage==='layers'&&settings.model!=='steps'){settings.model='steps';$('model').value='steps';regenerate(false);}
  if(stage==='motion')$('travel').checked=true;
  setCamera('iso');sync();
}

for(const id of ['model','height','density','walls','pattern','supports']) {
  $(id).addEventListener(id==='density'||id==='walls'?'input':'change',()=>{
    const el=$(id);settings[id]=id==='supports'?el.checked:['height','density','walls'].includes(id)?+el.value:el.value;
    clearTimeout(sliceTimer);
    if(id==='density'||id==='walls'){
      setPlaying(false);$('density-value').textContent=settings.density+'%';$('walls-value').textContent=settings.walls+(settings.walls===1?' wall':' walls');
      $('settings-status').textContent='Updating paths…';sliceTimer=setTimeout(()=>regenerate(),140);
    }else regenerate();
  });
}
document.querySelectorAll('[data-stage]').forEach(b=>b.addEventListener('click',()=>changeStage(b.dataset.stage)));
['iso','top','front'].forEach(id=>$(id).addEventListener('click',()=>setCamera(id)));
['isolate','ghost','travel'].forEach(id=>$(id).addEventListener('change',sync));
$('zoom-in').addEventListener('click',()=>{if(webgl){camera.zoom=Math.min(4,camera.zoom*1.2);camera.updateProjectionMatrix();}});
$('zoom-out').addEventListener('click',()=>{if(webgl){camera.zoom=Math.max(.5,camera.zoom/1.2);camera.updateProjectionMatrix();}});
$('layer').addEventListener('input',()=>gotoLayer(+$('layer').value-1));
$('prev-layer').addEventListener('click',()=>gotoLayer(currentLayer-1));$('next-layer').addEventListener('click',()=>gotoLayer(currentLayer+1));
$('progress').addEventListener('input',()=>gotoLayer(currentLayer,+$('progress').value/1000));
$('play').addEventListener('click',()=>{
  if(stage==='model')changeStage('paths');
  if(!playing){const l=data.layers[currentLayer];if(distance>=l.endDistance-1e-4)gotoLayer(currentLayer,0);}
  setPlaying(!playing);
});
$('restart').addEventListener('click',()=>gotoLayer(currentLayer,0));
$('next-path').addEventListener('click',()=>{setPlaying(false);if(stage==='model')changeStage('paths');let loc=locate(data.paths,distance);const next=loc.t>.999?Math.min(data.paths.length-1,loc.index+1):loc.index;distance=data.paths[next].end;sync();});
$('try-action').addEventListener('click',()=>{
  if(stage==='model'){settings.model='steps';$('model').value='steps';regenerate(false);setCamera('iso');}
  if(stage==='layers'){settings.height=settings.height===.1?.3:.1;$('height').value=settings.height;regenerate();}
  if(stage==='paths'){$('isolate').checked=true;setCamera('top');gotoLayer(Math.floor(data.totalLayers/2),0);sync();}
  if(stage==='supports'){if(settings.model!=='overhang'){settings.model='overhang';$('model').value='overhang';regenerate(false);}gotoLayer(Math.ceil(15/settings.height));setCamera('front');}
  if(stage==='motion'){const l=data.layers[currentLayer];distance=l.startDistance+.95*(l.endDistance-l.startDistance);sync();setPlaying(true);}
});
$('reset').addEventListener('click',()=>{settings={...defaults};for(const key of Object.keys(defaults)){if(key==='supports')$(key).checked=settings[key];else $(key).value=settings[key];}for(const key of ['isolate','travel'])$(key).checked=false;$('ghost').checked=true;$('speed').value='5';stage='paths';regenerate(false);changeStage('paths');});
$('scene').addEventListener('keydown',e=>{
  if(!webgl||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();
  if(e.key==='+'||e.key==='-'){camera.zoom=Math.max(.5,Math.min(4,camera.zoom*(e.key==='+'?1.1:1/1.1)));camera.updateProjectionMatrix();}
  else {const delta=camera.position.clone().sub(controls.target);if(e.key==='ArrowLeft'||e.key==='ArrowRight')delta.applyAxisAngle(new THREE.Vector3(0,0,1),e.key==='ArrowLeft'?-.15:.15);else{delta.z=Math.max(2,delta.z+(e.key==='ArrowUp'?6:-6));}camera.position.copy(controls.target).add(delta);controls.update();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});

function frame(time) {
  requestAnimationFrame(frame);const dt=Math.min(.05,(time-lastFrame)/1000||0);lastFrame=time;
  if(playing&&data) {
    let remaining=dt;
    for(let count=0;count<64&&remaining>1e-9&&distance<data.distance;count++) {
      const p=locate(data.paths,Math.min(data.distance,distance+1e-8)).path;
      const zMove=p.type==='travel'&&Math.abs(p.to[2]-p.from[2])>1e-6;
      // Z moves have a visible duration even though the physical step is small.
      const velocity=zMove?p.length/.85:30*+$('speed').value;
      const need=(p.end-distance)/velocity;
      if(need<=remaining){distance=p.end;remaining-=need;}
      else {distance+=remaining*velocity;remaining=0;}
    }
    const loc=locate(data.paths,distance);updateGeometry(loc);
    if(time-lastReadout>75){updateReadout(loc);lastReadout=time;}
    if(distance>=data.distance){setPlaying(false);sync();}
  }
  if(webgl){controls.update();renderer.render(scene,camera);}
}
initScene();regenerate(false);requestAnimationFrame(frame);
