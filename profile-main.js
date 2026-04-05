import './styles.css';
import './profile-layout.css';
import './app.js';
import { initNavUserDropdown } from './profile/nav-user-dropdown.js';
import { initNavMobileMenu } from './profile/nav-mobile-menu.js';
import { initLoginPage } from './login-page.js';

// Keep API token behavior aligned with index page.
window.API_AUTH_TOKEN = import.meta.env?.VITE_API_AUTH_TOKEN || '';

document.addEventListener('DOMContentLoaded', () => {
  initNavUserDropdown();
  initNavMobileMenu();
  initLoginPage();
});
