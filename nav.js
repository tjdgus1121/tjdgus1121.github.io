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
  }

  function isSamePage(link) {
    try {
      const linkUrl = new URL(link.href, window.location.href);
      const currentUrl = new URL(window.location.href);

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
    if (event.key === 'Enter' || event.key === ' ') {
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
