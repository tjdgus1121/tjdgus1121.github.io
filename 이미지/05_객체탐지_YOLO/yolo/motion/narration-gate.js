(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.YoloNarrationGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function create(options={}){
    const synth=options.synth;
    const Utterance=options.Utterance;
    const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
    const onError=typeof options.onError==='function'?options.onError:()=>{};
    const setTimer=options.setTimeout||setTimeout;
    const clearTimer=options.clearTimeout||clearTimeout;
    const watchdogMs=Number.isFinite(options.watchdogMs)?options.watchdogMs:45000;
    let generation=0,current=null,lastCompleted=null;
    const signature=(key,text)=>`${String(key)}\u0000${String(text)}`;

    function publish(reason){onChange({pending:!!current,key:current?.key??null,reason});}
    function clearCurrent(reason){
      if(!current)return;
      if(current.timer!==null)clearTimer(current.timer);
      current=null;publish(reason);
    }
    function report(error){try{onError(error);}catch{}}
    function supported(){return !!(synth&&typeof synth.speak==='function'&&Utterance);}
    function settle(token,reason,error){
      if(!current||current.token!==token)return;
      const completed=signature(current.key,current.text);
      if(reason==='end')lastCompleted=completed;
      clearCurrent(reason);
      if(error)report(error);
    }
    function selectKoreanVoice(){
      if(!synth||typeof synth.getVoices!=='function')return null;
      try{return synth.getVoices().find(v=>String(v.lang||'').toLowerCase().startsWith('ko'))||null;}catch{return null;}
    }

    function speak(key,text,rate=1){
      const body=String(text||'');
      const wanted=signature(key,body),safeRate=Number.isFinite(Number(rate))?Number(rate):1;
      if(!body)return false;
      if(current&&current.key===key&&current.text===body){
        // A changed speed restarts only an unfinished line; a finished line never repeats.
        if(current.rate===safeRate)return false;
        cancel();
      }else if(!current&&lastCompleted===wanted){return false;}
      if(!supported()){
        publish('unsupported');
        report(new Error('Speech synthesis is not supported'));
        return false;
      }
      if(current)cancel();
      const token=++generation;
      let utterance;
      try{utterance=new Utterance(body);}catch(error){report(error);return false;}
      utterance.lang='ko-KR';utterance.rate=safeRate;
      const voice=selectKoreanVoice();if(voice)utterance.voice=voice;
      current={key,text:body,rate:safeRate,token,utterance,timer:null};
      utterance.onend=()=>settle(token,'end');
      utterance.onerror=event=>{
        const reason=String(event?.error||'speech error').toLowerCase();
        if(reason==='canceled'||reason==='cancelled'||reason==='interrupted')settle(token,'cancelled');
        else settle(token,'error',new Error(`Speech synthesis failed: ${reason}`));
      };
      if(watchdogMs>0)current.timer=setTimer(()=>{
        if(!current||current.token!==token)return;
        try{if(typeof synth.cancel==='function')synth.cancel();}catch{}
        settle(token,'watchdog',new Error('Speech synthesis timed out'));
      },watchdogMs);
      publish('start');
      try{synth.speak(utterance);}catch(error){settle(token,'error',error);return false;}
      return true;
    }
    function cancel(){
      generation++;
      if(!current)return false;
      const old=current;
      if(old.timer!==null)clearTimer(old.timer);
      current=null;publish('cancelled');
      try{if(synth&&typeof synth.cancel==='function')synth.cancel();}catch{}
      return true;
    }
    function isPending(key){return !!current&&current.key===key;}
    function currentKey(){return current?.key??null;}
    return{ speak,isPending,cancel,currentKey };
  }
  return{create};
});
