(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YoloVisionMath=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function windowAt(input,row,col,size=3){return input.slice(row,row+size).map(r=>r.slice(col,col+size));}
  function terms(input,kernel,row,col){return kernel.flatMap((r,y)=>r.map((weight,x)=>({value:input[row+y][col+x],weight,product:input[row+y][col+x]*weight})));}
  function convolve(input,kernel){const rows=input.length-kernel.length+1,cols=input[0].length-kernel[0].length+1;return Array.from({length:rows},(_,y)=>Array.from({length:cols},(_,x)=>terms(input,kernel,y,x).reduce((a,t)=>a+t.product,0)));}
  const relu=input=>input.map(row=>row.map(v=>Math.max(0,v)));
  function maxPool(input,size=2){return Array.from({length:Math.floor(input.length/size)},(_,y)=>Array.from({length:Math.floor(input[0].length/size)},(_,x)=>Math.max(...windowAt(input,y*size,x*size,size).flat())));}
  function rgbTerms(patch,kernel){return [0,1,2].map(channel=>kernel.flatMap((row,y)=>row.map((weight,x)=>patch[y][x][channel]*weight)));}
  function cueBoundary(time,delta,end,pending){return Math.min(time+Math.max(0,delta),pending?Math.max(time,end-.0001):end);}
  function choreograph(raw,smooth=false,start=.06,finish=.72){const p=Math.min(1,Math.max(0,(raw-start)/(finish-start)));return smooth?p*p*(3-2*p):p;}
  function pathPoint(points,progress){const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y));let distance=Math.min(1,Math.max(0,progress))*lengths.reduce((a,b)=>a+b,0);for(let i=0;i<lengths.length;i++){if(distance<=lengths[i]||i===lengths.length-1){const t=lengths[i]?distance/lengths[i]:0;return{x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t};}distance-=lengths[i];}return{...points[0]};}
  return{windowAt,terms,convolve,relu,maxPool,rgbTerms,cueBoundary,choreograph,pathPoint};
});
