import './app.js';
import { initNavUserDropdown } from './profile/nav-user-dropdown.js';
import { initNavMobileMenu } from './profile/nav-mobile-menu.js';
import { initLoginPage } from './login-page.js';

// Keep API token behavior aligned with index page.
window.API_AUTH_TOKEN = import.meta.env?.VITE_API_AUTH_TOKEN || '';

const BETA_BANNER_DISMISS_KEY = 'bouldersProfileBetaBannerDismissed';

function initBetaBanner() {
  const banner = document.getElementById('betaReleaseBanner');
  const dismissBtn = document.getElementById('betaBannerDismiss');
  if (!banner || !dismissBtn) return;

  try {
    if (localStorage.getItem(BETA_BANNER_DISMISS_KEY) === '1') {
      banner.hidden = true;
      return;
    }
  } catch {
    /* ignore */
  }

  dismissBtn.addEventListener('click', () => {
    banner.hidden = true;
    try {
      localStorage.setItem(BETA_BANNER_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initBetaBanner();
  initNavUserDropdown();
  initNavMobileMenu();
  initLoginPage();
});
