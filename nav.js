document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');

  // 사이드바를 사용하지 않는 페이지에서도 nav.js 때문에 오류가 나지 않게 한다.
  if (!toggle || !sidebar) {
    return;
  }

  const links = [...sidebar.querySelectorAll('nav a[href]')];

  function setSidebarOpen(isOpen) {
    toggle.classList.toggle('open', isOpen);
    sidebar.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? '메뉴 닫기' : '메뉴 열기');
    sidebar.inert = !isOpen;
    sidebar.setAttribute('aria-hidden', String(!isOpen));
  }

  function isSamePage(link) {
    try {
      const linkUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);
      // activity3 부속 활동(탐구·색 섞기·색감 게임·색 맞추기·퍼스널컬러)에서는 입구인 RGB 데이터 탐구 메뉴를 강조한다.
      currentUrl.pathname = currentUrl.pathname.replace(
        /activity3_(?:rgb_explore|color_mix_relay|color_sense|color_sprint|rgb_sensitivity[23]?|rgb_guess|Rgb_personal)\.html$/,
        'activity3_rgb_hub.html'
      );
      // 커널 필터 체험 원래 활동에서는 입구인 kernel_filter 카드 메뉴를 강조한다.
      currentUrl.pathname = currentUrl.pathname.replace(/activity17_kernel\.html$/, 'kernel_filter/index.html');
      currentUrl.pathname = currentUrl.pathname.replace(/activity11_similarity_check\.html$/, 'hamming_motion/index.html');

      return (
        decodeURIComponent(linkUrl.pathname).replace(/\/+$/, '') ===
          decodeURIComponent(currentUrl.pathname).replace(/\/+$/, '') &&
        linkUrl.origin === currentUrl.origin
      );
    } catch {
      return false;
    }
  }

  // 각 HTML에서 active 표시가 누락되어도 현재 페이지를 자동으로 강조한다.
  const currentLink = links.find(isSamePage);
  if (currentLink) {
    links.forEach((link) => {
      link.classList.toggle('active', link === currentLink);

      if (link === currentLink) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  setSidebarOpen(false);

  toggle.addEventListener('click', () => {
    setSidebarOpen(!sidebar.classList.contains('open'));
  });

  toggle.addEventListener('keydown', (event) => {
    // 실제 button은 브라우저가 click을 발생시키므로 중복으로 토글하지 않는다.
    if (toggle.tagName !== 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      setSidebarOpen(!sidebar.classList.contains('open'));
    }
  });

  links.forEach((link) => {
    link.addEventListener('click', () => setSidebarOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) {
      setSidebarOpen(false);
      toggle.focus();
    }
  });

  document.addEventListener('click', (event) => {
    if (
      sidebar.classList.contains('open') &&
      !sidebar.contains(event.target) &&
      !toggle.contains(event.target)
    ) {
      setSidebarOpen(false);
    }
  });
});
