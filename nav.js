document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.sidebar-toggle');
    const sidebar = document.querySelector('.sidebar');
    const links = sidebar.querySelectorAll('nav a');
  
    function toggleSidebar() {
      toggle.classList.toggle('open');
      sidebar.classList.toggle('open');
    }
  
    // 클릭으로 열고 닫기
    toggle.addEventListener('click', toggleSidebar);
  
    // 키보드(Enter, Space)로도 토글
    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });
  
    // 사이드바 내 링크 클릭 시 자동 닫기
    links.forEach((link) => {
      link.addEventListener('click', () => {
        toggle.classList.remove('open');
        sidebar.classList.remove('open');
      });
    });
  });
  