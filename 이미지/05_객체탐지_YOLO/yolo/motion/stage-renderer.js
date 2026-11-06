(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.YoloStageRenderer=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  // Keep the displayed SVG image node alive while animation values change.
  const sameKind=(a,b)=>a.nodeType===b.nodeType&&a.nodeName===b.nodeName&&a.namespaceURI===b.namespaceURI&&(a.nodeType!==1||a.nodeName!=='image'||a.getAttribute('href')===b.getAttribute('href'));
  function syncChildren(parent,blueprint,onNew){
    const wanted=Array.from(blueprint.childNodes);
    wanted.forEach((next,i)=>{
      let old=parent.childNodes[i];
      // An element appeared or vanished before this one: move the matching node here so images are not reloaded.
      if(old&&!sameKind(old,next))for(let j=i+1;j<Math.min(parent.childNodes.length,i+16);j++){const c=parent.childNodes[j];if(sameKind(c,next)){parent.insertBefore(c,old);old=c;break;}}
      if(!old){const n=next.cloneNode(true);parent.appendChild(n);if(onNew)onNew(n);return;}
      if(!sameKind(old,next)){const n=next.cloneNode(true);parent.replaceChild(n,old);if(onNew)onNew(n);return;}
      if(next.nodeType===1){
        for(const attr of Array.from(old.attributes))if(!next.hasAttribute(attr.name))old.removeAttribute(attr.name);
        for(const attr of Array.from(next.attributes))if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
        syncChildren(old,next,onNew);
      }else if(old.nodeValue!==next.nodeValue)old.nodeValue=next.nodeValue;
    });
    while(parent.childNodes.length>wanted.length)parent.removeChild(parent.lastChild);
  }

  // A new element fades in to the opacity it is drawn with, instead of popping up.
  function fadeIn(node){
    if(node.nodeType!==1||typeof node.animate!=='function'||node.closest&&node.closest('defs'))return;
    const target=Number(node.getAttribute('opacity')??1);
    node.animate([{opacity:0},{opacity:Number.isFinite(target)?target:1}],{duration:420,easing:'cubic-bezier(.2,.7,.3,1)'});
  }
  function patchSvg(stage,markup,{enter=false}={}){
    const blueprint=stage.ownerDocument.createElementNS('http://www.w3.org/2000/svg','svg');
    blueprint.innerHTML=markup;
    syncChildren(stage,blueprint,enter?fadeIn:null);
  }

  // Reads the file in chunks and reports the received fraction (null when the size is unknown).
  async function readBytes(src,fetchImpl,onProgress,signal){
    const response=await fetchImpl(src,{signal});
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    const total=Number(response.headers&&response.headers.get('content-length'))||0;
    if(!response.body||typeof response.body.getReader!=='function'){await response.arrayBuffer();onProgress(1);return;}
    const reader=response.body.getReader();let received=0;
    for(;;){const{done,value}=await reader.read();if(done)break;received+=value.length;onProgress(total?Math.min(1,received/total):null);}
    onProgress(1);
  }

  function loadImage(src,{ImageCtor=globalThis.Image,timeoutMs=15000,onProgress=null,fetchImpl=globalThis.fetch}={}){
    return new Promise((resolve,reject)=>{
      const image=new ImageCtor();let settled=false,decoding=false;
      const abort=typeof AbortController==='function'?new AbortController():null;
      const finish=(error)=>{
        if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;
        if(error){if(abort)abort.abort();reject(error);}else resolve(image);
      };
      const timer=setTimeout(()=>finish(new Error('Image loading timed out')),timeoutMs);
      const decodeImage=()=>{
        if(settled)return;
        image.decoding='async';
        image.onerror=()=>finish(new Error('Image could not be loaded'));
        image.onload=async()=>{
          if(settled||decoding)return;decoding=true;
          let decodeError=null;
          if(typeof image.decode==='function'){try{await image.decode();}catch(error){decodeError=error;}}
          // Some browsers reject decode() for large or background images that loaded fine; only missing pixels are fatal.
          if(image.naturalWidth&&image.naturalHeight)finish();
          else finish(decodeError||new Error('Image has no pixels'));
        };
        image.src=src;
        if(image.complete&&image.naturalWidth)image.onload();
      };
      // Fetch first so progress is real bytes; the image then reuses the browser cache. file:// pages and fetch failures load the image directly.
      const canFetch=onProgress&&typeof fetchImpl==='function'&&!/^file:/i.test((globalThis.location&&globalThis.location.protocol)||'');
      if(canFetch)readBytes(src,fetchImpl,p=>{if(!settled)onProgress(p);},abort&&abort.signal).then(decodeImage,decodeImage);
      else decodeImage();
    });
  }

  // Every lesson bitmap must be decoded before the player becomes ready. Successful files survive retries.
  async function loadImages(sources,{cache=new Map(),onProgress=()=>{},loadImageImpl=loadImage,...options}={}){
    const urls=[...new Set(sources.filter(Boolean))],parts=new Map(urls.map(src=>[src,cache.has(src)?1:0]));
    const report=()=>onProgress({fraction:urls.length?[...parts.values()].reduce((a,b)=>a+b,0)/urls.length:1,loaded:urls.filter(src=>cache.has(src)).length,total:urls.length});
    report();
    const results=await Promise.allSettled(urls.map(async src=>{
      if(cache.has(src))return cache.get(src);
      const image=await loadImageImpl(src,{...options,onProgress:f=>{if(f!=null&&Number.isFinite(f)){parts.set(src,Math.max(parts.get(src),Math.min(1,Math.max(0,f))*.9));report();}}});
      cache.set(src,image);parts.set(src,1);report();return image;
    }));
    const failures=results.flatMap((r,i)=>r.status==='rejected'?[{src:urls[i],error:r.reason}]:[]);
    if(failures.length){const error=new Error('Lesson images could not be prepared');error.failures=failures;throw error;}
    return new Map(urls.map(src=>[src,cache.get(src)]));
  }

  return{syncChildren,patchSvg,loadImage,loadImages};
});
