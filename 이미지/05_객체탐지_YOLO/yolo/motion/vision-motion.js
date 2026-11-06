(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory;else root.YoloVisionMotion=factory;})(typeof globalThis!=='undefined'?globalThis:this,function createVisionMotion(api){
  'use strict';
  const {state,data,math:M,sceneData:D,helpers:h}=api,{ASSET,OBJECTS}=D;
  const colors=['#cd4947','#338557','#4877c3'],names=['R 빨강','G 초록','B 파랑'];
  const output=M.convolve(data.input,data.kernel),horizontal=M.convolve(data.input,data.kernel[0].map((_,x)=>data.kernel.map(row=>row[x])));
  const maps=[output,horizontal],pooled=maps.map(m=>M.maxPool(M.relu(m))),maxAbs=Math.max(1,...output.flat().map(Math.abs));
  let focus={row:0,col:0,value:0};output.forEach((r,row)=>r.forEach((v,col)=>{if(Math.abs(v)>Math.abs(focus.value))focus={row,col,value:v};}));
  const layout=()=>api.layout(),selected=()=>api.selected(),progress=()=>api.progress();
  const t=(x,y,s,size=28,color='#40394f',anchor='start')=>h.txt(x,y,s,size,color,anchor);
  const panel=(x,y,w,hh,title)=>h.cornerCard(x,y,w,hh,title);
  // Reads the colour family from the three numbers so learners can link RGB values to what they see.
  function colorHint([r,g,b]){if(g>r+40&&b>r+40&&Math.abs(g-b)<30)return'청록 계열: G·B가 R보다 커요';if(b>r+40&&b>=g)return'파랑 계열: B가 가장 커요';if(r>=150&&g>=130&&b<90)return'노랑 계열: R·G가 크고 B가 작아요';if(r>g+40&&g>b+20)return'주황·갈색 계열: R > G > B';if(r>=150&&g<90&&b<90)return'빨강 계열: R만 커요';if(Math.max(r,g,b)-Math.min(r,g,b)<30)return r>=150?'밝은 회색 계열: 세 값이 비슷하고 커요':'어두운 회색 계열: 세 값이 비슷하고 작아요';return'세 값의 비율이 색을 정해요';}
  function channelDefs(){return `<defs>${[0,1,2].map(c=>`<filter id="rgb-${c}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${Array.from({length:4},(_,r)=>Array.from({length:5},(_,col)=>r===3&&col===3?1:r===c&&col===c?1:0).join(' ')).join(' ')}"/></filter>`).join('')}</defs>`;}
  function image(f,{channel=null,opacity=1,screen=false}={}){return `<image href="${channel===null?ASSET.display||ASSET.src:ASSET.channels?ASSET.channels[channel]:ASSET.display||ASSET.src}" x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" opacity="${opacity}" ${channel===null||ASSET.channels?'':`filter="url(#rgb-${channel})"`} ${screen?'style="mix-blend-mode:screen"':''} preserveAspectRatio="xMidYMid meet"/>`;}
  // focus: the centre pixel is the one marked on the photo, so dim its neighbours and ring it with a beating double outline.
  function patchGrid(patch,x,y,cell,channel,{focus=false}={}){
    const m=layout().mobile,fs=m?27:22;let s='';
    // With focus rings the cells spread apart (centre unchanged) so the rings never cover a neighbour's number.
    const gap=focus?14:0,at=i=>i*(cell+gap)-gap;
    patch.forEach((row,r)=>row.forEach((rgb,c)=>{const mid=r===1&&c===1,color=rgb.map((v,i)=>i===channel?v:0),value=rgb[channel];s+=`<g opacity="${focus&&!mid?.42:1}">`+h.rect(x+at(c),y+at(r),cell-3,cell-3,`rgb(${color.join(',')})`,mid&&!focus?'#ffe29a':'#ccc',5)+t(x+at(c)+cell/2-1.5,y+at(r)+.64*cell,value,mid&&focus?fs+6:fs,channel===1&&value>145?'#17251e':'#fff','middle')+'</g>';}));
    if(focus){const x0=x+cell,y0=y+cell,w=cell-3,ring=(d,stroke,width,extra='')=>`<rect x="${x0-d}" y="${y0-d}" width="${w+2*d}" height="${w+2*d}" rx="${6+d}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
      s+=`<g class="beat">${ring(11,colors[channel],10,'stroke-opacity=".45"')}${ring(5,'#fff',6)}${ring(5,'#40394f',2.5)}</g>`+(m?'':t(x+3*cell+gap+10,y+1.62*cell,'← 표식 위치',17,'#746b80'));}
    return s;
  }
  function rgb(k){
    const L=layout(),o=selected(),p=M.choreograph(progress(),true,.06,k===3?.39:.72),patch=data.rgbPatches[o.id];let s=channelDefs();
    if(k===0||k===3){
      const f=L.mobile?{x:40,y:340,w:820,h:820*ASSET.height/ASSET.width}:{x:70,y:190,w:700,h:700*ASSET.height/ASSET.width};
      s+=h.rect(f.x,f.y,f.w,f.h,'#000','#40394f',0);
      if(k===0)s+=image(f);else s+=`<g style="isolation:isolate">${[0,1,2].map(c=>image({...f,x:f.x+(c-1)*(1-p)*(L.mobile?25:65)},{channel:c,screen:true})).join('')}</g>`+image(f,{opacity:Math.max(0,Math.min(1,(p-.8)/.2))});
      const dot={x:f.x+o.pixel[0]/ASSET.width*f.w,y:f.y+o.pixel[1]/ASSET.height*f.h};s+=h.cross(dot);
      const x=L.mobile?40:850,y=L.mobile?845:205,w=L.mobile?820:680,hh=L.mobile?300:360;
      s+=panel(x,y,w,hh,k===0?'한 점에 세 숫자가 있어요':'같은 위치에서 R + G + B');
      o.rgb.forEach((v,c)=>{const yy=y+80+c*(L.mobile?48:66);s+=t(x+22,yy,names[c],L.mobile?29:27,colors[c])+h.rect(x+170,yy-24,w-290,29,'#e7e0da','none',6)+h.rect(x+170,yy-24,(w-290)*v/255*(k===0?Math.max(0,Math.min(1,p*3-c*.8)):1),29,colors[c],'none',6)+t(x+w-25,yy,String(v),L.mobile?32:30,'#40394f','end');});
      if(k===3){s+=h.rect(x+22,y+hh-94,86,40,`rgb(${o.rgb.join(',')})`,'#40394f',7,'data-rgb-chip="true"')+t(x+128,y+hh-64,`한 픽셀 = RGB (${o.rgb.join(', ')})`,L.mobile?26:24);}
      else s+=h.rect(x+22,y+hh-94,86,40,`rgb(${o.rgb.join(',')})`,'#40394f',7)+t(x+128,y+hh-64,colorHint(o.rgb),L.mobile?26:24,'#7861a4');
      s+=t(x+22,y+hh-24,k===0?`한 픽셀 RGB = (${o.rgb.join(', ')})`:`전체 입력: ${ASSET.width} × ${ASSET.height} × 3`,L.mobile?29:27);
      if(!L.mobile&&k===0){s+=panel(350,625,900,110,'사진은 숫자 배열이에요');s+=t(375,703,'각 위치에 R, G, B가 하나씩 있어요.',25);}
      else if(!L.mobile){
        // The input as three stacked layers, with the three axes the narration names: width, height, channel.
        // Layers are offset (dx, dy) so each back layer shows a strip wide enough for its letter.
        const W=ASSET.width,H=ASSET.height,px=400,py=660,lw=120,lh=46,dx=22,dy=18,top=py+2*dy,base=top+lh+10;s+=panel(350,612,900,172,'세 채널을 겹치면 원래 색 · 입력은 3겹 숫자 배열');
        [2,1,0].forEach(c=>s+=h.rect(px+c*dx,py+(2-c)*dy,lw,lh,colors[c],'#40394f',4,'fill-opacity=".9"')+t(px+c*dx+8,py+(2-c)*dy+15,['R','G','B'][c],14,'#fff'));
        s+=h.line({x:px,y:base},{x:px+lw,y:base},'#40394f',2,'marker-end="url(#arrow)"')+t(px+lw/2,base+21,`가로 ${W}`,16,'#40394f','middle');
        s+=h.line({x:px-10,y:top},{x:px-10,y:top+lh},'#40394f',2,'marker-end="url(#arrow)"')+`<g transform="rotate(-90 ${px-24} ${top+lh/2})">${t(px-24,top+lh/2,`세로 ${H}`,14,'#40394f','middle')}</g>`;
        s+=h.line({x:px+lw+3,y:top},{x:px+2*dx+lw+3,y:py+2},'#40394f',2,'marker-end="url(#arrow)"')+t(px+2*dx+lw+10,py+8,'채널 3',16,'#40394f');
        s+=t(640,690,'입력 = 가로 × 세로 × 채널',26)+t(640,728,`= ${W} × ${H} × 3 = ${(W*H*3).toLocaleString()}개 숫자`,24,'#7861a4')+t(640,762,'같은 위치의 R·G·B 세 값이 모여 한 픽셀의 색이 돼요.',20,'#746b80');
      }
    }else{
      const w=L.mobile?250:k===2?380:440,hh=w*ASSET.height/ASSET.width,y=L.mobile?360:k===2?180:210,base=L.mobile?[40,325,610]:k===2?[80,610,1140]:[50,580,1110];
      [0,1,2].forEach(c=>{
        const x=k===1?base[c]+(L.mobile?0:(1-p)*(1-c)*350):base[c],dot={x:x+o.pixel[0]/ASSET.width*w,y:y+o.pixel[1]/ASSET.height*hh};
        s+=t(x,y-24,names[c],L.mobile?32:29,colors[c])+h.rect(x,y,w,hh,'#000','#40394f',0)+image({x,y,w,h:hh},{channel:c});
        s+=`<g data-pixel-channel="${c}" data-source-x="${o.pixel[0]}" data-source-y="${o.pixel[1]}">${k===2?`<g class="beat">${h.cross(dot,colors[c])}</g>`:h.cross(dot,colors[c])}</g>`;
        if(k===2){const cell=L.mobile?62:55,gx=x+(w-3*cell)/2,gy=y+hh+(L.mobile?75:45);s+=h.line(dot,{x:gx+cell*1.5,y:gy-7},colors[c],2,'marker-end="url(#arrow)"')+patchGrid(patch,gx,gy,cell,c,{focus:true});}
        else s+=h.line(dot,{x:x+w/2,y:y+hh+24},colors[c],2,'marker-end="url(#arrow)"')+t(x+w/2,y+hh+61,`${['R','G','B'][c]} = ${o.rgb[c]}`,L.mobile?30:28,colors[c],'middle');
      });
      const yy=L.mobile?(k===2?900:700):(k===2?625:570);s+=panel(L.mobile?40:350,yy,L.mobile?820:900,L.mobile?230:135,k===1?'원본 사진에서 한 채널씩 꺼냈어요':'같은 위치의 세 칸을 묶어요');
      if(k===1)s+=h.textLines(L.mobile?65:375,yy+80,'색이 밝을수록 해당 채널의 값이 커요. 각 채널도 가로 × 세로 숫자 배열이에요.',L.mobile?765:850,L.mobile?30:28).svg;
      else o.rgb.forEach((v,c)=>s+=h.mathRow(L.mobile?65:385+c*290,yy+(L.mobile?70+c*52:88),[`${['R','G','B'][c]} =`,[String(v),'255'],`= ${(v/255).toFixed(3)}`],L.mobile?28:27,colors[c]));
    }
    return s;
  }
  function heat(matrix,x,y,cell,{numbers=false,limit=Infinity,highlight=null,signed=false}={}){
    let s='';matrix.forEach((row,r)=>row.forEach((value,c)=>{const idx=r*row.length+c,shown=idx<=limit,amount=signed?Math.min(1,Math.abs(value)/maxAbs):Math.max(0,Math.min(1,value/255)),color=shown?(signed?(value>=0?`rgb(${245-amount*140},${237-amount*150},${250-amount*90})`:`rgb(${226-amount*110},${244-amount*65},${237-amount*75})`):`rgb(${value},${value},${value})`):'#e6e0dc';s+='<g>'+h.rect(x+c*cell,y+r*cell,cell-2,cell-2,color,'#9c91a0',2);if(numbers&&shown)s+=t(x+(c+.5)*cell,y+(r+.65)*cell,String(value),cell*.39,(!signed&&value<130)?'#fff':'#40394f','middle');s+='</g>';}));
    if(highlight)s+=h.rect(x+highlight.col*cell-2,y+highlight.row*cell-2,cell*highlight.size,cell*highlight.size,'none','#b25f30',3,'style="stroke-width:5"');return s;
  }
  // Bicycle crop geometry shared by the zoom-in (cue 1) and the zoom-out sweep (cue 4).
  // The grid is aligned to the chosen 8x8 patch, so that patch is exactly one grid cell.
  const BK=(()=>{const cp=data.cropPixels,[qx,qy]=data.patchPixels,cw=cp[2]-cp[0],ch=cp[3]-cp[1],gx0=qx-8*Math.ceil((qx-cp[0])/8),gy0=qy-8*Math.ceil((qy-cp[1])/8),cols=Math.ceil((cp[2]-gx0)/8),rows=Math.ceil((cp[3]-gy0)/8);return{cp,qx,qy,cw,ch,ratio:ch/cw,gx0,gy0,cols,rows,cells:cols*rows};})();
  const VA={x:BK.cp[0],y:BK.cp[1],w:BK.cw,h:BK.ch},VB={x:BK.qx+4-20,y:BK.qy+4-20*BK.ratio,w:40,h:40*BK.ratio};
  // Camera between the whole bicycle (e=0) and a 40-pixel-wide close-up (e=1); zoom is geometric so it feels even.
  function viewAt(e){const w=VA.w*Math.pow(VB.w/VA.w,e),u=(VA.w-w)/(VA.w-VB.w),cx=VA.x+VA.w/2+(VB.x+VB.w/2-VA.x-VA.w/2)*u,cy=VA.y+VA.h/2+(VB.y+VB.h/2-VA.y-VA.h/2)*u,hh=w*BK.ratio;return{x:cx-w/2,y:cy-hh/2,w,h:hh};}
  const lerpR=(a,b,e)=>({x:a.x+(b.x-a.x)*e,y:a.y+(b.y-a.y)*e,w:a.w+(b.w-a.w)*e,h:a.h+(b.h-a.h)*e});
  function bikeView(R,V,{grid=1,extra='',src=data.bikeCrop}={}){
    let g='';const ve='vector-effect="non-scaling-stroke"';
    if(grid>0){for(let x=BK.gx0+8;x<BK.cp[2];x+=8)g+=`<path d="M${x},${BK.cp[1]} V${BK.cp[3]}" ${ve}/>`;for(let y=BK.gy0+8;y<BK.cp[3];y+=8)g+=`<path d="M${BK.cp[0]},${y} H${BK.cp[2]}" ${ve}/>`;g=`<g stroke="#fff" stroke-opacity="${(.5*grid).toFixed(3)}" stroke-width="1" fill="none">${g}</g>`;}
    return `<svg x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" viewBox="${V.x} ${V.y} ${V.w} ${V.h}" preserveAspectRatio="none" overflow="hidden"><image href="${src}" x="${BK.cp[0]}" y="${BK.cp[1]}" width="${BK.cw}" height="${BK.ch}" style="image-rendering:pixelated"/>${g}${extra}</svg>`+h.rect(R.x,R.y,R.w,R.h,'none','#40394f',3);
  }
  const BIKE_THUMB={x:40,y:150,w:228,h:228*BK.ratio},BIKE_ZOOM={x:40,y:150+228*BK.ratio+42,w:190,h:190*BK.ratio};
  // Cue 4: back out to the whole bicycle; the same window sweeps every cell and the real filter result builds up beside it.
  function wholeSweep(){
    const L=layout(),m=L.mobile,pr=progress(),Z=BIKE_ZOOM,A2=m?{x:40,y:400,w:400,h:400*BK.ratio}:{x:130,y:180,w:400,h:400*BK.ratio},B2=m?{x:460,y:400,w:400,h:400*BK.ratio}:{x:870,y:180,w:400,h:400*BK.ratio};
    const out=m?1:M.choreograph(pr,true,0,.2),R=lerpR(Z,A2,out),V=viewAt(1-out),sx=R.w/V.w,X=x=>R.x+(x-V.x)*sx,Y=y=>R.y+(y-V.y)*sx;
    const q=M.choreograph(pr,false,.26,.9),total=BK.cells,done=Math.min(total,Math.floor(q*total)),fr=Math.floor(done/BK.cols),fc=done%BK.cols,cur=Math.min(total-1,done),cr=Math.floor(cur/BK.cols),cc=cur%BK.cols,positions=data.bikeConvInfo.positions;
    const read=`<rect x="${BK.gx0}" y="${BK.gy0}" width="${BK.cols*8}" height="${fr*8}"/><rect x="${BK.gx0}" y="${BK.gy0+fr*8}" width="${fc*8}" height="8"/>`,win=(rx,ry,k)=>h.rect(rx+(BK.gx0+cc*8-VA.x)*k,ry+(BK.gy0+cr*8-VA.y)*k,8*k,8*k,'#ffe29a66','#b25f30',2,'style="stroke-width:3"');
    let s=bikeView(R,V,{extra:`<g fill="#7861a4" fill-opacity=".2">${read}</g><rect x="${BK.qx}" y="${BK.qy}" width="8" height="8" fill="none" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`});
    if(q>0&&q<1)s+=win(A2.x,A2.y,A2.w/VA.w);
    const show=M.choreograph(pr,false,.16,.26),ks=B2.w/VA.w;
    let right=t(B2.x,B2.y-18,'필터 결과 (실제 계산)',m?24:22)+h.rect(B2.x,B2.y,B2.w,B2.h,'#efeae4','none',0);
    right+=`<svg x="${B2.x}" y="${B2.y}" width="${B2.w}" height="${B2.h}" viewBox="${VA.x} ${VA.y} ${VA.w} ${VA.h}" preserveAspectRatio="none"><defs><clipPath id="sweepRead">${read}</clipPath></defs><image href="${data.bikeConv}" x="${VA.x+1}" y="${VA.y+1}" width="${VA.w-2}" height="${VA.h-2}" clip-path="url(#sweepRead)" style="image-rendering:pixelated"/></svg>`+h.rect(B2.x,B2.y,B2.w,B2.h,'none','#40394f',3);
    if(q>0&&q<1)right+=win(B2.x,B2.y,ks);
    right+=t(B2.x,B2.y+B2.h+28,`3×3 계산 ${Math.round(positions*done/total).toLocaleString()} / ${positions.toLocaleString()}번`,m?22:20,'#7861a4')+t(B2.x,B2.y+B2.h+54,'회색 = 0 · 밝음 = 양수 · 어두움 = 음수',m?18:16,'#746b80');
    s+=t(A2.x,A2.y-18,`입력: 자전거 ${BK.cw}×${BK.ch} 픽셀`,m?24:22,'#40394f','start',`opacity="${out.toFixed(3)}"`)+`<g opacity="${show.toFixed(3)}">${t(A2.x,A2.y+A2.h+28,`필터가 훑은 곳 ${Math.round(100*done/total)}%`,m?22:20,'#b25f30')+t(A2.x,A2.y+A2.h+54,'격자 한 칸 = 아까 확대해서 본 8×8 픽셀',m?18:16,'#746b80')+right}`;
    const end=M.choreograph(pr,false,.9,.97),mid=m?{x:450,y:A2.y+A2.h+110}:{x:(A2.x+A2.w+B2.x)/2,y:A2.y+A2.h/2};
    if(!m)s+=h.line({x:A2.x+A2.w+22,y:mid.y},{x:B2.x-22,y:mid.y},'#7861a4',3,'marker-end="url(#arrow)"')+t(mid.x,mid.y-18,'같은 3×3 필터',20,'#7861a4','middle')+t(mid.x,mid.y+34,'곱셈 9개 + 덧셈',18,'#746b80','middle');
    s+=`<g opacity="${end.toFixed(3)}">${t(mid.x,mid.y+(m?0:96),'확대하면: 숫자 9개의 계산',m?24:20,'#40394f','middle')+t(mid.x,mid.y+(m?36:126),'크게 보면: 사진 전체를 쭉',m?24:20,'#34785f','middle')}</g></g>`;
    return s;
  }
  // Which window and which of its nine products the picture shows; also used to hand playback over to the tools.
  function convWindow(k){
    const p=M.choreograph(progress(),false,.06,.82),p0=M.choreograph(progress(),false,.56,.95),sweep=36*Math.pow(p,1.7),scan=Math.min(35,Math.floor(sweep)),pos=k===2?sweep:k===0?6*p0:9*p;
    return{p,scan,f:state.exploring?0:pos%1,row:state.exploring?state.convRow-1:k===2?Math.floor(scan/6):k===0?Math.min(5,Math.floor(p0*6)):focus.row,col:state.exploring?state.convCol-1:k===2?scan%6:focus.col,active:state.exploring?state.convTerm-1:Math.min(8,Math.floor(p*9))};
  }
  function convolution(k){
    const L=layout(),{p,scan,f,row,col,active}=convWindow(k);
    const terms=M.terms(data.input,data.kernel,row,col),value=terms.reduce((a,b)=>a+b.product,0);
    let s='';
    if(k===3&&!state.exploring)return wholeSweep();
    if(k===4){
      const patch=M.windowAt(data.rgbInput,focus.row,focus.col),parts=M.rgbTerms(patch,data.kernel),sums=parts.map(a=>a.reduce((x,y)=>x+y,0)),result=sums.reduce((x,y)=>x+y,0);
      s+=channelDefs();[0,1,2].forEach(c=>{const x=L.mobile?40+c*285:70+c*430,y=L.mobile?380:210,cell=L.mobile?66:75;s+=t(x,y-25,names[c],L.mobile?32:29,colors[c])+patchGrid(patch,x,y,cell,c)+t(x+cell*1.5,y+cell*3+50,`9개 곱의 합 = ${sums[c]}`,L.mobile?28:27,colors[c],'middle');});
      // Same window as the brightness step: weighting the channel sums gives the unrounded value; the brightness step used rounded pixels.
      const gray=M.windowAt(data.input,focus.row,focus.col).reduce((a,r,y)=>a+r.reduce((b,v,x)=>b+v*data.kernel[y][x],0),0),exact=.299*sums[0]+.587*sums[1]+.114*sums[2],paren=v=>v<0?`(${v})`:String(v);
      const x=L.mobile?40:350,y=L.mobile?840:600,w=L.mobile?820:1000;s+=panel(x,y-(L.mobile?0:18),w,L.mobile?330:190,`출력 ${focus.row+1}행 ${focus.col+1}열 창의 R·G·B · 27개 곱셈`);s+=t(x+25,y+(L.mobile?85:67),`${sums.map((v,i)=>i?paren(v):v).join(' + ')} + 편향 0 = ${result} → 활성화 뒤 ${Math.max(0,result)}`,L.mobile?30:31)+h.textLines(x+25,y+(L.mobile?145:104),`밝기 가중합: 0.299×${paren(sums[0])} + 0.587×${paren(sums[1])} + 0.114×${paren(sums[2])} = ${exact.toFixed(1)}\n앞 단계 같은 창의 ${gray}와 다른 건, 그때 픽셀 밝기를 정수로 반올림했기 때문이에요.`,w-50,L.mobile?27:23).svg;
      return s;
    }
    if(k===1||state.exploring){
      const c=L.mobile?80:70,ix=L.mobile?40:390,iy=L.mobile?400:245,kx=L.mobile?350:750,ox=L.mobile?700:1190;
      s+=t(ix,iy-35,'입력 3×3',L.mobile?32:29)+heat(M.windowAt(data.input,row,col),ix,iy,c,{numbers:true});
      s+=t(kx,iy-35,'필터 3×3',L.mobile?32:29)+heat(data.kernel.map(r=>r.map(v=>(v+2)*50)),kx,iy,c);
      data.kernel.forEach((r,y)=>r.forEach((v,x)=>s+=t(kx+(x+.5)*c,iy+(y+.65)*c,v,c*.42,v<1?'#fff':'#40394f','middle')));
      const partial=terms.slice(0,active+1).reduce((sum,t)=>sum+t.product,0),rr=Math.floor(active/3),cc=active%3;s+=pulseRect(ix+cc*c-2,iy+rr*c-2,c,c,f)+pulseRect(kx+cc*c-2,iy+rr*c-2,c,c,f);
      s+=t(L.mobile?300:650,iy+130,'×',L.mobile?45:50,'#7861a4','middle')+t(L.mobile?650:1090,iy+130,'→',L.mobile?45:50,'#7861a4','middle');
      s+=panel(ox,iy+40,L.mobile?150:250,150,'누적 합')+t(ox+(L.mobile?75:125),iy+145,String(partial),L.mobile?48:53,'#7861a4','middle');
      s+=t(L.mobile?40:350,L.mobile?740:565,active===8?`9개를 모두 더하면 ${String(value).replace('-','−')}${value<0?' · 음수도 나와요 (다음 장에서 다뤄요)':''}`:`지금까지 ${active+1}개를 더하면 ${partial}`,L.mobile?29:23,'#34785f');if(!L.mobile)s+=h.lens(OBJECTS.find(o=>o.id==='bicycle'),45,200,250,330,'원본의 자전거 부분');
      const mx=L.mobile?700:1245,my=L.mobile?630:445,mc=L.mobile?23:20;s+=`<g data-output-map="true" data-row="${row}" data-col="${col}" data-value="${value}">${heat(output,mx,my,mc,{signed:true,highlight:{row,col,size:1}})}</g>`+h.line({x:ox+(L.mobile?75:125),y:iy+190},{x:mx+(col+.5)*mc,y:my+(row+.5)*mc},'#7861a4',2,'marker-end="url(#arrow)"');s+=t(L.mobile?mx:980,L.mobile?795:475,`출력 ${row+1}행 ${col+1}열`,L.mobile?24:22,'#7861a4');if(!L.mobile)s+=t(980,507,'이 한 칸에 저장해요',22,'#7861a4');
      const x=L.mobile?40:350,y=L.mobile?825:590,w=L.mobile?820:1100;s+=panel(x,y,w,L.mobile?300:145,`${active+1}/9 번째: ${terms[active].value} × (${terms[active].weight}) = ${terms[active].product}`);
      for(let r=0;r<3;r++){const part=terms.slice(r*3,r*3+3);s+=t(x+24,y+75+r*(L.mobile?51:30),part.map(v=>`${v.value}×(${v.weight})`).join(' + ')+` = ${part.reduce((a,t)=>a+t.product,0)}`,L.mobile?30:24);}
    }else{
      const ix=L.mobile?40:350,iy=L.mobile?355:215,c=L.mobile?47:43,ox=L.mobile?515:1120,oy=L.mobile?390:235,oc=L.mobile?55:53;
      const intro=k===0&&!state.exploring,pr=progress(),show=intro?M.choreograph(pr,false,.46,.54):1;let rest='';
      rest+=t(ix,iy-25,'밝기 입력 8×8',L.mobile?31:28)+heat(data.input,ix,iy,c,{numbers:true})+pulseRect(ix+col*c-2,iy+row*c-2,3*c,3*c,f);
      rest+=t(ox,oy-25,k===2?'출력 6×6 (8 − 3 + 1 = 6)':'출력을 담을 6×6',L.mobile?31:28)+heat(output,ox,oy,oc,{numbers:true,signed:true,limit:k===2?scan:-1})+(k===2?pulseRect(ox+col*oc-2,oy+row*oc-2,oc,oc,f,'#34785f'):'');
      const kx=L.mobile?90:800,ky=L.mobile?840:275,kc=L.mobile?62:65;rest+=t(kx,ky-27,'이동하는 3×3 필터',L.mobile?29:25)+heat(data.kernel.map(r=>r.map(v=>(v+2)*50)),kx,ky,kc);
      data.kernel.forEach((r,y)=>r.forEach((v,x)=>rest+=t(kx+(x+.5)*kc,ky+(y+.65)*kc,v,30,v<1?'#fff':'#40394f','middle')));
      if(!L.mobile){
        // Whole bicycle split into 8x8-pixel cells -> camera zooms into one cell -> its 64 numbers on the right.
        const T=BIKE_THUMB,Z=BIKE_ZOOM,A={x:540,y:150,w:430,h:430*BK.ratio},zoomE=intro?M.choreograph(pr,true,.22,.46):1,R=lerpR(A,Z,zoomE),V=viewAt(zoomE),grid=intro?M.choreograph(pr,false,.06,.16):1,sx=R.w/V.w,X=x=>R.x+(x-V.x)*sx,Y=y=>R.y+(y-V.y)*sx;
        s+=bikeView(R,V,{grid})+h.rect(X(BK.qx),Y(BK.qy),8*sx,8*sx,'none','#fff',2)+(zoomE<1?(intro&&pr>.14?pulseRect(X(BK.qx)-3,Y(BK.qy)-3,8*sx+6,8*sx+6,(pr*7)%1):''):pulseRect(X(BK.qx+col),Y(BK.qy+row),3*sx,3*sx,f));
        if(intro&&zoomE<1){const lo=1-M.choreograph(pr,false,.22,.3);s+=`<g opacity="${(grid*lo).toFixed(3)}">${t(A.x+A.w/2,A.y+A.h+36,`가로 8 × 세로 8 픽셀씩 나누면 ${BK.cells.toLocaleString()}칸`,26,'#40394f','middle')}${pr>.14?t(A.x+A.w/2,A.y+A.h+70,'그중 뒷바퀴 테두리의 한 칸을 확대해요',22,'#b25f30','middle'):''}</g>`;}
        const k2=T.w/VA.w;let z=bikeView(T,VA,{grid:0})+h.rect(T.x+(VB.x-VA.x)*k2,T.y+(VB.y-VA.y)*k2,VB.w*k2,VB.h*k2,'none','#b25f30',2.5);
        z+=h.line({x:T.x+(VB.x-VA.x)*k2,y:T.y+(VB.y+VB.h-VA.y)*k2},{x:Z.x,y:Z.y},'#b25f30',1.5,'stroke-dasharray="5 5"')+h.line({x:T.x+(VB.x+VB.w-VA.x)*k2,y:T.y+(VB.y+VB.h-VA.y)*k2},{x:Z.x+Z.w,y:Z.y},'#b25f30',1.5,'stroke-dasharray="5 5"');
        z+=h.line({x:X(BK.qx+8),y:Y(BK.qy)},{x:ix-8,y:iy},'#7861a4',2,'stroke-dasharray="6 6"')+h.line({x:X(BK.qx+8),y:Y(BK.qy+8)},{x:ix-8,y:iy+8*c},'#7861a4',2,'stroke-dasharray="6 6"');
        z+=t(Z.x,Z.y+Z.h+24,'40×48 픽셀 확대 · 흰 틀 = 8×8 칸 하나',15,'#746b80')+t(ix,iy+8*c+26,'픽셀 하나 = 숫자 하나 (0 검정 ~ 255 흰색)',17,'#746b80');
        s+=`<g opacity="${show.toFixed(3)}">${z}</g>`;
      }
      s+=`<g opacity="${show.toFixed(3)}">${rest}`;
      const x=L.mobile?340:350,y=L.mobile?845:608,w=L.mobile?520:1100;s+=panel(x,y,w,L.mobile?270:140,k===2?`${row+1}행 ${col+1}열 창 (${scan+1}/36) → 합 ${value}`:'세로 경계 필터: 왼쪽과 오른쪽 밝기 차이를 재요');if(k===2)for(let r=0;r<3;r++){const part=terms.slice(r*3,r*3+3);s+=t(x+23,y+(L.mobile?80:64)+r*(L.mobile?44:27),part.map(v=>`${v.value}×(${v.weight})`).join(' + ')+` = ${part.reduce((a,t)=>a+t.product,0)}`,L.mobile?24:22);}else s+=h.textLines(x+23,y+73,'가까운 9개 값 × 필터 → 합계 하나 · 같은 필터를 모든 위치에\n직접 정한 설명용 필터예요. 실제 YOLO는 필터 값을 학습해요.',w-46,L.mobile?28:25).svg;
      s+='</g>';
    }
    return s;
  }
  // Heartbeat ("두근두근"): two quick bumps at the start of each step, then rest. f = progress inside the step.
  function beat(f){const bump=(x,w)=>x<0||x>w?0:Math.sin(x/w*Math.PI);return bump(f,.16)+.6*bump(f-.24,.14);}
  function pulseRect(x,y,w,hh,f,color='#b25f30'){const b=beat(f),k=1+.12*b,cx=x+w/2,cy=y+hh/2;return `<g transform="translate(${cx} ${cy}) scale(${k.toFixed(4)}) translate(${-cx} ${-cy})"><rect x="${x}" y="${y}" width="${w}" height="${hh}" rx="6" fill="${color}" fill-opacity="${(.08+.22*b).toFixed(3)}" stroke="${color}" stroke-width="${(5+4*b).toFixed(2)}"/></g>`;}
  // A 2x2 block where positive and negative edges meet, so adding them as-is visibly cancels out.
  function mixedBlock(){let best=null,score=-1;for(let r=0;r<5;r++)for(let c=0;c<5;c++){const v=[output[r][c],output[r][c+1],output[r+1][c],output[r+1][c+1]],pos=v.filter(x=>x>0).reduce((a,b)=>a+b,0),neg=-v.filter(x=>x<0).reduce((a,b)=>a+b,0),sc=Math.min(pos,neg);if(sc>score){score=sc;best=v;}}return best;}
  const reluMap=M.relu(output),poolMap=pooled[0],SIZES=[448,224,112,56,28,14,7],SHRINK_OPS=['합성곱 보폭 2','최댓값 풀링','최댓값 풀링','최댓값 풀링','최댓값 풀링','합성곱 보폭 2'];
  // Current ReLU cell, pooling block and shrink step for a cue; shared with the tool panel.
  function poolState(k){
    const raw=progress(),view=state.exploring?state.visionStep:k;
    if(state.exploring)return{view,reluCell:state.reluCell-1,poolBlock:state.poolBlock-1,shrinkStep:state.shrinkStep,f:view===1?1:0};
    const a=36*M.choreograph(raw,false,.06,.86),b=9*M.choreograph(raw,false,.06,.86),c=7*M.choreograph(raw,false,.04,.8);
    // The explanation graph finishes before the final fifth of its cue, then remains readable as a completed picture.
    const explainF=Math.min(1,raw/.82);
    return{view,reluCell:view===0?Math.min(35,Math.floor(a)):35,poolBlock:view===2?Math.min(8,Math.floor(b)):8,shrinkStep:view===3?Math.min(6,Math.floor(c)):6,f:view===0?a%1:view===1?explainF:view===2?b%1:view===3?c%1:0};
  }
  function reluGrid(x,y,cell,upto){let s='';reluMap.forEach((row,r)=>row.forEach((v,c)=>{s+='<g>';const i=r*6+c,done=i<=upto,amount=Math.min(1,v/maxAbs);s+=h.rect(x+c*cell,y+r*cell,cell-2,cell-2,!done?'#f1ece6':v>0?`rgb(${245-amount*140},${237-amount*150},${250-amount*90})`:'#dcd7df',done?'#9c91a0':'#ddd3cb',2);if(done)s+=t(x+(c+.5)*cell,y+(r+.65)*cell,String(v),cell*.37,v>0?'#40394f':'#8a8293','middle');s+='</g>';}));return s;}
  function pooling(k){
    const L=layout(),st=poolState(k),m=L.mobile;let s='';
    if(st.view===0){
      const i=st.reluCell,r=Math.floor(i/6),c=i%6,v=output[r][c],out=Math.max(0,v),cell=m?62:60,ax=m?40:80,ay=m?390:215,bx=m?480:560;
      const seen=output.flat().slice(0,i+1),neg=seen.filter(x=>x<0).length,totalNeg=output.flat().filter(x=>x<0).length;
      s+=t(ax,ay-22,'합성곱 출력 6×6',m?28:25)+heat(output,ax,ay,cell,{numbers:true,signed:true})+pulseRect(ax+c*cell-2,ay+r*cell-2,cell,cell,st.f);
      s+=t(bx,ay-22,'ReLU를 거친 뒤',m?28:25)+reluGrid(bx,ay,cell,i)+pulseRect(bx+c*cell-2,ay+r*cell-2,cell,cell,st.f,'#34785f');
      if(!m)s+=t((ax+6*cell+bx)/2,ay+3*cell,'→',44,'#7861a4','middle')+t((ax+6*cell+bx)/2,ay+3*cell+34,'max(0, x)',17,'#7861a4','middle');
      // ReLU graph: everything left of 0 is flattened to 0.
      const gx=m?40:1010,gy=m?790:190,gw=m?820:530,gh=m?230:340,px=gx+40,pw=gw-70,py=gy+gh-40,ph=gh-100,X=x=>px+(Math.max(-420,Math.min(420,x))+420)/840*pw,Y=y=>py-Math.min(420,y)/420*ph;
      s+=h.cornerCard(gx,gy,gw,gh,'ReLU(x) = max(0, x)')+h.rect(px,Y(420),X(0)-px,py-Y(420),'#f5b9c933','none',0)+(m?'':t(px+8,Y(420)+24,'음수 → 0',17,'#b25f30'))+h.line({x:px,y:py},{x:px+pw,y:py},'#bfb4c6',2)+h.line({x:X(0),y:py},{x:X(0),y:Y(420)},'#bfb4c6',2)+`<polyline points="${X(-420)},${Y(0)} ${X(0)},${Y(0)} ${X(420)},${Y(420)}" fill="none" stroke="#7861a4" stroke-width="5"/>`;
      s+=h.line({x:X(v),y:py},{x:X(v),y:Y(out)},'#b25f30',2,'stroke-dasharray="5 5"')+`<circle cx="${X(v)}" cy="${Y(out)}" r="${(9+4*beat(st.f)).toFixed(2)}" fill="#b25f30" stroke="#fff" stroke-width="3"/>`+(m?'':t(X(0),py+26,'0',16,'#746b80','middle')+t(px+pw,py+26,'x',17,'#40394f','end'));
      const x=m?40:80,y=m?1040:590,w=m?820:1460;s+=panel(x,y,w,m?200:150,`${r+1}행 ${c+1}열 칸 (${i+1}/36)`);
      s+=t(x+24,y+(m?92:86),`max(0, ${v}) = ${out}`,m?40:38,v<0?'#b25f30':'#34785f')+t(x+(m?24:560),y+(m?140:86),v<0?'음수라서 0으로 바꿔요':'양수라서 그대로 둬요',m?27:27,'#40394f')+t(x+24,y+(m?175:128),`지금까지 음수 ${neg}칸 → 0 · 전체 36칸 중 음수 ${totalNeg}칸`,m?24:23,'#746b80');
    }else if(st.view===1){
      // Seeing why: the same filter on a bigger bicycle crop, drawn as pictures before and after ReLU.
      const iw=m?260:260,ih=iw*data.reluDemo.height/data.reluDemo.width,iy=m?385:200,xs=m?[40,320,600]:[80,440,800],zone={x:.38,y:.52,w:.24,h:.26};
      const pics=[['① 자전거 밝기','assets/relu-gray.png','원래 사진(밝기)'],['② 필터 결과를 그대로','assets/relu-raw.png','검은 줄 + 흰 줄이 겹쳐 돋을새김처럼 보여요.'],['③ ReLU 뒤','assets/relu-after.png','음수는 검정(0), 한 방향 경계만 하얗게 남아요.']];
      pics.forEach(([label,href,cap],j)=>{const x=xs[j];s+=t(x,iy-16,label,m?22:21,j===2?'#34785f':j===1?'#b25f30':'#40394f')+`<image href="${href}" x="${x}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="none"/>`+h.rect(x,iy,iw,ih,'none','#40394f',4)+h.textLines(x,iy+ih+(m?30:28),cap,iw,m?19:18,'#5d5568').svg;
        if(j)s+=`<rect class="beat" x="${x+zone.x*iw}" y="${iy+zone.y*ih}" width="${zone.w*iw}" height="${zone.h*ih}" rx="8" fill="none" stroke="${j===1?'#e07b39':'#7bd3a8'}" stroke-width="4"/>`;});
      if(!m)[[xs[0]+iw,'필터'],[xs[1]+iw,'ReLU']].forEach(([x,l])=>s+=h.line({x:x+18,y:iy+ih/2},{x:x+78,y:iy+ih/2},'#7861a4',3,'marker-end="url(#arrow)"')+t(x+48,iy+ih/2+30,l,16,'#7861a4','middle'));
      // Cancellation with the real numbers of the first 2x2 block.
      const raw=mixedBlock(),cut=raw.map(v=>Math.max(0,v)),sum=a=>a.reduce((x,y)=>x+y,0);
      const cx=m?40:1130,cy=m?800:190,cw=m?820:410,chh=m?270:400;s+=h.cornerCard(cx,cy,cw,chh,'그대로 더하면 지워져요');
      const mini=(vals,x,y,c)=>vals.map((v,j)=>h.rect(x+(j%2)*c,y+Math.floor(j/2)*c,c-4,c-4,v<0?'#c9dcef':v>0?'#f6d2b8':'#e4e0e6','#a99eae',6)+t(x+(j%2)*c+c/2-2,y+Math.floor(j/2)*c+c*.6,String(v),m?20:19,'#40394f','middle')).join('');
      const c=m?54:62,ay=cy+(m?60:62),bx=m?440:cx+24,by=m?cy+60:cy+235;
      s+=mini(raw,cx+24,ay,c)+t(cx+24+2*c+14,ay+c*.75,'그대로 합',m?19:19,'#746b80')+t(cx+24+2*c+14,ay+c*1.35,`= ${sum(raw)}`,m?30:30,'#b25f30')+t(cx+24,ay+2*c+(m?26:28),'경계가 있는데 없는 것처럼',m?18:18,'#b25f30');
      s+=mini(cut,bx,by,c)+t(bx+2*c+14,by+c*.75,'ReLU 뒤 합',m?19:19,'#746b80')+t(bx+2*c+14,by+c*1.35,`= ${sum(cut)}`,m?30:30,'#34785f')+t(bx,by+2*c+(m?26:28),'경계가 그대로 남아요',m?18:18,'#34785f');
      // Two affine layers still make one straight graph. ReLUs between them create bends, and three bends make a small peak.
      const x=m?40:80,y=m?1080:600,w=m?820:1460,ph=m?280:185,plotX=m?410:865,plotY=y+(m?42:34),plotW=m?425:545,plotH=m?132:88,axisY=plotY+plotH-14;
      const px=v=>plotX+18+(v+1)/2*(plotW-36),py=v=>axisY-v*(plotH-28)/2;
      s+=panel(x,y,w,ph,'왜 ReLU가 필요할까요?');
      const reason=m?'선형층만 이어도 직선\nReLU 사이에 → 꺾임\n세 ReLU → 산 모양\nv1은 Leaky ReLU':'선형층만 연속하면 결과는 직선 하나예요.\nReLU를 사이에 넣으면 꺾이고, 세 ReLU를 조합하면 작은 산도 만들어요.\nYOLO v1은 Leaky ReLU를 사용해요.';
      s+=h.textLines(x+24,y+62,reason,m?320:735,m?24:21).svg;
      // Values are the actual functions shown: linear .55x, ReLU(x), and max(0,x+1)-2max(0,x)+max(0,x-1).
      const reveal=(from,span)=>Math.max(0,Math.min(1,(st.f-from)/span)),linearIn=reveal(0,.24),reluIn=reveal(.19,.34),mountainIn=reveal(.45,.53);
      const trace=(points,col,width,amount,key)=>{const length=points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-points[i][0],p[1]-points[i][1]),0);return `<path data-curve="${key}" d="${points.map((p,i)=>`${i?'L':'M'}${p[0]},${p[1]}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${width}" stroke-dasharray="${length} ${length}" stroke-dashoffset="${((1-amount)*length).toFixed(3)}"/>`;};
      const mark=(x0,y0,label,col,amount,above=false)=>`<g opacity="${amount.toFixed(3)}"><circle cx="${x0}" cy="${y0}" r="3.5" fill="${col}"/><text x="${x0}" y="${above?y0-8:y0+(m?50:32)}" font-size="${m?19:13}" fill="${col}" text-anchor="middle">${label}</text></g>`;
      const formula=m?h.textLines(plotX+8,axisY+84,'ReLU(x+1) − 2ReLU(x)\n+ ReLU(x−1)',plotW-16,20,'#7861a4',1.2).svg:t(px(0),axisY+56,'ReLU(x+1) − 2ReLU(x) + ReLU(x−1)',14,'#7861a4','middle');
      s+=`<g data-relu-nonlinearity="true">${h.line({x:plotX+12,y:axisY},{x:plotX+plotW-12,y:axisY},'#bfb4c6',1.5)}${h.line({x:px(0),y:plotY+8},{x:px(0),y:axisY+4},'#bfb4c6',1.5)}${trace([[px(-1),py(-.55)],[px(1),py(.55)]],'#b25f30',3.5,linearIn,'linear')}${trace([[px(-1),py(0)],[px(0),py(0)],[px(1),py(1)]],'#34785f',4,reluIn,'relu')}${trace([[px(-1),py(0)],[px(0),py(1)],[px(1),py(0)]],'#7861a4',4,mountainIn,'tent')}${mark(px(-1),axisY,'−1','#746b80',mountainIn)}${mark(px(0),axisY,'0','#746b80',mountainIn)}${mark(px(1),axisY,'1','#746b80',mountainIn)}${mark(px(0),py(1),'f(0)=1','#7861a4',mountainIn,true)}<g opacity="${linearIn.toFixed(3)}">${t(plotX+16,plotY+18,'선형',m?19:15,'#b25f30')}</g><g opacity="${reluIn.toFixed(3)}">${t(px(0),plotY+18,'1 ReLU',m?19:15,'#34785f','middle')}</g><g opacity="${mountainIn.toFixed(3)}">${t(plotX+plotW-12,plotY+18,'3 ReLU 합',m?19:15,'#7861a4','end')}${formula}</g></g>`;
    }else if(st.view===2){
      const b=st.poolBlock,br=Math.floor(b/3),bc=b%3,cell=m?64:64,ax=m?40:80,ay=m?390:225,vals=[reluMap[br*2][bc*2],reluMap[br*2][bc*2+1],reluMap[br*2+1][bc*2],reluMap[br*2+1][bc*2+1]],best=Math.max(...vals),bi=vals.indexOf(best);
      s+=t(ax,ay-24,'ReLU 뒤 6×6',m?28:25)+reluGrid(ax,ay,cell,35);for(let g=1;g<3;g++)s+=h.line({x:ax+g*2*cell-1,y:ay},{x:ax+g*2*cell-1,y:ay+6*cell},'#7861a4',3)+h.line({x:ax,y:ay+g*2*cell-1},{x:ax+6*cell,y:ay+g*2*cell-1},'#7861a4',3);
      s+=pulseRect(ax+bc*2*cell-3,ay+br*2*cell-3,2*cell+2,2*cell+2,st.f);
      const zx=m?520:600,zy=m?400:250,zc=m?80:95;s+=t(zx,zy-26,'지금 묶음 2×2',m?26:24);
      vals.forEach((v,j)=>{const x=zx+(j%2)*zc,y=zy+Math.floor(j/2)*zc,win=j===bi;s+=h.rect(x,y,zc-4,zc-4,win?'#ffe29a':'#f6f1ea',win?'#b25f30':'#a99eae',8,win?'style="stroke-width:4"':'')+t(x+zc/2-2,y+zc*.6,String(v),m?30:32,'#40394f','middle');});
      s+=t(zx,zy+2*zc+44,`max(${vals.join(', ')})`,m?26:26,'#40394f')+t(zx,zy+2*zc+84,`= ${best}`,m?36:38,'#b25f30');
      const ox=m?520:1150,oy=m?715:250,oc=m?80:95;s+=t(ox,oy-26,'풀링 결과 3×3',m?26:24);
      poolMap.forEach((row,r)=>row.forEach((v,c)=>{s+='<g>';const j=r*3+c,done=j<=b,amount=Math.min(1,v/maxAbs);s+=h.rect(ox+c*oc,oy+r*oc,oc-4,oc-4,done?`rgb(${245-amount*140},${237-amount*150},${250-amount*90})`:'#f1ece6',done?'#9c91a0':'#ddd3cb',8);if(done)s+=t(ox+(c+.5)*oc-2,oy+(r+.62)*oc,String(v),m?28:30,'#40394f','middle');s+='</g>';}));
      s+=pulseRect(ox+bc*oc-3,oy+br*oc-3,oc+2,oc+2,st.f,'#34785f');
      if(!m)s+=h.line({x:ax+6*cell+12,y:ay+3*cell},{x:zx-16,y:zy+zc},'#7861a4',2,'marker-end="url(#arrow)"')+h.line({x:zx+2*zc+10,y:zy+zc},{x:ox-14,y:oy+(br+.5)*oc},'#7861a4',2,'marker-end="url(#arrow)"');
      const x=m?40:80,y=m?985:615,w=m?820:1460;s+=panel(x,y,w,m?225:125,`최댓값 풀링: 2×2 묶음 ${b+1}/9`);
      s+=h.textLines(x+24,y+72,'6×6 → 3×3: 가로·세로 절반, 칸 수 36 → 9 (4분의 1) · (6 − 2) ÷ 2 + 1 = 3\n묶음에서 가장 강한 반응만 남겨 조금 어긋난 위치에도 같은 특징을 잡아요.',w-48,m?23:22).svg;
    }else{
      const i=st.shrinkStep,n=SIZES[i],cw=m?110:150,gap=m?12:70,cx0=m?29:65,cy0=m?330:170;
      SIZES.forEach((v,j)=>{const x=cx0+j*(cw+gap),on=j===i,done=j<i;s+=(on?pulseRect(x,cy0,cw,54,st.f,'#b25f30'):'')+h.rect(x,cy0,cw,54,on?'#ffe29a':done?'#efe7f7':'#fffcf5',on?'#40394f':'#bdb0c8',12)+t(x+cw/2,cy0+36,`${v}×${v}`,m?22:24,'#40394f','middle');if(j<6&&!m)s+=h.line({x:x+cw+6,y:cy0+27},{x:x+cw+gap-8,y:cy0+27},j<i?'#7861a4':'#d4c9dd',3,'marker-end="url(#arrow)"')+t(x+cw+gap/2,cy0+80,SHRINK_OPS[j],14,j<i?'#7861a4':'#a99eae','middle');});
      const sx=m?275:90,sy=m?430:270,ss=m?350:445,u=ss/n,bike=OBJECTS.find(o=>o.id==='bicycle'),bcol=Math.floor(bike.center[0]*n),brow=Math.floor(bike.center[1]*n),IMGSRC=ASSET.display||ASSET.src;
      s+=`<image href="${IMGSRC}" x="${sx}" y="${sy}" width="${ss}" height="${ss}" preserveAspectRatio="none"/>`+h.rect(sx,sy,ss,ss,'none','#40394f',0);
      s+='<g>';if(n<=56)for(let g=1;g<n;g++)s+=h.line({x:sx+g*u,y:sy},{x:sx+g*u,y:sy+ss},'#ffffffb0',n>28?1:1.6)+h.line({x:sx,y:sy+g*u},{x:sx+ss,y:sy+g*u},'#ffffffb0',n>28?1:1.6);
      else s+=h.rect(sx+12,sy+12,ss-24,40,'#40394fc0','none',8)+t(sx+ss/2,sy+39,`${n}×${n} 칸: 너무 촘촘해 선은 생략`,m?20:18,'#fff','middle');s+='</g>';
      s+=`<g data-grid-position="true">`+h.rect(sx+bcol*u,sy+brow*u,Math.max(u,4),Math.max(u,4),'#ffe29acc','#b25f30',0)+pulseRect(sx+bcol*u,sy+brow*u,Math.max(u,4),Math.max(u,4),st.f,'#b25f30')+'</g>';
      s+=h.rect(sx+8,sy+ss-44,ss-16,36,'#40394fc0','none',8)+t(sx+ss/2,sy+ss-20,m?'노란 칸 = 중심의 담당 위치':'노란 칸 = 자전거 중심의 담당 위치',17,'#fff','middle');
      const ix=m?40:575,iy=m?810:270,iw=m?820:560,ih=m?305:445;s+=h.cornerCard(ix,iy,iw,ih,`지금 ${n} × ${n} 칸`);
      const rows=[[`칸 수: ${(n*n).toLocaleString()}개`,'#40394f'],[`출력 위치 간격: ${448/n}px`,'#b25f30'],[i===0?'448 그대로 시작':`448 ÷ ${2**i} = ${n}  (2로 ${i}번)`,'#7861a4'],['축소 예제: 3×3 → 4×4 → 8×8로 보는 범위 확대','#746b80'],[i===6?'v1 마지막은 7×7 전체 특징을 함께 결합해요.':'뒤 층일수록 앞 층의 더 넓은 입력을 참고해요.','#34785f']];
      let rowY=iy+(m?78:92);rows.forEach(([text,color],j)=>{const line=h.textLines(ix+24,rowY,text,iw-48,m?(j<3?28:23):j<3?30:24,color);s+=line.svg;rowY+=line.height+(m?12:14);});
      // This is deliberately a toy 8x8 input diagram, not a claimed YOLO-v1 receptive-field measurement.
      const toyRanges=(tx,ty,cell,gap)=>{const fields=[3,4,8],offsets=[2,2,0],grid=8*cell;let q='<g data-receptive-distinction="true">';fields.forEach((field,j)=>{const x=tx+j*(grid+gap),off=offsets[j],cx=x+4*cell,cy=ty+4*cell;q+=t(cx,ty-12,`${field}×${field}`,m?19:16,'#40394f','middle')+h.rect(x,ty,grid,grid,'#f7f2ea','#bdb0c8',5);for(let g=1;g<8;g++)q+=h.line({x:x+g*cell,y:ty},{x:x+g*cell,y:ty+grid},'#d7d0c8',1)+h.line({x,y:ty+g*cell},{x:x+grid,y:ty+g*cell},'#d7d0c8',1);q+=h.rect(x+off*cell,ty+off*cell,field*cell,field*cell,'#7bd3a82b','#34785f',3,'stroke-dasharray="5 3"')+`<circle cx="${cx}" cy="${cy}" r="${m?6:4.5}" fill="#ffe29a" stroke="#b25f30" stroke-width="3"/>`;});return q+`</g>`;};
      if(!m){s+=t(ix+24,iy+ih-24,'v1: 풀링 4번 + 보폭 2 합성곱 2번',20,'#746b80');
        const zx=1160,zy=270,zw=380;s+=h.cornerCard(zx,zy,zw,ih,'축소 예제: 위치 / 범위');
        s+=toyRanges(zx+24,zy+72,10,25);
        const legendY=zy+190;s+=`${h.rect(zx+24,legendY,16,16,'#ffe29acc','#b25f30',3)}${t(zx+50,legendY+14,'주황: 같은 출력 위치',17,'#40394f')}${h.rect(zx+24,legendY+33,16,16,'#7bd3a82b','#34785f',3,'stroke-dasharray="5 3"')}${t(zx+50,legendY+47,'민트: 그 위치가 참고한 입력 범위',17,'#40394f')}`;
        s+=h.textLines(zx+24,zy+272,'작은 입력 8×8의 축소 예제예요.\n실제 v1 마지막은 7×7 전체 특징을 FC가 함께 결합해요.\n주황 점 하나만 보고 판단한다는 뜻은 아니에요.',zw-48,17,'#5d5568').svg;
      }else{s+=h.cornerCard(40,1135,820,225,'축소 예제: 위치와 보는 범위')+toyRanges(126,1210,14,38)+t(450,1345,'주황: 같은 출력 위치 · 민트: 참고한 입력 범위',20,'#5d5568','middle');}
    }
    return s;
  }
  function forward(k){
    const L=layout(),m=L.mobile,p=M.choreograph(progress(),true,.06,.78),route=k===0?p*2:k===1?2+p:k===2?p*5:4+p,active=Math.min(5,Math.floor(route+.00001));
    const positions=m?[[40,350],[325,350],[610,350],[610,680],[325,680],[40,680]]:Array.from({length:6},(_,i)=>[40+i*260,150]);
    // How much of the 8x8 input one cell sees while the "보는 범위" cue plays: 3x3 -> 4x4 -> 8x8.
    const field=state.exploring||k!==1?8:p<.34?3:p<.67?4:8;
    const names=['사진 입력 1회','합성곱 + 활성화','크기 줄이기','다음 합성곱','공동 예측','탐지 결과'],labels=[k===1?`한 칸이 보는 범위 ${field}×${field}`:'8×8 밝기 배열','6×6 지도 2개 · 3×3 창','3×3 지도 2개 · 4×4 창','한 칸이 보는 범위','같은 특징에서 함께','설명용 출력 예시'];
    const w=m?250:220,hh=m?270:265,bike=OBJECTS.find(o=>o.id==='bicycle'),bikeColor='#8d5676';
    let s='';
    positions.forEach(([x,y],i)=>{
      s+=h.rect(x,y,w,hh,i===active?'#fff0b8':'#fffcf5',i===active?'#b25f30':'#a99eae',18)+t(x+15,y+39,`${i+1}. ${names[i]}`,m?25:21)+t(x+15,y+hh-19,labels[i],m?22:18,k===1&&!i?'#b25f30':'#746b80');
      if(i===0){const c=m?21:19,gx=x+(w-8*c)/2,gy=y+58;s+=heat(data.input,gx,gy,c);if(k===1){const o=field===8?0:2;s+=`<rect class="beat" x="${gx+o*c-3}" y="${gy+o*c-3}" width="${field*c+4}" height="${field*c+4}" rx="6" fill="#ffe29a55" stroke="#b25f30" stroke-width="5"/>`;}}
      else if(i===1||i===2){const matrices=i===1?maps.map(M.relu):pooled;matrices.forEach((mm,n)=>s+=heat(mm,x+15+n*(w/2-3),y+90,(w/2-18)/mm.length,{signed:i===1}));}
      else if(i===3){s+=t(x+w/2,y+100,'3×3 지도 2장 → 1칸',m?25:21,'#7861a4','middle')+t(x+w/2,y+168,'8×8',m?46:44,'#7861a4','middle')+t(x+w/2,y+205,'입력 전체를 봐요',m?22:19,'#746b80','middle');}
      else if(i===4){
        if(k===3){const rows=['자전거 · 예시',`cx=${bike.center[0].toFixed(4)}`,`cy=${bike.center[1].toFixed(4)}`,`w=${bike.box.w}  h=${bike.box.h}`,'점수 0.82'];rows.forEach((text,r)=>s+=t(x+18,y+82+r*31,text,m?22:21,bikeColor));}
        else s+=t(x+18,y+105,'(cx, cy, w, h)',m?29:25)+t(x+18,y+155,'종류 · 신뢰도',m?29:25);
      }else{
        s+=image({x:x+10,y:y+70,w:w-20,h:(w-20)*ASSET.height/ASSET.width});
        [OBJECTS[0],OBJECTS[1],bike].forEach(o=>s+=h.rect(x+10+o.box.x*(w-20),y+70+o.box.y*(w-20)*ASSET.height/ASSET.width,o.box.w*(w-20),o.box.h*(w-20)*ASSET.height/ASSET.width,'none',o.id==='bicycle'?bikeColor:'#ac9ac3',1,o.id==='bicycle'?'data-prediction-box="bicycle"':''));
        if(k===3)s+=t(x+w/2,y+(m?225:220),'자전거 0.82',m?21:20,bikeColor,'middle');
      }
    });
    // A single moving marker follows the causal route while avoiding card contents.
    const nodes=positions.map(([x,y],i)=>({x:x+w/2,y:m?(i<3?635:965):y+hh+30}));
    nodes.forEach((node,i)=>{const [x,y]=positions[i];s+=h.line({x:node.x,y:y+hh},node,'#bdb0c8',2);if(i<5){const points=m&&i===2?[node,{x:882,y:635},{x:882,y:965},nodes[i+1]]:[node,nodes[i+1]];for(let j=0;j<points.length-1;j++)s+=h.line(points[j],points[j+1],i<active?bikeColor:'#d4c9dd',i<active?3:2);}});
    const segment=Math.min(4,Math.floor(route)),points=m&&segment===2?[nodes[2],{x:882,y:635},{x:882,y:965},nodes[3]]:[nodes[segment],nodes[segment+1]],token=M.pathPoint(points,route>=5?1:route-segment);
    s+=`<circle data-flow-token="true" cx="${token.x}" cy="${token.y}" r="11" fill="${bikeColor}" stroke="white" stroke-width="3"><title>앞 층에서 다음 층으로 이어지는 계산 정보</title></circle>`;
    if(k===3){const [px,py]=positions[4],[rx,ry]=positions[5],target={x:rx+10+bike.center[0]*(w-20),y:ry+70+bike.center[1]*(w-20)*ASSET.height/ASSET.width};s+=h.line({x:m?px:px+w,y:py+145},target,bikeColor,2,'marker-end="url(#arrow)"');}
    // Explanation panel: as large as the stage allows, with a picture for each cue.
    const titles=['입력은 1회 · 계산은 여러 층','보는 범위가 넓어져요','실제 YOLO v1의 크기','마지막 출력의 한 칸 = 30개 숫자'];
    const px=40,py=m?990:470,pw=m?820:1520,ph=m?235:275;s+=panel(px,py,pw,ph,titles[k]);
    if(k<2)s+=t(px+pw-20,py+ph-14,'원리용 축소 예시 · 실제 YOLO는 448×448 전체 사진을 입력해요',m?17:15,'#746b80','end');
    if(m){const body=['앞 층의 출력이 다음 층의 입력이 돼요. 8×8 → 6×6 → 3×3 → 1칸','한 칸이 보는 입력: 3×3 → 4×4 → 8×8. 뒤 층일수록 넓은 범위를 봐요.','448×448×3 사진 → 합성곱 24층 → 7×7×1024 → 완전연결 2층 → 7×7×30','칸마다 30개 = 상자 2개 × (x, y, w, h, 신뢰도) + 종류 20개. 이 사진의 7종류라면 2×5+7 = 17개'];return s+h.textLines(px+24,py+78,body[k],pw-48,27).svg;}
    const gridBox=(x,y,n,c,fill='#efe7f7')=>{let g=h.rect(x,y,n*c,n*c,fill,'#7861a4',3);for(let j=1;j<n;j++)g+=h.line({x:x+j*c,y},{x:x+j*c,y:y+n*c},'#c9bcd8',1)+h.line({x,y:y+j*c},{x:x+n*c,y:y+j*c},'#c9bcd8',1);return g;};
    const arrow=(x1,x2,y,label)=>h.line({x:x1,y},{x:x2,y},'#7861a4',3,'marker-end="url(#arrow)"')+(label?t((x1+x2)/2,y-14,label,17,'#7861a4','middle'):'');
    const side=(text)=>h.textLines(px+1130,py+96,text,pw-1160,24,'#40394f').svg;
    if(k===0){
      const sizes=[[8,'8×8 입력'],[6,'6×6 지도'],[3,'3×3 지도'],[1,'1칸']],c=15,xs=[px+60,px+320,px+580,px+820],base=py+235;
      sizes.forEach(([n,l],j)=>{s+=gridBox(xs[j],base-n*c-30,n,c)+t(xs[j]+n*c/2,base,l,19,'#40394f','middle');if(j<3)s+=arrow(xs[j]+n*c+14,xs[j+1]-14,base-75,['합성곱 3×3','ReLU · 풀링 2×2','합성곱 3×3'][j]);});
      s+=side('앞 층의 출력이 다음 층의 입력이 돼요. 칸 수는 줄고, 한 칸에 담긴 정보는 늘어나요.');
    }else if(k===1){
      const c=18,cases=[[3,2,'2번째 층 한 칸 → 3×3'],[4,2,'풀링 뒤 한 칸 → 4×4'],[8,0,'다음 합성곱 한 칸 → 8×8']];
      cases.forEach(([n,o,l],j)=>{const x=px+60+j*360,y=py+62;s+=heat(data.input,x,y,c)+(n===field?`<rect class="beat" x="${x+o*c-3}" y="${y+o*c-3}" width="${n*c+4}" height="${n*c+4}" rx="5" fill="#ffe29a55" stroke="#b25f30" stroke-width="4"/>`:h.rect(x+o*c-2,y+o*c-2,n*c+2,n*c+2,'none','#b25f30',4,'stroke-dasharray="6 5"'))+t(x+4*c,y+8*c+28,l,19,n===field?'#b25f30':'#40394f','middle');});
      s+=side('뒤 층일수록 한 칸이 입력의 더 넓은 범위를 봐요. 작은 경계에서 바퀴·자전거 같은 큰 모양으로 넘어가는 이유예요.');
    }else if(k===2){
      const chips=[['448×448×3','사진 입력 1회'],['합성곱 24층','ReLU · 풀링 포함'],['7×7×1024','칸마다 특징 1024개'],['완전연결 2층','전체를 한꺼번에'],['7×7×30','예측 결과']],cw=232,gap=62;
      chips.forEach(([a,b],j)=>{const x=px+40+j*(cw+gap),y=py+80;s+=h.rect(x,y,cw,80,j===4?'#ffe29a':'#f3eefa','#40394f',14)+t(x+cw/2,y+36,a,26,'#40394f','middle')+t(x+cw/2,y+64,b,17,'#746b80','middle');if(j<4)s+=arrow(x+cw+8,x+cw+gap-8,y+40,'');});
      s+=h.textLines(px+40,py+200,'입력은 한 번, 계산은 첫 층부터 마지막 층까지 순서대로 → 이것이 "한 번의 순전파"예요. 크기는 448에서 7로 줄고, 특징 수는 3에서 1024로 늘어요.',pw-80,23,'#40394f').svg;
    }else{
      const c=40,x0=px+40,y0=py+78;
      for(let j=0;j<30;j++){const box=j<10,fill=j<5?'#d6c8ef':j<10?'#c9e6d7':'#ffe7b3';s+=h.rect(x0+j*(c+3),y0,c,52,fill,'#a99eae',6)+t(x0+j*(c+3)+c/2,y0+33,box?['x','y','w','h','c'][j%5]:String(j-9),box?18:15,'#40394f','middle');}
      const brace=(a,b,l,col)=>{const xa=x0+a*(c+3),xb=x0+b*(c+3)-3;return h.line({x:xa,y:y0+64},{x:xb,y:y0+64},col,3)+h.line({x:xa,y:y0+58},{x:xa,y:y0+70},col,3)+h.line({x:xb,y:y0+58},{x:xb,y:y0+70},col,3)+t((xa+xb)/2,y0+94,l,19,col,'middle');};
      s+=brace(0,5,'상자 1: x, y, w, h, 신뢰도','#7861a4')+brace(5,10,'상자 2','#34785f')+brace(10,30,'종류 확률 20개 (칸마다 한 세트)','#b25f30');
      s+=h.textLines(x0,py+212,'7×7 칸마다 30개 → 7 × 7 × 30 = 1,470개 숫자를 한 번에 · 이 사진의 7종류라면 칸마다 2 × 5 + 7 = 17개',pw-80,23,'#40394f').svg;
    }
    return s;
  }
  return{rgb,convolution,convWindow,pooling,poolState,forward,focus,output,pooled,colorHint};
});
