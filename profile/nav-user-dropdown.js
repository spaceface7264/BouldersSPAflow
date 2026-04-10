// Header user menu (independent of login-page init timing).
export function initNavUserDropdown() {
  const navUser = document.getElementById('navUser');
  if (!navUser) return;

  navUser.style.cursor = 'pointer';
  navUser.setAttribute('role', 'button');
  navUser.setAttribute('tabindex', '0');
  navUser.removeAttribute('aria-haspopup');
  navUser.removeAttribute('aria-expanded');

  const goToProfile = () => {
    if (typeof window.navigateToRoute === 'function') {
      window.navigateToRoute('profile');
      return;
    }
    if (typeof window.setRoute === 'function') {
      window.setRoute('profile');
      return;
    }
    window.location.hash = '#profile';
  };

  navUser.addEventListener('click', (e) => {
    e.preventDefault();
    goToProfile();
  });

  navUser.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      goToProfile();
    }
  });
}
