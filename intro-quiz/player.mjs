let api;
export function youtubeAPI() {
  if(window.YT?.Player) return Promise.resolve(window.YT);
  if(!api) api=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('유튜브에 연결하지 못했어요. 네트워크를 확인하고 새로고침해 주세요.')),15000);
    window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);resolve(window.YT);};
    const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{clearTimeout(timer);reject(Error('유튜브 스크립트를 불러오지 못했어요.'));};
    document.head.append(script);
  });
  return api;
}
export async function createPlayer(element,events={}) {
  const YT=await youtubeAPI();
  return new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error('플레이어 준비 시간이 초과됐어요. 새로고침 후 다시 시도하세요.')),15000);
    new YT.Player(element,{width:'100%',height:'200',playerVars:{playsinline:1,origin:location.origin,rel:0},events:{
      ...events,onReady:e=>{clearTimeout(timeout);resolve(e.target);},
      onError:e=>{events.onError?.(e);}
    }});
  });
}
export function playerError(code) {
  return ({2:'영상 주소를 확인해 주세요.',5:'브라우저에서 이 영상을 재생하지 못했어요.',100:'영상이 삭제되었거나 비공개입니다.',101:'이 영상은 외부 재생이 제한되어 있어요. 다른 영상으로 변경해 주세요.',150:'이 영상은 외부 재생이 제한되어 있어요. 다른 영상으로 변경해 주세요.',153:'유튜브가 사이트 정보를 확인하지 못했어요. HTTP 주소로 열고 브라우저의 리퍼러 차단 설정을 확인하세요.'})[code]||'유튜브 재생에 실패했어요. 다른 영상을 선택해 주세요.';
}
