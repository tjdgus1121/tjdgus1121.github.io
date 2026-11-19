(() => {
  'use strict';
  const status = document.getElementById('rankingConnection');
  const message = document.getElementById('rankingMessage');
  if (location.protocol === 'file:') {
    status.textContent = '사이트에서 연결';
    message.textContent = '게임은 바로 플레이할 수 있어요. 온라인 랭킹은 사이트 주소로 열어주세요.';
    return;
  }
  import('./rgb-sensitivity-online.js').catch(() => {
    status.dataset.state = 'error';
    status.textContent = '연결 실패';
    message.textContent = '랭킹 화면을 불러오지 못했어요. 새로고침 후 다시 확인해 주세요.';
  });
})();
