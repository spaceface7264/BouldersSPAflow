// Header user menu (independent of login-page init timing).
export function initNavUserDropdown() {
  const navUser = document.getElementById('navUser');
  const userDropdown = document.getElementById('userDropdown');
  const setDropdownOpen = (isOpen) => {
    if (!navUser || !userDropdown) return;
    userDropdown.style.display = isOpen ? 'block' : 'none';
    navUser.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  if (!navUser || !userDropdown) return;

  navUser.style.cursor = 'pointer';
  navUser.setAttribute('role', 'button');
  navUser.setAttribute('tabindex', '0');
  navUser.setAttribute('aria-haspopup', 'menu');
  navUser.setAttribute('aria-expanded', 'false');
  userDropdown.setAttribute('role', 'menu');
  setDropdownOpen(false);

  const toggleDropdown = () => {
    const isOpen = userDropdown.style.display === 'block';
    setDropdownOpen(!isOpen);
  };

  navUser.addEventListener('click', (e) => {
    // Dropdown is inside navUser; let clicks on menu items bubble to their handlers.
    if (userDropdown.contains(e.target)) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  navUser.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleDropdown();
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  });

  document.addEventListener('click', (e) => {
    if (!navUser.contains(e.target) && !userDropdown.contains(e.target)) {
      setDropdownOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  });
}
