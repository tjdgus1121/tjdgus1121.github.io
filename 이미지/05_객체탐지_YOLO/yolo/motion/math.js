(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YoloMath=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
  function iou(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),iw=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-x),ih=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-y),intersection=iw*ih,union=a.w*a.h+b.w*b.h-intersection;return{x,y,iw,ih,intersection,union,value:union>0?intersection/union:0};}
  function gridCoordinates(cx,cy,n){const col=Math.min(n-1,Math.max(0,Math.floor(clamp(cx)*n))),row=Math.min(n-1,Math.max(0,Math.floor(clamp(cy)*n)));return{col,row,column:col+1,line:row+1,x:clamp(cx*n-col),y:clamp(cy*n-row)};}
  function centerBox(cx,cy,w,h){return{x:cx-w/2,y:cy-h/2,w,h};}
  function sigmoid(z){return 1/(1+Math.exp(-z));}
  function normalize(values){const total=values.reduce((a,b)=>a+b,0);if(total<=0)return values.map(()=>1/values.length);return values.map(v=>v/total);}
  function argmax(values){return values.indexOf(Math.max(...values));}
  function nmsTrace(boxes,threshold){let remaining=[...boxes].sort((a,b)=>b.score-a.score);const keep=[],removed=[],trace=[{keep:[],removed:[],remaining:[...remaining],current:null}];while(remaining.length){const current=remaining.shift();keep.push(current);const survivors=[];for(const b of remaining){if(b.cls===current.cls&&iou(current,b).value>threshold)removed.push({...b,by:current.id});else survivors.push(b);}remaining=survivors;trace.push({keep:[...keep],removed:[...removed],remaining:[...remaining],current:current.id});}return trace;}
  function nms(boxes,threshold){return nmsTrace(boxes,threshold).at(-1);}
  function trainSequence(n,rate,target=.26,start=.64){const a=[start];for(let k=0;k<n;k++)a.push(a.at(-1)-rate*2*(a.at(-1)-target));return a;}
  function score(objectness,classProbability,quality=1){return objectness*classProbability*quality;}
  function evaluateThreshold(boxes,threshold,truthCount){const keep=boxes.filter(b=>b.score>=threshold),trueCount=keep.filter(b=>b.truth).length,falseCount=keep.length-trueCount;return{keep,trueCount,falseCount,missed:truthCount-trueCount};}
  function srtTime(t){const ms=Math.round(t*1000);return`${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')},${String(ms%1000).padStart(3,'0')}`;}
  return{clamp,iou,gridCoordinates,centerBox,sigmoid,normalize,argmax,nmsTrace,nms,trainSequence,score,evaluateThreshold,srtTime};
});
