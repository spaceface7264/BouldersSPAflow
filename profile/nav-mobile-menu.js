/* Hamburger nav: sm band and below (matches --bp-sm-max) */
const MOBILE_NAV_MQ = '(max-width: 767px)';

export function initNavMobileMenu() {
  const header = document.getElementById('mainNavigation');
  const toggle = document.getElementById('navMenuToggle');
  const nav = document.getElementById('primaryNav');
  const backdrop = document.getElementById('navMobileBackdrop');
  if (!header || !toggle || !nav) return;

  const mq = window.matchMedia(MOBILE_NAV_MQ);

  const setOpen = (open) => {
    if (!mq.matches) {
      header.classList.remove('nav-mobile-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open menu');
      if (backdrop) {
        backdrop.hidden = true;
        backdrop.setAttribute('aria-hidden', 'true');
      }
      nav.removeAttribute('aria-hidden');
      nav.removeAttribute('inert');
      document.body.style.overflow = '';
      return;
    }
    // Hide backdrop before removing .nav-mobile-open so author CSS cannot leave it visible.
    if (backdrop && !open) {
      backdrop.hidden = true;
      backdrop.setAttribute('aria-hidden', 'true');
    }
    header.classList.toggle('nav-mobile-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (backdrop && open) {
      backdrop.hidden = false;
      backdrop.setAttribute('aria-hidden', 'false');
    }
    nav.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      nav.removeAttribute('inert');
    } else {
      nav.setAttribute('inert', '');
    }
    document.body.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains('nav-mobile-open'));
  });

  if (backdrop) {
    backdrop.addEventListener('click', () => setOpen(false));
  }

  nav.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.querySelector('.nav-logo-link')?.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('nav-mobile-open')) {
      setOpen(false);
    }
  });

  mq.addEventListener('change', () => setOpen(false));

  setOpen(false);
}
