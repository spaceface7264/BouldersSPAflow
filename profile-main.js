import './styles.css';
import './profile-layout.css';
import './app.js';
import { initLoginPage } from './login-page.js';

// Keep API token behavior aligned with index page.
window.API_AUTH_TOKEN = import.meta.env?.VITE_API_AUTH_TOKEN || '';

document.addEventListener('DOMContentLoaded', () => {
  const navUser = document.getElementById('navUser');
  const userDropdown = document.getElementById('userDropdown');
  const setDropdownOpen = (isOpen) => {
    if (!navUser || !userDropdown) return;
    userDropdown.style.display = isOpen ? 'block' : 'none';
    navUser.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  };

  // Fallback dropdown wiring (independent from login-page init flow).
  if (navUser && userDropdown) {
    navUser.style.cursor = 'pointer';
    navUser.setAttribute('aria-haspopup', 'menu');
    navUser.setAttribute('aria-expanded', 'false');
    userDropdown.setAttribute('role', 'menu');
    setDropdownOpen(false);

    navUser.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = userDropdown.style.display === 'block';
      setDropdownOpen(!isOpen);
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

  initLoginPage();

  // Give app.js a moment to expose navigation helpers.
  setTimeout(() => {
    if (typeof window.initNavigation === 'function') {
      window.initNavigation();
    }
  }, 100);
});
