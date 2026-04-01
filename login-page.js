// Login page specific initialization and functionality

export function initLoginPage() {
  // Cache DOM elements
  const DOM = {
    loginStatusPage: document.querySelector('[data-login-status]'),
    loginStatusNamePage: document.querySelector('[data-auth-name-page]'),
    loginStatusEmailPage: document.querySelector('[data-auth-email-page]'),
    loginStatusDobPage: document.querySelector('[data-auth-dob-page]'),
    loginStatusAddressPage: document.querySelector('[data-auth-address-page]'),
    loginStatusPhonePage: document.querySelector('[data-auth-phone-page]'),
    loginFormContainerPage: document.querySelector('[data-login-form-container-page]'),
    loginPageForm: document.getElementById('loginPageForm'),
    profileEditSection: document.getElementById('profileEditSection'),
    profileEditForm: document.getElementById('profileEditForm'),
    forgotPasswordModal: document.getElementById('forgotPasswordModal'),
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    forgotPasswordEmail: document.getElementById('forgotPasswordEmail'),
    forgotPasswordSuccess: document.getElementById('forgotPasswordSuccess'),
  };

  // Wait for app.js to be loaded and state to be available
  const checkAppReady = setInterval(() => {
    if (typeof window.state !== 'undefined' && typeof window.authAPI !== 'undefined') {
      clearInterval(checkAppReady);
      initializeLoginPage(DOM);
      // Initialize navigation
      if (typeof window.initNavigation === 'function') {
        window.initNavigation();
      }
    }
  }, 100);

  // Timeout after 5 seconds
  setTimeout(() => {
    clearInterval(checkAppReady);
    if (typeof window.state === 'undefined' || typeof window.authAPI === 'undefined') {
      console.error('[Login Page] App.js not loaded properly');
    }
  }, 5000);
}

function initializeLoginPage(DOM) {
  const state = window.state;
  const authAPI = window.authAPI;
  const refreshLoginUI = window.refreshLoginUI || (() => {});
  const handleLogout = window.handleLogout || (() => {});
  const showToast = window.showToast || ((msg, type) => console.log(`[Toast ${type}]:`, msg));
  const getErrorMessage = window.getErrorMessage || ((error) => error?.message || 'An error occurred');
  const isUserAuthenticated = window.isUserAuthenticated || (() => false);
  const getTokenMetadata = window.getTokenMetadata || (() => null);
  const syncAuthenticatedCustomerState = window.syncAuthenticatedCustomerState || (async () => {});
  const getUserDisplayName = window.getUserDisplayName || (() => '');

  const PAGE_ROUTES = ['dashboard', 'classes', 'activity', 'profile', 'settings'];
  const PAGE_ROUTE_MAP = {
    dashboard: 'pageDashboard',
    classes: 'pageClasses',
    activity: 'pageActivity',
    profile: 'pageProfile',
    settings: 'pageSettings'
  };

  function getBestCustomerData() {
    return state?.authenticatedCustomer || null;
  }

  const DASHBOARD_WELCOME_SEEN_KEY = 'boulders.dashboardWelcomeSeen.v1';

  function getDashboardAccountKey() {
    const customer = getBestCustomerData();
    const meta = getTokenMetadata() || {};
    const email = (state?.authenticatedEmail || customer?.email || meta?.email || '')
      .trim()
      .toLowerCase();
    if (email) return email;
    return String(
      customer?.id ||
        customer?.customerNumber ||
        state?.customerId ||
        meta?.username ||
        ''
    ).trim();
  }

  function readDashboardSeenMap() {
    try {
      const raw = localStorage.getItem(DASHBOARD_WELCOME_SEEN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function hasSeenDashboardWelcome() {
    const key = getDashboardAccountKey();
    if (!key) return false;
    return readDashboardSeenMap()[key] === true;
  }

  function markDashboardWelcomeSeen() {
    const key = getDashboardAccountKey();
    if (!key) return;
    try {
      const map = readDashboardSeenMap();
      map[key] = true;
      localStorage.setItem(DASHBOARD_WELCOME_SEEN_KEY, JSON.stringify(map));
    } catch {
      // ignore quota / private mode
    }
  }

  function updateDashboardWelcomeMessage() {
    const titleEl = document.getElementById('dashboardWelcomeTitle');
    if (!titleEl) return;

    const accountKey = getDashboardAccountKey();
    const customer = getBestCustomerData();
    const meta = getTokenMetadata() || {};
    const firstName =
      customer?.firstName && String(customer.firstName).trim() && customer.firstName !== '-'
        ? String(customer.firstName).trim()
        : '';
    const lastName =
      customer?.lastName && String(customer.lastName).trim() && customer.lastName !== '-'
        ? String(customer.lastName).trim()
        : '';
    const fullName = [firstName, lastName].filter(Boolean).join(' ');
    const fromUsername = meta?.username ? String(meta.username).split(/[\s@._-]+/)[0] : '';
    const fromEmailLocal = state?.authenticatedEmail
      ? state.authenticatedEmail.split('@')[0]
      : meta?.email
        ? String(meta.email).split('@')[0]
        : '';
    const displayName = firstName || fullName || fromUsername || fromEmailLocal || 'there';

    if (!accountKey) {
      titleEl.textContent =
        displayName && displayName !== 'there' ? `Welcome, ${displayName}! 👋` : 'Welcome! 👋';
      return;
    }

    if (!hasSeenDashboardWelcome()) {
      titleEl.textContent = `Welcome, ${displayName}! 👋`;
      markDashboardWelcomeSeen();
    } else {
      titleEl.textContent = 'Welcome back! 👋';
    }
  }

  function subscriptionSearchText(sub) {
    if (!sub || typeof sub !== 'object') return '';
    const parts = [
      sub.name,
      sub.productName,
      sub.subscriptionProduct?.name,
      sub.type,
      sub.subscriptionType,
      sub.planName,
      sub.membershipType,
      sub.description,
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return parts.join(' ');
  }

  function subscriptionIsTerminated(sub) {
    if (!sub?.statuses || !Array.isArray(sub.statuses)) return false;
    return sub.statuses.some((st) => st && st.code === 'TERMINATED');
  }

  function collectSubscriptionsArray(customer) {
    if (!customer) return [];
    const list = [];
    const push = (x) => {
      if (x && typeof x === 'object' && !list.includes(x)) list.push(x);
    };
    push(customer.activeSubscription);
    if (Array.isArray(customer.subscriptions)) customer.subscriptions.forEach(push);
    if (Array.isArray(customer.memberships)) customer.memberships.forEach(push);
    push(customer.membership);
    return list;
  }

  /** BRP value cards and similar (signup add-ons, punch-style products). */
  function collectValueCardsArray(customer) {
    if (!customer) return [];
    const raw = []
      .concat(customer.valueCards || [])
      .concat(customer.activeValueCards || [])
      .concat(customer.punchCards || [])
      .concat(customer.clipCards || [])
      .concat(customer.valueCardBalances || []);
    const seen = new Set();
    const out = [];
    raw.forEach((c) => {
      if (!c || typeof c !== 'object') return;
      const key = c.id != null ? `id:${c.id}` : `k:${out.length}`;
      if (seen.has(key)) return;
      seen.add(key);
      out.push(c);
    });
    return out;
  }

  function formatAddonExpiryDisplay(value) {
    if (!value) return '—';
    const str = typeof value === 'string' ? value : String(value);
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}.${m[2]}.${m[1]}`;
    return str;
  }

  function valueCardIsExpiredOrInvalid(card) {
    if (card?.isValid === false) return true;
    const v = card?.validUntil;
    if (!v || typeof v !== 'string') return false;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return false;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T23:59:59`);
    return d < new Date();
  }

  function formatValueCardRemainingLabel(card) {
    if (!card || typeof card !== 'object') return '—';
    const currency = 'DKK';
    if (card.allowNegativeUnits) {
      return 'Active (unlimited)';
    }
    if (valueCardIsExpiredOrInvalid(card)) {
      return 'Expired or inactive';
    }
    const t = String(card.type || '').toUpperCase();
    const isAmountType = t === 'AMOUT' || t === 'AMOUNT';
    if (isAmountType && card.amountLeft != null) {
      const n = Number(card.amountLeft);
      const formatted = Number.isFinite(n)
        ? new Intl.NumberFormat('da-DK', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(n)
        : String(card.amountLeft);
      return `${formatted} ${currency}`;
    }
    const units = card.unitsLeft;
    if (units != null) {
      let label = `${units} stk`;
      if (card.amountLeft != null && Number(card.amountLeft) > 0) {
        const n = Number(card.amountLeft);
        const formatted = Number.isFinite(n)
          ? new Intl.NumberFormat('da-DK', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(n)
          : String(card.amountLeft);
        label += ` (${formatted} ${currency})`;
      }
      return label;
    }
    if (card.isValid === true) return 'Active';
    return '—';
  }

  function valueCardProductRef(card) {
    if (!card) return null;
    return card.validCardProduct || card.valueCardProduct || card.product || null;
  }

  function valueCardProductId(card) {
    const p = valueCardProductRef(card);
    const raw =
      p?.id ??
      card?.validCardProductId ??
      card?.valueCardProductId ??
      card?.productId;
    if (raw == null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function valueCardProductDisplayName(card) {
    const p = valueCardProductRef(card);
    const tryName = (v) => (v != null && String(v).trim() ? String(v).trim() : '');
    let raw = tryName(p?.name) || tryName(p?.Name) || tryName(card?.name) || tryName(card?.Name);
    if (!raw && Array.isArray(card?.validForProducts)) {
      const names = card.validForProducts
        .map((x) => tryName(x?.name) || tryName(x?.Name))
        .filter(Boolean);
      if (names.length) raw = names.join(', ');
    }
    if (raw) return raw;
    const desc = tryName(p?.description) || tryName(card?.description);
    if (desc) {
      const line = desc.split(/\r?\n/)[0].trim();
      if (line) return line.length > 80 ? `${line.slice(0, 77)}…` : line;
    }
    return 'Product';
  }

  function brpAssetUrlFromReference(referenceId) {
    if (referenceId == null || referenceId === '') return null;
    const enc = encodeURIComponent(String(referenceId));
    return `https://boulders.brpsystems.com/apiserver/api/assets/${enc}`;
  }

  function resolveProductAssetImageUrl(product) {
    if (!product || typeof product !== 'object') return null;
    const assets = product.assets;
    if (!Array.isArray(assets) || assets.length === 0) return null;
    const mainAsset =
      assets.find((a) => a && (a.type === 'MAIN' || a.type === 'CENTERED')) || assets[0];
    if (!mainAsset) return null;
    let url = mainAsset.contentUrl || mainAsset.url || null;
    if (url && /^https?:\/\//i.test(url)) return url;
    if (url && url.startsWith('/')) return url;
    const ref = mainAsset.reference;
    if (!ref) return null;
    const host = window.location.hostname;
    const isDev = host === 'localhost' || host === '127.0.0.1';
    const isPages =
      host.includes('pages.dev') ||
      host.includes('join.boulders.dk') ||
      host === 'boulders.dk';
    if (isPages) return `/api-proxy?path=/api/assets/${encodeURIComponent(ref)}`;
    if (isDev) {
      return brpAssetUrlFromReference(ref) || `/api/assets/${encodeURIComponent(ref)}`;
    }
    return brpAssetUrlFromReference(ref) || `https://api-join.boulders.dk/api/assets/${encodeURIComponent(ref)}`;
  }

  function resolveGroupActivityClassImageUrl(source) {
    if (!source || typeof source !== 'object') return null;
    const fromProduct = (o) => {
      if (!o || typeof o !== 'object') return null;
      const p = o.groupActivityProduct || o.product || o.groupActivity?.product;
      return resolveProductAssetImageUrl(p);
    };
    let url = fromProduct(source);
    if (url) return url;
    url = fromProduct(source.groupActivity);
    if (url) return url;
    if (Array.isArray(source.assets) && source.assets.length) {
      return resolveProductAssetImageUrl({ assets: source.assets });
    }
    return null;
  }

  function extractGroupActivityProductId(source) {
    if (!source || typeof source !== 'object') return null;
    const p =
      source.groupActivityProduct ||
      source.groupactivityProduct ||
      source.groupActivity?.groupActivityProduct ||
      source.groupActivity?.product;
    const raw =
      p?.id ??
      source.groupActivityProductId ??
      source.groupActivity?.product?.id;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function classCardBusinessUnitId(source) {
    if (!source || typeof source !== 'object') return null;
    const raw =
      source.businessUnit?.id ??
      source.__buId ??
      getBestCustomerData()?.businessUnit?.id;
    const n = raw != null ? Number(raw) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function applyClassCardImgSrc(img, url) {
    if (!img || !url) return;
    let final = url;
    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    if (token && typeof url === 'string' && !url.startsWith('data:')) {
      try {
        const u = new URL(url, /^https?:\/\//i.test(url) ? undefined : window.location.origin);
        const path = u.pathname || '';
        if (
          path.includes('/api/assets/') ||
          path.includes('/apiserver/api/assets/') ||
          (u.hostname && /\.brpsystems\.com$/i.test(u.hostname) && path.includes('assets'))
        ) {
          if (!u.searchParams.has('access_token')) {
            u.searchParams.set('access_token', token);
            final = u.toString();
          }
        }
      } catch (_) {
        /* keep final */
      }
    }
    img.src = final;
  }

  async function fetchGroupActivityProductDetail(productId, businessUnitId, customerId) {
    if (productId == null) return null;
    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    const params = new URLSearchParams();
    if (businessUnitId != null && businessUnitId !== '') {
      params.set('businessUnit', String(businessUnitId));
    }
    if (customerId != null && customerId !== '') {
      params.set('customer', String(customerId));
    }
    const qs = params.toString() ? `?${params}` : '';
    const headers = {
      'Accept-Language': 'da-DK',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`/api/ver3/products/groupactivities/${productId}${qs}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  function createClassCardMediaEl(source, title) {
    const wrap = document.createElement('div');
    wrap.className = 'booking-item-card__media';
    const alt = (title && String(title).trim()) || '';
    const setEmpty = () => {
      wrap.classList.add('booking-item-card__media--empty');
      wrap.setAttribute('aria-hidden', 'true');
    };
    const clearEmpty = () => {
      wrap.classList.remove('booking-item-card__media--empty');
      wrap.removeAttribute('aria-hidden');
    };

    const primary = resolveGroupActivityClassImageUrl(source);
    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    const productId = extractGroupActivityProductId(source);
    const buId = classCardBusinessUnitId(source);
    const customerId = getBrpNumericCustomerId(getBestCustomerData());

    const img = document.createElement('img');
    img.className = 'booking-item-card__img';
    img.alt = alt;
    img.loading = 'lazy';
    img.decoding = 'async';

    img.addEventListener('error', () => {
      const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
      if (token && img.dataset.brpImgTokenRetry !== '1' && img.src && !img.src.startsWith('data:')) {
        try {
          const u = new URL(img.src, window.location.href);
          const path = u.pathname || '';
          if (
            (path.includes('/api/assets/') || path.includes('/apiserver/api/assets/')) &&
            !u.searchParams.has('access_token')
          ) {
            img.dataset.brpImgTokenRetry = '1';
            u.searchParams.set('access_token', token);
            img.src = u.toString();
            return;
          }
        } catch (_) {
          /* continue */
        }
      }
      if (img.dataset.brpMediaFallback === '1') {
        img.remove();
        setEmpty();
        return;
      }
      if (fallback && img.src !== fallback) {
        img.dataset.brpMediaFallback = '1';
        img.src = fallback;
        return;
      }
      img.remove();
      setEmpty();
    });

    if (primary) {
      applyClassCardImgSrc(img, primary);
      wrap.appendChild(img);
      clearEmpty();
    } else if (productId) {
      if (fallback) {
        img.src = fallback;
        wrap.appendChild(img);
      } else {
        setEmpty();
      }
      fetchGroupActivityProductDetail(productId, buId, customerId).then((detail) => {
        const u = detail && resolveProductAssetImageUrl(detail);
        if (!u || !wrap.isConnected) return;
        clearEmpty();
        if (img.parentNode !== wrap) wrap.appendChild(img);
        applyClassCardImgSrc(img, u);
      });
    } else if (fallback) {
      img.src = fallback;
      wrap.appendChild(img);
      clearEmpty();
    } else {
      setEmpty();
    }

    return wrap;
  }

  async function fetchValueCardProductDetail(productId, businessUnitId, customerId) {
    if (productId == null) return null;
    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    const params = new URLSearchParams();
    if (businessUnitId != null && businessUnitId !== '') {
      params.set('businessUnit', String(businessUnitId));
    }
    if (customerId != null && customerId !== '') {
      params.set('customer', String(customerId));
    }
    const qs = params.toString() ? `?${params}` : '';
    const headers = {
      'Accept-Language': 'da-DK',
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    try {
      const res = await fetch(`/api/ver3/products/valuecards/${productId}${qs}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  let profileValueCardLightbox = null;

  function ensureProfileValueCardLightbox() {
    if (profileValueCardLightbox) return profileValueCardLightbox;
    const root = document.createElement('div');
    root.className = 'profile-vc-lightbox';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'Product');
    root.innerHTML =
      '<div class="profile-vc-lightbox__inner">' +
      '<button type="button" class="profile-vc-lightbox__close" aria-label="Close">×</button>' +
      '<img class="profile-vc-lightbox__img" alt="" />' +
      '<p class="profile-vc-lightbox__desc"></p>' +
      '</div>';
    const close = () => {
      root.classList.remove('profile-vc-lightbox--open');
      const ret = root._returnFocus;
      if (ret && typeof ret.focus === 'function') {
        ret.focus();
      }
      root._returnFocus = null;
    };
    root.querySelector('.profile-vc-lightbox__close').addEventListener('click', (e) => {
      e.stopPropagation();
      close();
    });
    root.addEventListener('click', (e) => {
      if (e.target === root) close();
    });
    root.querySelector('.profile-vc-lightbox__inner').addEventListener('click', (e) => {
      e.stopPropagation();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && root.classList.contains('profile-vc-lightbox--open')) {
        close();
      }
    });
    document.body.appendChild(root);
    profileValueCardLightbox = root;
    return root;
  }

  function openProfileValueCardLightbox({ src, alt, description, returnFocus }) {
    const root = ensureProfileValueCardLightbox();
    const imgEl = root.querySelector('.profile-vc-lightbox__img');
    const descEl = root.querySelector('.profile-vc-lightbox__desc');
    imgEl.src = src || '';
    imgEl.alt = alt || '';
    const desc = (description && String(description).trim()) || '';
    if (desc) {
      descEl.textContent = desc;
      descEl.removeAttribute('hidden');
    } else {
      descEl.textContent = '';
      descEl.setAttribute('hidden', '');
    }
    root._returnFocus = returnFocus || null;
    root.classList.add('profile-vc-lightbox--open');
    root.querySelector('.profile-vc-lightbox__close').focus();
  }

  async function hydrateProfileAddonCardMedia(article, card) {
    const img = article.querySelector('.profile-addon-card__img');
    const titleEl = article.querySelector('.profile-addon-card__title');
    const mediaBtn = article.querySelector('.profile-addon-card__media-btn');
    const productRef = valueCardProductRef(card);
    const productId = valueCardProductId(card);
    const customerId = state?.customerId;
    let detail = null;
    if (productRef?.assets?.length) {
      detail = productRef;
    }
    if (productId != null) {
      const loaded = await fetchValueCardProductDetail(
        productId,
        card.businessUnit?.id,
        customerId
      );
      if (loaded && typeof loaded === 'object') {
        detail = loaded;
      }
    }
    const nameFromDetail = detail?.name && String(detail.name).trim();
    if (titleEl && nameFromDetail) {
      titleEl.textContent = nameFromDetail;
    }
    const url =
      resolveProductAssetImageUrl(detail) ||
      resolveProductAssetImageUrl(productRef);
    const placeholder =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    const displayName = (nameFromDetail || valueCardProductDisplayName(card) || 'Product').trim();
    const descText = (
      detail?.description ||
      productRef?.description ||
      ''
    )
      .trim()
      .replace(/\r\n/g, '\n');
    if (img) {
      img.src = url || placeholder;
      img.alt = displayName;
    }
    if (mediaBtn) {
      mediaBtn.setAttribute('aria-label', `View larger: ${displayName}`);
      const handler = (e) => {
        e.preventDefault();
        const src = img?.src || '';
        openProfileValueCardLightbox({
          src,
          alt: displayName,
          description: descText,
          returnFocus: mediaBtn,
        });
      };
      mediaBtn.addEventListener('click', handler);
      mediaBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handler(e);
        }
      });
    }
  }

  function buildAddonCardElement(card) {
    const article = document.createElement('article');
    article.className = 'profile-addon-card';
    const expired = valueCardIsExpiredOrInvalid(card);
    const titleText = valueCardProductDisplayName(card);

    const side = document.createElement('div');
    side.className = 'profile-addon-card__side';

    const mediaBtn = document.createElement('button');
    mediaBtn.type = 'button';
    mediaBtn.className = 'profile-addon-card__media-btn';

    const img = document.createElement('img');
    img.className = 'profile-addon-card__img';
    img.width = 44;
    img.height = 44;
    img.decoding = 'async';
    img.loading = 'lazy';
    if (typeof window.getProductPlaceholderImage === 'function') {
      img.src = window.getProductPlaceholderImage();
    }
    img.alt = titleText;
    mediaBtn.appendChild(img);

    side.appendChild(mediaBtn);

    const head = document.createElement('div');
    head.className = 'profile-addon-card__head';

    const title = document.createElement('h3');
    title.className = 'profile-addon-card__title';
    title.textContent = titleText;

    const badge = document.createElement('span');
    badge.className = 'profile-addon-card__badge' + (expired ? ' profile-addon-card__badge--muted' : '');
    badge.textContent = formatValueCardRemainingLabel(card);

    const meta = document.createElement('p');
    meta.className = 'profile-addon-card__meta';
    const gym = card.businessUnit?.name || '';
    const expRaw = formatAddonExpiryDisplay(card.validUntil);
    const expPart = expRaw !== '—' ? `Expires ${expRaw}` : '';
    meta.textContent = [gym, expPart].filter(Boolean).join(' • ') || '—';

    head.append(title, badge, side);
    article.append(head, meta);
    return article;
  }

  function renderValueCardsIntoList(listEl, customer) {
    if (!listEl) return 0;
    clearDashboardEl(listEl);
    const valueCards = collectValueCardsArray(customer || {});
    valueCards.forEach((vc) => {
      const el = buildAddonCardElement(vc);
      listEl.appendChild(el);
      hydrateProfileAddonCardMedia(el, vc).catch(() => {});
    });
    return valueCards.length;
  }

  function renderDashboardValueCardsSection(customer) {
    const card = document.getElementById('dashboardValueCardsCard');
    const list = document.getElementById('dashboardValueCardsList');
    if (!card || !list) return;
    const n = renderValueCardsIntoList(list, customer);
    card.style.display = n > 0 ? '' : 'none';
  }

  function isTrialLikeSub(sub) {
    if (!sub) return false;
    if (sub.trial === true || sub.isTrial === true || sub.accessType === 'trial') return true;
    const t = subscriptionSearchText(sub);
    return (
      /\bintro\b/i.test(t) ||
      /15\s*day|15\s*dage|fifteen|prøve|trial|guest pass|gæst|prøveperiode|15-dags|15 dages/i.test(t)
    );
  }

  function extractPunchCardFromCustomer(customer, subs) {
    const cards = []
      .concat(customer?.valueCards || [])
      .concat(customer?.activeValueCards || [])
      .concat(customer?.punchCards || [])
      .concat(customer?.clipCards || [])
      .concat(customer?.valueCardBalances || []);

    const fromCard = cards.find(Boolean);
    if (fromCard) {
      const entriesLeft =
        fromCard.remainingEntries ??
        fromCard.entriesLeft ??
        fromCard.clipsLeft ??
        fromCard.balance ??
        fromCard.visitsRemaining ??
        fromCard.remainingVisits;
      const exp =
        fromCard.validTo ??
        fromCard.expiryDate ??
        fromCard.expires ??
        fromCard.expiry ??
        fromCard.validUntil ??
        fromCard.validToDate;
      if (entriesLeft != null || exp) {
        return {
          entriesLeft: entriesLeft != null ? entriesLeft : null,
          expiryRaw: exp || null,
        };
      }
    }

    const subPunch = subs.find((s) => {
      const text = subscriptionSearchText(s);
      const hasCount =
        s?.remainingEntries != null ||
        s?.entriesRemaining != null ||
        s?.clipsRemaining != null ||
        s?.punchesRemaining != null;
      if (hasCount) return true;
      return /punch|klip|klippekort|value\s*card|clip|times?\s*card|gange/i.test(text);
    });
    if (!subPunch) return null;
    const entriesLeft =
      subPunch.remainingEntries ??
      subPunch.entriesRemaining ??
      subPunch.clipsRemaining ??
      subPunch.punchesRemaining ??
      subPunch.balance;
    const exp =
      subPunch.validTo ??
      subPunch.expiryDate ??
      subPunch.endDate ??
      subPunch.expires ??
      subPunch.validUntil ??
      subPunch.boundUntil;
    if (entriesLeft == null && !exp) return null;
    return { entriesLeft: entriesLeft != null ? entriesLeft : null, expiryRaw: exp || null };
  }

  function detectPrimaryAccess(customer) {
    if (!customer) return { kind: 'unknown' };
    const subs = collectSubscriptionsArray(customer);
    if (subs.some((s) => isTrialLikeSub(s))) {
      const trialSub = subs.find((s) => isTrialLikeSub(s));
      return { kind: 'trial', trialSub };
    }
    if (hasActiveMembership(customer)) return { kind: 'membership' };
    const punch = extractPunchCardFromCustomer(customer, subs);
    if (punch) return { kind: 'punch_card', punch };
    return { kind: 'unknown' };
  }

  function formatPriceDisplay(price) {
    if (price == null || price === '' || price === '-') return '—';
    if (typeof price === 'number') {
      return price % 1 === 0 ? `${price} kr.` : `${price.toFixed(2)} kr.`;
    }
    const s = String(price);
    if (/kr|€|\$|[\d.,]+\s*[^\s]+$/i.test(s)) return s;
    if (/^\d+([.,]\d+)?$/.test(s)) return `${s.replace(',', '.')} kr.`;
    return s;
  }

  function clearDashboardEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function addAccessRow(container, label, value) {
    const row = document.createElement('div');
    row.className = 'dashboard-access-row';
    const l = document.createElement('span');
    l.className = 'dashboard-access-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'dashboard-access-value';
    v.textContent = value == null || value === '' ? '—' : String(value);
    row.append(l, v);
    container.appendChild(row);
  }

  function createDashboardAccessSupportLink() {
    const a = document.createElement('a');
    a.href = 'mailto:medlem@boulders.dk';
    a.className = 'profile-action-btn-secondary dashboard-access-support-btn';
    a.textContent = 'Something wrong? Contact support';
    return a;
  }

  function renderDashboardAccessPanel(customer) {
    const leadEl = document.getElementById('dashboardAccessLead');
    const rowsEl = document.getElementById('dashboardAccessRows');
    const badgeEl = document.getElementById('dashboardAccessBadge');
    const supportSlot = document.getElementById('dashboardAccessSupportSlot');
    if (!leadEl || !rowsEl || !badgeEl) return;

    leadEl.style.display = '';
    clearDashboardEl(rowsEl);
    if (supportSlot) {
      clearDashboardEl(supportSlot);
      supportSlot.setAttribute('hidden', '');
    }
    const access = detectPrimaryAccess(customer || {});
    const membership = getMembershipData(customer || {});

    if (access.kind === 'membership') {
      badgeEl.textContent = 'Membership';
      leadEl.textContent =
        'You’re on a recurring membership. Here’s what we have on file—if anything looks off, reach out to medlem@boulders.dk.';
      addAccessRow(rowsEl, 'Member since', formatDisplayDate(membership.activeSince));
      addAccessRow(rowsEl, 'Price', formatPriceDisplay(membership.price));
      addAccessRow(rowsEl, 'Home gym / location', membership.gym);
      if (membership.boundUntil) {
        addAccessRow(rowsEl, 'Bound until', formatDisplayDate(membership.boundUntil));
      }
      addAccessRow(rowsEl, 'Plan', membership.type);
      if (supportSlot) {
        supportSlot.appendChild(createDashboardAccessSupportLink());
        supportSlot.removeAttribute('hidden');
      }
      return;
    }

    if (access.kind === 'punch_card') {
      badgeEl.textContent = 'Punch card';
      leadEl.textContent =
        'You’re using clip-based access. Each visit uses an entry until your card runs out or expires.';
      const entries =
        access.punch.entriesLeft != null && access.punch.entriesLeft !== ''
          ? String(access.punch.entriesLeft)
          : '—';
      addAccessRow(rowsEl, 'Entries left', entries);
      addAccessRow(
        rowsEl,
        'Valid until',
        access.punch.expiryRaw ? formatDisplayDate(access.punch.expiryRaw) : '—'
      );
      addAccessRow(rowsEl, 'Home gym', membership.gym !== '-' ? membership.gym : '—');
      if (supportSlot) {
        supportSlot.appendChild(createDashboardAccessSupportLink());
        supportSlot.removeAttribute('hidden');
      }
      return;
    }

    if (access.kind === 'trial') {
      badgeEl.textContent = '15-day trial';
      const t = access.trialSub || {};
      const start = t.startDate || t.activeSince || t.validFrom || t.beginDate;
      const end = t.endDate || t.expires || t.validTo || t.trialEndDate;
      leadEl.textContent =
        'Your trial gives you access for the window below. Ready to stay? You can switch to a full membership anytime.';
      addAccessRow(rowsEl, 'Active from', formatDisplayDate(start));
      addAccessRow(rowsEl, 'Active until', formatDisplayDate(end));
      addAccessRow(rowsEl, 'Plan', t.name || t.productName || membership.type || '—');
      addAccessRow(rowsEl, 'Location', membership.gym !== '-' ? membership.gym : '—');
      if (supportSlot) {
        supportSlot.appendChild(createDashboardAccessSupportLink());
        supportSlot.removeAttribute('hidden');
      }
      return;
    }

    badgeEl.textContent = 'No access found';
    leadEl.textContent = '';
    leadEl.style.display = 'none';
    if (membership.type && membership.type !== '-') {
      addAccessRow(rowsEl, 'Plan on file', membership.type);
    }
    if (membership.gym && membership.gym !== '-') {
      addAccessRow(rowsEl, 'Home gym', membership.gym);
    }

    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'dashboard-access-cta';
    const sum = document.createElement('p');
    sum.className = 'dashboard-access-empty-summary';
    sum.textContent =
      'Ready to climb with us? Pick your gym and choose a plan—it only takes a few minutes.';
    const actionsRow = document.createElement('div');
    actionsRow.className = 'dashboard-access-cta-actions';
    const signupBtn = document.createElement('a');
    signupBtn.href = './index.html';
    signupBtn.className = 'profile-action-btn dashboard-access-signup-btn';
    signupBtn.textContent = 'Get access';
    actionsRow.append(signupBtn, createDashboardAccessSupportLink());
    ctaWrap.append(sum, actionsRow);
    rowsEl.appendChild(ctaWrap);
  }

  function isBrpWaitingListBooking(b) {
    if (!b || typeof b !== 'object') return false;
    if (b.waitingListBooking != null && typeof b.waitingListBooking === 'object') return true;
    const t = b.type;
    if (typeof t === 'string') return /waiting/i.test(t);
    if (t && typeof t === 'object') {
      const inner = t.type || t.name || t.code || '';
      return String(inner).toLowerCase().includes('waiting');
    }
    return false;
  }

  function brpBookingStartMs(b) {
    const s = b?.duration?.start;
    if (typeof s !== 'string') return 0;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function brpBookingEndMs(b) {
    const s = b?.duration?.end;
    if (typeof s !== 'string') return 0;
    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function formatDateTimeDisplay(iso) {
    if (!iso) return '—';
    if (typeof iso !== 'string') return formatDisplayDate(iso);
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return formatDisplayDate(iso);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  function formatTimeShort(iso) {
    if (!iso || typeof iso !== 'string') return '';
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { timeStyle: 'short' });
  }

  function formatClassSessionWhenLine(startIso, endIso) {
    if (!startIso) return '—';
    const startMs = Date.parse(startIso);
    const endMs = endIso ? Date.parse(endIso) : NaN;
    const hasValidEnd = Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs;
    if (hasValidEnd) {
      return `${formatDateTimeDisplay(startIso)} – ${formatTimeShort(endIso)}`;
    }
    return formatDateTimeDisplay(startIso);
  }

  function formatClassSessionDurationMinutes(startIso, endIso) {
    if (!startIso || !endIso) return null;
    const a = Date.parse(startIso);
    const b = Date.parse(endIso);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
    return Math.round((b - a) / 60000);
  }

  function formatGroupActivitySlotsAvailability(slots) {
    if (!slots || typeof slots !== 'object') return '';
    const leftRaw =
      slots.leftToBookIncDropin ??
      slots.leftToBook ??
      slots.available ??
      slots.left;
    const left = leftRaw != null ? Number(leftRaw) : null;
    const totalRaw = slots.total ?? slots.totalBookable;
    const total = totalRaw != null ? Number(totalRaw) : null;
    const parts = [];
    if (left != null && Number.isFinite(left)) {
      if (left <= 0) {
        parts.push('Fully booked');
      } else if (total != null && Number.isFinite(total) && total > 0) {
        parts.push(`${left} of ${total} spots left`);
      } else if (left === 1) {
        parts.push('1 spot left');
      } else {
        parts.push(`${left} spots left`);
      }
    }
    if (slots.hasWaitingList === true) {
      const w = slots.inWaitingList;
      parts.push(
        w != null && Number.isFinite(Number(w)) ? `Waiting list: ${w}` : 'Waiting list open'
      );
    }
    return parts.join(' · ');
  }

  function formatBookingCardAvailabilityLine(b) {
    if (!b || typeof b !== 'object') return '';
    if (b.checkedIn) {
      const t = typeof b.checkedIn === 'string' ? formatDateTimeDisplay(b.checkedIn) : '';
      return t && t !== '—' ? `Checked in · ${t}` : 'Checked in';
    }
    return '';
  }

  function formatClassCardAvailabilityFromContext(ctx) {
    if (!ctx || typeof ctx !== 'object') return '';
    const slotText = ctx.slots ? formatGroupActivitySlotsAvailability(ctx.slots) : '';
    if (slotText) return slotText;
    if (ctx.booking) return formatBookingCardAvailabilityLine(ctx.booking);
    return '';
  }

  function appendClassCardDurationAvailability(main, startIso, endIso, ctx) {
    if (!main) return;
    const mins = formatClassSessionDurationMinutes(startIso, endIso);
    const avail = formatClassCardAvailabilityFromContext(ctx || {});
    if (mins == null && !avail) return;
    const sub = document.createElement('div');
    sub.className = 'booking-item-card__submeta';
    const bits = [];
    if (mins != null) bits.push(`${mins} min`);
    if (avail) bits.push(avail);
    sub.textContent = bits.join(' · ');
    main.appendChild(sub);
  }

  function isBrowseSlotsFullyBooked(slots) {
    if (!slots || typeof slots !== 'object') return false;
    const leftRaw =
      slots.leftToBookIncDropin ?? slots.leftToBook ?? slots.available ?? slots.left;
    if (leftRaw == null) return false;
    const n = Number(leftRaw);
    return Number.isFinite(n) && n <= 0;
  }

  let classCardExpandRoot = null;
  let classCardExpandEscapeBound = false;

  function closeClassCardExpand() {
    if (!classCardExpandRoot) return;
    classCardExpandRoot.classList.remove('class-card-expand--open');
    classCardExpandRoot.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('class-card-expand-open');
  }

  function ensureClassCardExpandRoot() {
    if (classCardExpandRoot) return classCardExpandRoot;
    const root = document.createElement('div');
    root.className = 'class-card-expand';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="class-card-expand__backdrop" data-class-card-expand-dismiss tabindex="-1"></div>' +
      '<div class="class-card-expand__sheet" role="dialog" aria-modal="true" aria-labelledby="classCardExpandTitle">' +
      '<button type="button" class="class-card-expand__close" data-class-card-expand-dismiss aria-label="Close">×</button>' +
      '<div class="class-card-expand__hero">' +
      '<img class="class-card-expand__hero-img" alt="" /></div>' +
      '<div class="class-card-expand__body">' +
      '<h2 id="classCardExpandTitle" class="class-card-expand__title"></h2>' +
      '<div class="class-card-expand__lines"></div>' +
      '<div class="class-card-expand__desc"></div>' +
      '<div class="class-card-expand__actions"></div>' +
      '</div></div>';
    document.body.appendChild(root);
    root.querySelectorAll('[data-class-card-expand-dismiss]').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        closeClassCardExpand();
      });
    });
    if (!classCardExpandEscapeBound) {
      classCardExpandEscapeBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (classCardExpandRoot?.classList.contains('class-card-expand--open')) {
          closeClassCardExpand();
        }
      });
    }
    classCardExpandRoot = root;
    return root;
  }

  function buildBrowseExpandLines(activity, gymSel) {
    const lines = [];
    const startA = activity.duration?.start;
    const endA = activity.duration?.end;
    lines.push(
      formatClassSessionWhenLine(
        typeof startA === 'string' ? startA : '',
        typeof endA === 'string' ? endA : null
      )
    );
    const mins = formatClassSessionDurationMinutes(
      typeof startA === 'string' ? startA : '',
      typeof endA === 'string' ? endA : null
    );
    const avail = formatGroupActivitySlotsAvailability(activity.slots);
    const extra = [mins != null ? `${mins} min` : '', avail].filter(Boolean).join(' · ');
    if (extra) lines.push(extra);
    const loc = groupActivityBrowseLocationLabel(activity, gymSel);
    if (loc) lines.push(loc);
    return lines.join('\n');
  }

  function buildBookingExpandLines(book) {
    const lines = [];
    const startIso =
      book.duration?.start ||
      book.startTime ||
      book.startDateTime ||
      book.dateTime ||
      book.scheduledStart ||
      book.date ||
      book.start;
    const endIso = book.duration?.end || book.endTime || book.endDateTime || null;
    lines.push(
      formatClassSessionWhenLine(
        typeof startIso === 'string' ? startIso : '',
        typeof endIso === 'string' ? endIso : null
      )
    );
    const mins = formatClassSessionDurationMinutes(
      typeof startIso === 'string' ? startIso : '',
      typeof endIso === 'string' ? endIso : null
    );
    const avail = formatClassCardAvailabilityFromContext({ slots: book.slots, booking: book });
    const extra = [mins != null ? `${mins} min` : '', avail].filter(Boolean).join(' · ');
    if (extra) lines.push(extra);
    const { where } = bookingDisplayLine(book);
    if (where) lines.push(where);
    return lines.join('\n');
  }

  async function runBrowseBookCommit(activity, allowWaitingList, primaryBtn) {
    const gid = activity.id;
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (gid == null || !Number.isFinite(Number(gid))) {
      showToast('Missing class id.', 'error');
      return;
    }
    if (!cid) {
      showToast('Log in to book.', 'error');
      return;
    }
    if (!authAPI || typeof authAPI.bookCustomerGroupActivity !== 'function') {
      showToast('Booking is not available.', 'error');
      return;
    }
    primaryBtn.disabled = true;
    try {
      await authAPI.bookCustomerGroupActivity(cid, {
        groupActivityId: gid,
        allowWaitingList,
      });
      showToast(
        allowWaitingList ? 'You are on the waiting list.' : 'Booked! Check My classes.',
        'success'
      );
      closeClassCardExpand();
      ensureGroupActivityBookingsLoaded().then(() => {
        refreshClassesBookingsLists();
        refreshDashboardPanels();
      });
      applyBrowseClassFilters();
    } catch (err) {
      showToast(getErrorMessage(err), 'error');
    } finally {
      primaryBtn.disabled = false;
    }
  }

  function openClassCardExpandBrowse(activity, gymSel) {
    const root = ensureClassCardExpandRoot();
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');
    const browseTitle = activity.name || 'Class';

    titleEl.textContent = browseTitle;
    linesEl.textContent = buildBrowseExpandLines(activity, gymSel);
    descEl.textContent = '';
    actionsEl.innerHTML = '';

    hero.classList.remove('class-card-expand__hero--empty');
    const primaryUrl = resolveGroupActivityClassImageUrl(activity);
    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    heroImg.alt = browseTitle;
    if (primaryUrl || fallback) {
      applyClassCardImgSrc(heroImg, primaryUrl || fallback);
      hero.classList.toggle('class-card-expand__hero--empty', !(primaryUrl || fallback));
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }

    const ext = activity.externalMessage && String(activity.externalMessage).trim();
    if (ext) {
      descEl.textContent = ext;
    } else {
      descEl.textContent = 'Loading description…';
    }
    const productId = extractGroupActivityProductId(activity);
    const buId = classCardBusinessUnitId(activity);
    const customerId = getBrpNumericCustomerId(getBestCustomerData());
    if (productId) {
      fetchGroupActivityProductDetail(productId, buId, customerId).then((detail) => {
        if (!descEl.isConnected) return;
        const pd = detail?.description && String(detail.description).trim();
        const parts = [ext, pd].filter(Boolean);
        descEl.textContent = parts.length ? parts.join('\n\n') : 'No description for this class.';
      });
    } else if (!ext) {
      descEl.textContent = 'No description for this class.';
    }

    const fully = isBrowseSlotsFullyBooked(activity.slots);
    const wl = activity.slots && activity.slots.hasWaitingList === true;

    if (!isUserAuthenticated()) {
      const hint = document.createElement('p');
      hint.className = 'class-card-expand__hint';
      hint.textContent = 'Log in to book this class.';
      actionsEl.appendChild(hint);
    } else if (fully && wl) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-action-btn class-card-expand__btn-primary';
      btn.textContent = 'Join waiting list';
      btn.addEventListener('click', () => runBrowseBookCommit(activity, true, btn));
      actionsEl.appendChild(btn);
    } else if (fully && !wl) {
      const p = document.createElement('p');
      p.className = 'class-card-expand__muted';
      p.textContent = 'This class is fully booked.';
      actionsEl.appendChild(p);
    } else {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-action-btn class-card-expand__btn-primary';
      btn.textContent = 'Book now';
      btn.addEventListener('click', () => runBrowseBookCommit(activity, false, btn));
      actionsEl.appendChild(btn);
    }

    root.classList.add('class-card-expand--open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('class-card-expand-open');
    requestAnimationFrame(() => {
      root.querySelector('.class-card-expand__close')?.focus();
    });
  }

  function openClassCardExpandBooking(book) {
    const root = ensureClassCardExpandRoot();
    const { title } = bookingDisplayLine(book);
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');

    titleEl.textContent = title;
    linesEl.textContent = buildBookingExpandLines(book);
    actionsEl.innerHTML = '';

    hero.classList.remove('class-card-expand__hero--empty');
    const primaryUrl = resolveGroupActivityClassImageUrl(book);
    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    heroImg.alt = title;
    if (primaryUrl || fallback) {
      applyClassCardImgSrc(heroImg, primaryUrl || fallback);
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }

    const bMsg =
      (book.externalMessage && String(book.externalMessage).trim()) ||
      (book.groupActivity?.externalMessage && String(book.groupActivity.externalMessage).trim()) ||
      '';
    if (bMsg) {
      descEl.textContent = bMsg;
    } else {
      descEl.textContent =
        'You have a booking for this class. Times and location are shown above.';
    }

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => closeClassCardExpand());
    actionsEl.appendChild(closeBtn);

    root.classList.add('class-card-expand--open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('class-card-expand-open');
    requestAnimationFrame(() => {
      root.querySelector('.class-card-expand__close')?.focus();
    });
  }

  function attachBrowseClassCardClick(card, activity, gymSel) {
    card.classList.add('booking-item-card--clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-haspopup', 'dialog');
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openClassCardExpandBrowse(activity, gymSel);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  }

  function attachBookingClassCardClick(card, book) {
    card.classList.add('booking-item-card--clickable');
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-haspopup', 'dialog');
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openClassCardExpandBooking(book);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open(e);
      }
    });
  }

  function extractUpcomingBookings(customer) {
    if (!customer) return [];
    const fromBrp = customer.groupActivityBookings;
    if (Array.isArray(fromBrp) && fromBrp.length) {
      const now = Date.now();
      return fromBrp.filter((b) => {
        if (!b || typeof b !== 'object') return false;
        if (isBrpWaitingListBooking(b)) return false;
        const start = brpBookingStartMs(b);
        if (start) return start >= now;
        if (b.past === true || b.isPast === true) return false;
        if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
        return true;
      });
    }
    const candidates = [
      customer.upcomingBookings,
      customer.upcomingClasses,
      customer.classBookings,
      customer.bookings,
    ];
    for (const c of candidates) {
      if (!Array.isArray(c) || !c.length) continue;
      const upcoming = c.filter((b) => {
        if (!b || typeof b !== 'object') return false;
        if (b.past === true || b.isPast === true) return false;
        if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
        return true;
      });
      return upcoming.length ? upcoming : c;
    }
    return [];
  }

  function bookingDisplayLine(b) {
    const title =
      b.groupActivity?.name ||
      b.title ||
      b.name ||
      b.className ||
      b.activityName ||
      b.groupActivityName ||
      'Class';
    const where =
      b.businessUnit?.name ||
      b.businessUnit?.displayName ||
      b.gymName ||
      b.businessUnitName ||
      '';
    return { title: String(title), where: where ? String(where) : '' };
  }

  function groupActivityBrowseLocationLabel(activity, gymSelectEl) {
    if (!activity || typeof activity !== 'object') return '';
    let gym =
      activity.businessUnit?.name ||
      activity.businessUnit?.displayName ||
      '';
    if (!gym && activity.__buId != null && gymSelectEl) {
      const opt = gymSelectEl.querySelector(`option[value="${String(activity.__buId)}"]`);
      if (opt?.textContent) gym = opt.textContent.trim();
    }
    return gym || '';
  }

  function appendLocationPillToCardMain(main, labelText) {
    if (!main || !labelText) return;
    const pills = document.createElement('div');
    pills.className = 'booking-item-card__pills';
    const pill = document.createElement('span');
    pill.className = 'booking-item-card__pill booking-item-card__pill--location';
    pill.textContent = labelText;
    pills.appendChild(pill);
    main.appendChild(pills);
  }

  let groupActivityBookingsLoadPromise = null;

  function ensureGroupActivityBookingsLoaded() {
    if (!isUserAuthenticated()) return Promise.resolve();
    if (!authAPI || typeof authAPI.listCustomerGroupActivityBookings !== 'function') {
      return Promise.resolve();
    }
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (!cid) return Promise.resolve();
    if (groupActivityBookingsLoadPromise) return groupActivityBookingsLoadPromise;
    groupActivityBookingsLoadPromise = authAPI
      .listCustomerGroupActivityBookings(cid)
      .then((list) => {
        const cur = getBestCustomerData() || {};
        state.authenticatedCustomer = {
          ...cur,
          groupActivityBookings: Array.isArray(list) ? list : [],
        };
      })
      .catch((err) => {
        console.warn('[Bookings] Could not load group activity bookings:', err);
      })
      .finally(() => {
        groupActivityBookingsLoadPromise = null;
      });
    return groupActivityBookingsLoadPromise;
  }

  function renderBookingsListInto(container, items, emptyMessage) {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      const p = document.createElement('p');
      p.className = 'bookings-empty-msg';
      p.textContent = emptyMessage || 'Nothing here yet.';
      container.appendChild(p);
      return;
    }
    items.forEach((b) => {
      const { title, where } = bookingDisplayLine(b);
      const startIso =
        b.duration?.start ||
        b.startTime ||
        b.startDateTime ||
        b.dateTime ||
        b.scheduledStart ||
        b.date ||
        b.start;
      const endIso = b.duration?.end || b.endTime || b.endDateTime || null;
      const card = document.createElement('div');
      card.className = 'booking-item-card';
      card.appendChild(createClassCardMediaEl(b, title));
      const main = document.createElement('div');
      main.className = 'booking-item-card__main';
      const h = document.createElement('strong');
      h.className = 'booking-item-card__title';
      h.textContent = title;
      const meta = document.createElement('div');
      meta.className = 'booking-item-card__meta';
      meta.textContent = formatClassSessionWhenLine(
        typeof startIso === 'string' ? startIso : '',
        typeof endIso === 'string' ? endIso : null
      );
      main.append(h, meta);
      appendClassCardDurationAvailability(
        main,
        typeof startIso === 'string' ? startIso : '',
        typeof endIso === 'string' ? endIso : null,
        { slots: b.slots, booking: b }
      );
      appendLocationPillToCardMain(main, where);
      card.appendChild(main);
      if (isBrpWaitingListBooking(b)) {
        const pos = b.waitingListBooking?.waitingListPosition;
        const badge = document.createElement('span');
        badge.className = 'booking-item-card__badge';
        badge.textContent =
          pos != null ? `Waiting list · #${pos}` : 'Waiting list';
        card.appendChild(badge);
      }
      attachBookingClassCardClick(card, b);
      container.appendChild(card);
    });
  }

  function refreshClassesBookingsLists() {
    const customer = getBestCustomerData();
    const list = Array.isArray(customer?.groupActivityBookings) ? customer.groupActivityBookings : [];
    const now = Date.now();

    const upcoming = list.filter((b) => {
      if (!b || isBrpWaitingListBooking(b)) return false;
      const start = brpBookingStartMs(b);
      return start ? start >= now : true;
    });
    upcoming.sort((a, b) => brpBookingStartMs(a) - brpBookingStartMs(b));

    const past = list.filter((b) => {
      if (!b || isBrpWaitingListBooking(b)) return false;
      const end = brpBookingEndMs(b);
      const start = brpBookingStartMs(b);
      if (end) return end < now;
      if (start) return start < now;
      return false;
    });
    past.sort((a, b) => brpBookingEndMs(b) - brpBookingEndMs(a));

    const waiting = list.filter((b) => b && isBrpWaitingListBooking(b));
    waiting.sort((a, b) => brpBookingStartMs(a) - brpBookingStartMs(b));

    renderBookingsListInto(
      document.getElementById('upcomingBookingsList'),
      upcoming,
      'No upcoming bookings.'
    );
    renderBookingsListInto(
      document.getElementById('pastBookingsList'),
      past,
      'No past bookings in the loaded period.'
    );
    renderBookingsListInto(
      document.getElementById('waitingListBookingsList'),
      waiting,
      'You are not on any waiting lists.'
    );
  }

  function refreshClassesBookingsPage() {
    ensureGroupActivityBookingsLoaded().then(() => {
      refreshClassesBookingsLists();
    });
  }

  function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  }

  function browseDateRangeFromPreset(preset) {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);
    if (preset === 'tomorrow') {
      start.setDate(start.getDate() + 1);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (preset === 'thisWeek') {
      const day = (now.getDay() + 6) % 7;
      start = startOfDay(now);
      start.setDate(start.getDate() - day);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end = endOfDay(end);
    } else if (preset === 'nextWeek') {
      const day = (now.getDay() + 6) % 7;
      start = startOfDay(now);
      start.setDate(start.getDate() - day + 7);
      end = new Date(start);
      end.setDate(end.getDate() + 6);
      end = endOfDay(end);
    } else if (preset === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      end = endOfDay(end);
    } else if (preset === 'nextMonth') {
      start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      end = endOfDay(end);
    }
    return { start: start.toISOString(), end: end.toISOString() };
  }

  function populateBrowseGymFilterOnce() {
    const sel = document.getElementById('browseGymFilter');
    if (!sel || sel.dataset.brpPopulated === '1') return;
    if (!authAPI?.listVer3BusinessUnits) return;
    authAPI
      .listVer3BusinessUnits()
      .then((units) => {
        if (!Array.isArray(units) || !units.length) return;
        const homeId = getBestCustomerData()?.businessUnit?.id;
        sel.innerHTML = '<option value="">All gyms (search each)</option>';
        units.forEach((u) => {
          const id = u.id;
          if (id == null) return;
          const opt = document.createElement('option');
          opt.value = String(id);
          opt.textContent = u.name || u.displayName || `Gym ${id}`;
          sel.appendChild(opt);
        });
        if (homeId != null) {
          sel.value = String(homeId);
        }
        sel.dataset.brpPopulated = '1';
      })
      .catch((e) => console.warn('[Browse] Business units:', e));
  }

  async function applyBrowseClassFilters() {
    const results = document.getElementById('browseResults');
    const gymSel = document.getElementById('browseGymFilter');
    const presetSel = document.getElementById('browseDateRangePreset');
    const typeSel = document.getElementById('browseTypeFilter');
    const searchEl = document.getElementById('browseSearchFilter');
    const customWrap = document.getElementById('customDateRangeContainer');
    const startIn = document.getElementById('browseDateStart');
    const endIn = document.getElementById('browseDateEnd');
    if (!results || !authAPI?.listBusinessUnitGroupActivities) return;

    let periodStart;
    let periodEnd;
    const preset = presetSel?.value || 'thisWeek';
    if (preset === 'custom' && startIn?.value && endIn?.value) {
      periodStart = startOfDay(new Date(startIn.value)).toISOString();
      periodEnd = endOfDay(new Date(endIn.value)).toISOString();
    } else {
      const r = browseDateRangeFromPreset(preset);
      periodStart = r.start;
      periodEnd = r.end;
    }

    const typeVal = typeSel?.value || '';
    if (typeVal === 'event') {
      results.innerHTML =
        '<p class="bookings-empty-msg">Events use a different schedule in BRP. Choose <strong>Classes</strong> or leave type empty.</p>';
      return;
    }

    const cid = getBrpNumericCustomerId(getBestCustomerData());
    const homeBu = getBestCustomerData()?.businessUnit?.id;
    let buIds = [];
    const gval = gymSel?.value || '';
    if (gval) {
      buIds = [parseInt(gval, 10)].filter((n) => Number.isFinite(n) && n > 0);
    } else if (authAPI.listVer3BusinessUnits) {
      try {
        const all = await authAPI.listVer3BusinessUnits();
        if (Array.isArray(all)) {
          buIds = all.map((u) => u.id).filter((id) => id != null);
        }
      } catch (_) {
        buIds = homeBu != null ? [homeBu] : [];
      }
    } else if (homeBu != null) {
      buIds = [homeBu];
    }

    if (!buIds.length) {
      results.innerHTML =
        '<p class="bookings-empty-msg">No gym selected. Choose a gym or log in with a profile that has a home gym.</p>';
      return;
    }

    const MAX_PARALLEL_GYMS = 12;
    if (buIds.length > MAX_PARALLEL_GYMS) {
      buIds = buIds.slice(0, MAX_PARALLEL_GYMS);
    }

    results.innerHTML = '<div class="bookings-loading">Loading classes…</div>';
    const q = searchEl?.value?.trim().toLowerCase() || '';

    try {
      const chunks = await Promise.all(
        buIds.map((buId) =>
          authAPI
            .listBusinessUnitGroupActivities(buId, {
              periodStart,
              periodEnd,
              customerId: cid || undefined,
            })
            .then((acts) =>
              (Array.isArray(acts) ? acts : []).map((a) => ({ ...a, __buId: buId }))
            )
            .catch(() => [])
        )
      );
      let flat = chunks.flat();
      const seen = new Set();
      flat = flat.filter((a) => {
        const id = a.id;
        if (id == null) return true;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      if (q) {
        flat = flat.filter((a) => String(a.name || '').toLowerCase().includes(q));
      }
      flat.sort((a, b) => {
        const ta = a.duration?.start ? Date.parse(a.duration.start) : 0;
        const tb = b.duration?.start ? Date.parse(b.duration.start) : 0;
        return ta - tb;
      });

      results.innerHTML = '';
      if (!flat.length) {
        results.innerHTML =
          '<p class="bookings-empty-msg">No classes match these filters.</p>';
        return;
      }
      flat.forEach((a) => {
        const card = document.createElement('div');
        card.className = 'booking-item-card booking-item-card--browse';
        const browseTitle = a.name || 'Class';
        card.appendChild(createClassCardMediaEl(a, browseTitle));
        const main = document.createElement('div');
        main.className = 'booking-item-card__main';
        const h = document.createElement('strong');
        h.className = 'booking-item-card__title';
        h.textContent = browseTitle;
        const meta = document.createElement('div');
        meta.className = 'booking-item-card__meta';
        const startA = a.duration?.start;
        const endA = a.duration?.end;
        meta.textContent = formatClassSessionWhenLine(
          typeof startA === 'string' ? startA : '',
          typeof endA === 'string' ? endA : null
        );
        main.append(h, meta);
        appendClassCardDurationAvailability(
          main,
          typeof startA === 'string' ? startA : '',
          typeof endA === 'string' ? endA : null,
          { slots: a.slots }
        );
        appendLocationPillToCardMain(main, groupActivityBrowseLocationLabel(a, gymSel));
        card.appendChild(main);
        attachBrowseClassCardClick(card, a, gymSel);
        results.appendChild(card);
      });
    } catch (err) {
      console.warn('[Browse] Classes:', err);
      results.innerHTML =
        '<p class="bookings-empty-msg">Could not load classes. Try again or pick another gym.</p>';
    }
  }

  function initBookingsBrowseControls() {
    const presetSel = document.getElementById('browseDateRangePreset');
    const customWrap = document.getElementById('customDateRangeContainer');
    const applyBtn = document.getElementById('applyFiltersBtn');
    if (presetSel && customWrap && !presetSel.dataset.browseBound) {
      presetSel.dataset.browseBound = '1';
      presetSel.addEventListener('change', () => {
        customWrap.style.display = presetSel.value === 'custom' ? 'flex' : 'none';
      });
    }
    if (applyBtn && !applyBtn.dataset.browseBound) {
      applyBtn.dataset.browseBound = '1';
      applyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        applyBrowseClassFilters();
      });
    }
  }

  function openClassesBrowseTab() {
    setRoute('classes');
    requestAnimationFrame(() => {
      document.querySelector('.booking-tab[data-tab="browse"]')?.click();
    });
  }

  function renderDashboardClassesSection(customer) {
    const wrap = document.getElementById('dashboardUpcomingClasses');
    if (!wrap) return;
    clearDashboardEl(wrap);
    const bookings = extractUpcomingBookings(customer || {});

    if (bookings.length) {
      const frag = document.createDocumentFragment();
      bookings.slice(0, 6).forEach((b) => {
        const { title, where } = bookingDisplayLine(b);
        const startIso =
          b.duration?.start ||
          b.startTime ||
          b.startDateTime ||
          b.dateTime ||
          b.scheduledStart ||
          b.date ||
          b.start;
        const endIso = b.duration?.end || b.endTime || b.endDateTime || null;
        const row = document.createElement('div');
        row.className = 'dashboard-class-booked';
        row.appendChild(createClassCardMediaEl(b, title));
        const main = document.createElement('div');
        main.className = 'dashboard-class-booked-main';
        const t = document.createElement('strong');
        t.className = 'dashboard-class-booked-title';
        t.textContent = title;
        const meta = document.createElement('div');
        meta.className = 'dashboard-class-booked-meta';
        meta.textContent = formatClassSessionWhenLine(
          typeof startIso === 'string' ? startIso : '',
          typeof endIso === 'string' ? endIso : null
        );
        main.append(t, meta);
        const sub = document.createElement('div');
        sub.className = 'booking-item-card__submeta dashboard-class-booked-submeta';
        const mins = formatClassSessionDurationMinutes(
          typeof startIso === 'string' ? startIso : '',
          typeof endIso === 'string' ? endIso : null
        );
        const avail = formatClassCardAvailabilityFromContext({ slots: b.slots, booking: b });
        if (mins != null || avail) {
          const bits = [];
          if (mins != null) bits.push(`${mins} min`);
          if (avail) bits.push(avail);
          sub.textContent = bits.join(' · ');
          main.appendChild(sub);
        }
        if (where) {
          const pills = document.createElement('div');
          pills.className = 'booking-item-card__pills';
          const pill = document.createElement('span');
          pill.className = 'booking-item-card__pill booking-item-card__pill--location';
          pill.textContent = where;
          pills.appendChild(pill);
          main.appendChild(pills);
        }
        row.append(main);
        attachBookingClassCardClick(row, b);
        frag.appendChild(row);
      });
      wrap.appendChild(frag);
      return;
    }

    const empty = document.createElement('div');
    empty.className = 'dashboard-classes-empty';
    const title = document.createElement('p');
    title.className = 'dashboard-classes-empty-title';
    title.textContent = 'No classes booked yet';
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'profile-action-btn dashboard-book-class-cta';
    cta.id = 'dashboardBookClassCTA';
    cta.textContent = 'Find a class';
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      openClassesBrowseTab();
    });
    empty.append(title, cta);
    wrap.appendChild(empty);
  }

  function normalizeLoyaltyKey(raw) {
    if (!raw) return 'default';
    const s = String(raw).toLowerCase();
    if (/bronze|tier\s*1|\blevel\s*1\b|^1$/.test(s)) return 'bronze';
    if (/silver|tier\s*2|\blevel\s*2\b|^2$/.test(s)) return 'silver';
    if (/gold|tier\s*3|\blevel\s*3\b|^3$/.test(s)) return 'gold';
    return 'default';
  }

  function renderDashboardLoyaltySection(customer) {
    const tierNameEl = document.getElementById('dashboardLoyaltyTier');
    const levelEl = document.getElementById('dashboardLoyaltyLevel');
    const benefitsEl = document.getElementById('dashboardLoyaltyBenefits');
    if (!tierNameEl || !levelEl || !benefitsEl) return;

    const tierBlock = tierNameEl.closest('.dashboard-loyalty-tier');
    const hasMember = hasActiveMembership(customer || {});

    clearDashboardEl(benefitsEl);

    if (!hasMember) {
      if (tierBlock) tierBlock.style.display = 'none';
      const wrap = document.createElement('div');
      wrap.className = 'dashboard-loyalty-no-membership';
      const msg = document.createElement('p');
      msg.className = 'dashboard-loyalty-no-membership-text';
      msg.textContent =
        'No membership found. To start your Bloc Life journey, become a member.';
      const cta = document.createElement('a');
      cta.href = './index.html';
      cta.className = 'profile-action-btn dashboard-loyalty-become-member-btn';
      cta.textContent = 'Become a member';
      wrap.append(msg, cta);
      benefitsEl.appendChild(wrap);
      return;
    }

    if (tierBlock) tierBlock.style.display = '';

    const loyalty = customer?.loyalty || {};
    const rawTier =
      customer?.loyaltyTier ||
      customer?.blocLifeTier ||
      loyalty.tierName ||
      loyalty.levelName ||
      loyalty.name ||
      '';
    const rawLevel =
      customer?.loyaltyLevel ||
      customer?.blocLifeLevel ||
      loyalty.stage ||
      loyalty.level ||
      loyalty.tierLevel ||
      '';

    const combined = String(rawTier || rawLevel || '').trim();
    const key = normalizeLoyaltyKey(combined);
    const tierLabels = {
      bronze: 'Bloc Life — Bronze',
      silver: 'Bloc Life — Silver',
      gold: 'Bloc Life — Gold',
    };

    if (combined) {
      tierNameEl.textContent =
        key !== 'default' && tierLabels[key] ? tierLabels[key] : combined;
      levelEl.textContent = '';
    } else {
      tierNameEl.textContent = '';
      levelEl.textContent = '';
      if (tierBlock) tierBlock.style.display = 'none';
    }

    if (Array.isArray(loyalty.benefits) && loyalty.benefits.length) {
      loyalty.benefits.forEach((line) => {
        const p = document.createElement('p');
        p.className = 'dashboard-loyalty-benefit-line dashboard-loyalty-benefit-line-api';
        p.textContent = String(line);
        benefitsEl.appendChild(p);
      });
    }
  }

  function refreshDashboardPanels() {
    if (!isUserAuthenticated()) return;
    ensureGroupActivityBookingsLoaded().then(() => {
      const customer = getBestCustomerData();
      renderDashboardAccessPanel(customer);
      renderDashboardClassesSection(customer);
      renderDashboardValueCardsSection(customer);
      renderDashboardLoyaltySection(customer);
    });
  }

  function initBookingsTabSwitching() {
    const tabs = document.querySelectorAll('.booking-tab[data-tab]');
    tabs.forEach((tab) => {
      if (tab.dataset.boundBookingsTab === 'true') return;
      tab.dataset.boundBookingsTab = 'true';
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const name = tab.getAttribute('data-tab');
        tabs.forEach((t) => t.classList.toggle('active', t === tab));
        const myBook = document.getElementById('myBookingsSection');
        const browse = document.getElementById('browseClasses');
        if (myBook) {
          myBook.style.display = name === 'myBookings' ? 'block' : 'none';
          myBook.classList.toggle('active', name === 'myBookings');
        }
        if (browse) {
          browse.style.display = name === 'browse' ? 'block' : 'none';
          browse.classList.toggle('active', name === 'browse');
        }
        if (name === 'browse') {
          initBookingsBrowseControls();
          populateBrowseGymFilterOnce();
          applyBrowseClassFilters();
        }
      });
    });

    const subTabs = document.querySelectorAll('.booking-sub-tab[data-sub-tab]');
    subTabs.forEach((tab) => {
      if (tab.dataset.boundBookingsSubTab === 'true') return;
      tab.dataset.boundBookingsSubTab = 'true';
      tab.addEventListener('click', (e) => {
        e.preventDefault();
        const name = tab.getAttribute('data-sub-tab');
        subTabs.forEach((t) => t.classList.toggle('active', t === tab));
        const map = {
          upcoming: 'upcomingBookings',
          past: 'pastBookings',
          waiting: 'waitingListBookings',
        };
        Object.entries(map).forEach(([subName, id]) => {
          const el = document.getElementById(id);
          if (!el) return;
          const show = name === subName;
          el.style.display = show ? 'block' : 'none';
          el.classList.toggle('active', show);
        });
      });
    });
  }

  function setRoute(route) {
    const safeRoute = PAGE_ROUTES.includes(route) ? route : 'dashboard';

    Object.values(PAGE_ROUTE_MAP).forEach((id) => {
      const section = document.getElementById(id);
      if (!section) return;
      section.style.display = 'none';
      section.classList.remove('active');
    });

    const activeSection = document.getElementById(PAGE_ROUTE_MAP[safeRoute]);
    if (activeSection) {
      activeSection.style.display = 'block';
      activeSection.classList.add('active');
    }

    document.querySelectorAll('.nav-link[data-route]').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('data-route') === safeRoute);
    });

    if (window.location.hash !== `#${safeRoute}`) {
      window.location.hash = safeRoute;
    }

    if (safeRoute === 'dashboard') {
      updateDashboardWelcomeMessage();
      refreshDashboardPanels();
    }
    if (safeRoute === 'classes') {
      initBookingsBrowseControls();
      refreshClassesBookingsPage();
    }
    if (safeRoute === 'settings') {
      refreshSettingsPaymentMethods();
      refreshSettingsInvoices();
      syncNotificationPrivacyFromCustomer(getBestCustomerData());
    }
  }

  let notificationPrivacySaving = false;

  function syncNotificationPrivacyFromCustomer(customer) {
    const emailCb = document.getElementById('settingsEmailMarketing');
    const smsCb = document.getElementById('settingsSmsMarketing');
    const mailCb = document.getElementById('settingsMailMarketing');
    if (!emailCb || !smsCb || !mailCb) return;

    const c = customer || {};
    const canPersist =
      Boolean(isUserAuthenticated()) &&
      getBrpNumericCustomerId(c) != null &&
      authAPI &&
      typeof authAPI.updateCustomerMarketingPreferences === 'function';

    emailCb.checked = c.allowMassSendEmail === true;
    smsCb.checked = c.allowMassSendSms === true;
    mailCb.checked = c.allowMassSendMail === true;

    const locked = !canPersist || notificationPrivacySaving;
    emailCb.disabled = locked;
    smsCb.disabled = locked;
    mailCb.disabled = locked;
  }

  async function persistNotificationPrivacyFromUi() {
    const emailCb = document.getElementById('settingsEmailMarketing');
    const smsCb = document.getElementById('settingsSmsMarketing');
    const mailCb = document.getElementById('settingsMailMarketing');
    if (!emailCb || !smsCb || !mailCb) return;

    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (
      !cid ||
      !authAPI ||
      typeof authAPI.updateCustomerMarketingPreferences !== 'function' ||
      !isUserAuthenticated()
    ) {
      showToast('Unable to save preferences for this account.', 'error');
      syncNotificationPrivacyFromCustomer(getBestCustomerData());
      return;
    }

    const previous = {
      allowMassSendEmail: getBestCustomerData()?.allowMassSendEmail === true,
      allowMassSendSms: getBestCustomerData()?.allowMassSendSms === true,
      allowMassSendMail: getBestCustomerData()?.allowMassSendMail === true,
    };

    notificationPrivacySaving = true;
    syncNotificationPrivacyFromCustomer(getBestCustomerData());

    try {
      const updated = await authAPI.updateCustomerMarketingPreferences(cid, {
        allowMassSendEmail: emailCb.checked,
        allowMassSendSms: smsCb.checked,
        allowMassSendMail: mailCb.checked,
      });
      const cur = getBestCustomerData() || {};
      if (updated && typeof updated === 'object') {
        state.authenticatedCustomer = { ...cur, ...updated };
      } else {
        state.authenticatedCustomer = {
          ...cur,
          allowMassSendEmail: emailCb.checked,
          allowMassSendSms: smsCb.checked,
          allowMassSendMail: mailCb.checked,
        };
      }
      syncNotificationPrivacyFromCustomer(state.authenticatedCustomer);
    } catch (err) {
      console.warn('[Settings] Marketing preferences:', err);
      showToast(getErrorMessage(err, 'Update preferences'), 'error');
      if (state.authenticatedCustomer && typeof state.authenticatedCustomer === 'object') {
        state.authenticatedCustomer = {
          ...state.authenticatedCustomer,
          allowMassSendEmail: previous.allowMassSendEmail,
          allowMassSendSms: previous.allowMassSendSms,
          allowMassSendMail: previous.allowMassSendMail,
        };
      }
      emailCb.checked = previous.allowMassSendEmail;
      smsCb.checked = previous.allowMassSendSms;
      mailCb.checked = previous.allowMassSendMail;
      syncNotificationPrivacyFromCustomer(getBestCustomerData());
    } finally {
      notificationPrivacySaving = false;
      syncNotificationPrivacyFromCustomer(getBestCustomerData());
    }
  }

  function bindNotificationPrivacyToggles() {
    ['settingsEmailMarketing', 'settingsSmsMarketing', 'settingsMailMarketing'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el || el.dataset.marketingBound === '1') return;
      el.addEventListener('change', () => {
        persistNotificationPrivacyFromUi();
      });
      el.dataset.marketingBound = '1';
    });
  }

  const SETTINGS_PAYMENT_METHODS_SKELETON = `
        <div class="settings-loading">
            <div class="settings-skeleton-list">
                <div class="settings-skeleton-item">
                    <div class="settings-skeleton-item-content">
                        <div class="skeleton skeleton-text" style="width: 60%; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 40%;"></div>
                    </div>
                    <div class="skeleton settings-skeleton-item-action"></div>
                </div>
            </div>
        </div>`;

  function getBrpNumericCustomerId(customer) {
    const raw = customer?.id != null ? customer.id : state?.customerId;
    if (raw == null || raw === '') return null;
    const n =
      typeof raw === 'number' && Number.isFinite(raw)
        ? raw
        : parseInt(String(raw).replace(/\D/g, ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function refreshSettingsPaymentMethods() {
    const host = document.getElementById('settingsPaymentMethods');
    const registerBtn = document.getElementById('settingsRegisterCardConsentBtn');
    if (!host || !isUserAuthenticated()) return;

    const setRegisterVisible = (visible) => {
      if (!registerBtn) return;
      registerBtn.style.display = visible ? 'inline' : 'none';
    };

    if (!authAPI || typeof authAPI.listCustomerCardConsents !== 'function') {
      host.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'settings-item-description';
      p.textContent = 'Payment methods could not be loaded.';
      host.appendChild(p);
      setRegisterVisible(false);
      return;
    }

    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (!cid) {
      host.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'settings-item-description';
      p.textContent = 'Your account must use a numeric member ID to list saved cards.';
      host.appendChild(p);
      setRegisterVisible(false);
      return;
    }

    host.innerHTML = SETTINGS_PAYMENT_METHODS_SKELETON.trim();
    setRegisterVisible(false);

    authAPI
      .listCustomerCardConsents(cid)
      .then((consents) => {
        host.innerHTML = '';
        setRegisterVisible(true);

        if (!consents.length) {
          const p = document.createElement('p');
          p.className = 'settings-item-description';
          p.textContent =
            'No saved payment methods yet. Register a card for recurring membership payments.';
          host.appendChild(p);
          return;
        }

        consents.forEach((c) => {
          const item = document.createElement('div');
          item.className = 'settings-item';

          const header = document.createElement('div');
          header.className = 'settings-item-header';
          const label = document.createElement('span');
          label.className = 'settings-item-label';
          label.setAttribute('role', 'presentation');
          label.textContent = c.issuingNetwork || 'Payment card';
          const trailing = document.createElement('div');
          trailing.className = 'settings-item-trailing';
          const val = document.createElement('span');
          val.className = 'settings-item-value';
          val.textContent = c.cardNumber || '••••';
          trailing.appendChild(val);
          header.appendChild(label);
          header.appendChild(trailing);
          item.appendChild(header);

          const content = document.createElement('div');
          content.className = 'settings-item-content';
          const desc = document.createElement('p');
          desc.className = 'settings-item-description';
          const bu =
            c.businessUnit?.displayName ||
            c.businessUnit?.name ||
            (typeof c.businessUnit === 'string' ? c.businessUnit : '');
          const parts = [];
          if (bu) parts.push(bu);
          if (c.expirationDay) {
            parts.push(`Expires ${formatDisplayDate(c.expirationDay)}`);
          }
          desc.textContent =
            parts.length > 0 ? parts.join(' · ') : 'Saved for recurring payments.';
          content.appendChild(desc);
          item.appendChild(content);

          host.appendChild(item);
        });
      })
      .catch((err) => {
        console.warn('[Settings] Card consents:', err);
        host.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'settings-item-description';
        p.textContent =
          (err && err.message) || 'Could not load payment methods. Try again later.';
        host.appendChild(p);
        setRegisterVisible(true);
      });
  }

  const SETTINGS_INVOICES_SKELETON = `
        <div class="settings-loading">
            <div class="settings-skeleton-list">
                <div class="settings-skeleton-item">
                    <div class="settings-skeleton-item-content">
                        <div class="skeleton skeleton-text" style="width: 50%; margin-bottom: 8px;"></div>
                        <div class="skeleton skeleton-text" style="width: 30%;"></div>
                    </div>
                    <div class="skeleton skeleton-badge"></div>
                </div>
            </div>
        </div>`;

  function formatCurrencyOutDisplay(cur) {
    if (!cur || cur.amount == null || cur.amount === '') return '—';
    const major = Number(cur.amount) / 100;
    if (!Number.isFinite(major)) return '—';
    const ccy = String(cur.currency || '').trim();
    const num = major.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return ccy ? `${num} ${ccy}` : num;
  }

  function formatInvoiceNumberLabel(inv) {
    const pre = (inv.prefix || '').trim();
    const num = inv.number != null ? String(inv.number) : '';
    if (pre && num) return `${pre} ${num}`;
    if (num) return `Invoice ${num}`;
    if (inv.id != null) return `Invoice #${inv.id}`;
    return 'Invoice';
  }

  function humanizeInvoiceState(state) {
    const map = {
      STATE_DONE: 'Paid',
      STATE_SENT: 'Sent',
      STATE_NOT_SENT: 'Not sent',
      STATE_SENT_PENDING_RESPONSE: 'Pending',
      STATE_REMINDER: 'Reminder',
      STATE_REMINDER_SERVICE: 'Reminder',
      STATE_DEBT_COLLECTION: 'Debt collection',
      STATE_EXPORTED: 'Exported',
      STATE_PENDING_SEND: 'Pending send',
      STATE_UNKNOWN: 'Unknown',
    };
    return map[state] || (state ? String(state).replace(/^STATE_/, '').replace(/_/g, ' ') : '—');
  }

  function invoiceCreatedMs(inv) {
    const c = inv?.created;
    if (typeof c !== 'string') return 0;
    const t = Date.parse(c);
    return Number.isFinite(t) ? t : 0;
  }

  function refreshSettingsInvoices() {
    const host = document.getElementById('settingsInvoices');
    if (!host || !isUserAuthenticated()) return;

    if (!authAPI || typeof authAPI.listCustomerInvoices !== 'function') {
      host.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'settings-item-description';
      p.textContent = 'Invoices could not be loaded.';
      host.appendChild(p);
      return;
    }

    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (!cid) {
      host.innerHTML = '';
      const p = document.createElement('p');
      p.className = 'settings-item-description';
      p.textContent = 'Your account must use a numeric member ID to list invoices.';
      host.appendChild(p);
      return;
    }

    host.innerHTML = SETTINGS_INVOICES_SKELETON.trim();

    authAPI
      .listCustomerInvoices(cid)
      .then((invoices) => {
        host.innerHTML = '';
        const list = Array.isArray(invoices) ? [...invoices] : [];
        list.sort((a, b) => invoiceCreatedMs(b) - invoiceCreatedMs(a));

        if (!list.length) {
          const p = document.createElement('p');
          p.className = 'settings-item-description';
          p.textContent =
            'No invoices for this profile in the last two years. That is normal if you have not been billed through this membership yet.';
          host.appendChild(p);
          return;
        }

        list.forEach((inv) => {
          const item = document.createElement('div');
          item.className = 'settings-item settings-invoice-item';

          const header = document.createElement('div');
          header.className = 'settings-item-header';

          const main = document.createElement('div');
          main.className = 'settings-invoice-main';

          const label = document.createElement('span');
          label.className = 'settings-item-label';
          label.textContent = formatInvoiceNumberLabel(inv);

          const sub = document.createElement('p');
          sub.className = 'settings-item-description';
          sub.style.marginTop = '4px';
          const bu =
            inv.businessUnit?.displayName ||
            inv.businessUnit?.name ||
            (typeof inv.businessUnit === 'string' ? inv.businessUnit : '');
          const due = inv.dueDate ? `Due ${formatDisplayDate(inv.dueDate)}` : '';
          const created =
            typeof inv.created === 'string'
              ? (() => {
                  const m = inv.created.match(/^(\d{4})-(\d{2})-(\d{2})/);
                  return m ? `Created ${m[3]}/${m[2]}/${m[1]}` : '';
                })()
              : '';
          sub.textContent = [due, created, bu].filter(Boolean).join(' · ') || '—';

          main.appendChild(label);
          main.appendChild(sub);

          const trail = document.createElement('div');
          trail.className = 'settings-item-trailing settings-invoice-trail';

          const amountEl = document.createElement('span');
          amountEl.className = 'settings-item-value';
          amountEl.textContent = formatCurrencyOutDisplay(inv.totalAmount);

          const stateEl = document.createElement('span');
          stateEl.className = 'settings-invoice-state';
          const st = inv.state || '';
          if (st === 'STATE_DONE') stateEl.classList.add('settings-invoice-state--paid');
          else if (
            st === 'STATE_REMINDER' ||
            st === 'STATE_REMINDER_SERVICE' ||
            st === 'STATE_DEBT_COLLECTION'
          ) {
            stateEl.classList.add('settings-invoice-state--attention');
          }
          stateEl.textContent = humanizeInvoiceState(st);

          trail.appendChild(amountEl);
          trail.appendChild(stateEl);
          header.appendChild(main);
          header.appendChild(trail);
          item.appendChild(header);

          const rest = inv.rest;
          const restAmt = rest && rest.amount != null ? Number(rest.amount) : 0;
          if (Number.isFinite(restAmt) && restAmt > 0) {
            const foot = document.createElement('p');
            foot.className = 'settings-item-description';
            foot.style.marginTop = '6px';
            foot.textContent = `Balance due: ${formatCurrencyOutDisplay(rest)}`;
            item.appendChild(foot);
          }

          host.appendChild(item);
        });
      })
      .catch((err) => {
        console.warn('[Settings] Invoices:', err);
        host.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'settings-item-description';
        let msg =
          err?.status === 405
            ? 'Invoice list is not available on this connection. You may still have no invoices yet — contact the gym if you need billing history.'
            : getErrorMessage(err, 'Invoices');
        if (/HTTP error! status:/i.test(String(msg))) {
          msg = 'Could not load invoices. Try again later or contact your gym for billing history.';
        }
        p.textContent = msg;
        host.appendChild(p);
      });
  }

  function populateProfileEditForm() {
    const customer = getBestCustomerData();
    if (!customer) return;

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value || '';
    };

    setValue('editFirstName', customer.firstName || '');
    setValue('editLastName', customer.lastName || '');
    setValue('editDateOfBirth', customer.dateOfBirth || customer.birthDate || '');

    const address = customer.address || {};
    setValue('editStreetAddress', typeof address === 'string' ? address : (address.street || customer.streetAddress || ''));
    setValue('editPostalCode', address.postalCode || customer.postalCode || customer.zip || '');
    setValue('editCity', address.city || customer.city || '');
    setValue('editPhone', customer.mobilePhone || customer.phone || customer.phoneNumber || '');
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const normalized = value === null || value === undefined || value === '' ? '-' : String(value);
    el.textContent = normalized;
  }

  function formatDisplayDate(value) {
    if (!value) return '-';
    if (typeof value === 'string') {
      const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) return `${match[3]}/${match[2]}/${match[1]}`;
      return value;
    }
    return String(value);
  }

  function formatCountryLabel(country) {
    if (country == null || country === '') return '-';
    if (typeof country === 'string') {
      const t = country.trim();
      return t || '-';
    }
    if (typeof country === 'object') {
      const n = country.name || country.countryName;
      if (n) return String(n);
      const a2 = country.alpha2 || country.code;
      if (a2) return String(a2);
      return '-';
    }
    return '-';
  }

  /** BRP CustomerOut AddressOut (and similar) → display rows */
  function buildAddressFromBrpAddressOut(addr) {
    if (!addr || typeof addr !== 'object') return null;
    const street = (addr.street || addr.streetAddress || addr.line1 || '').trim();
    const cityName = (addr.city || '').trim();
    const pc =
      addr.postalCode != null && addr.postalCode !== ''
        ? String(addr.postalCode).trim()
        : (addr.zip || addr.postCode || '').toString().trim();
    const cityLine = [pc, cityName].filter(Boolean).join(' ').trim();
    let country = formatCountryLabel(addr.country);
    if (country === '-') {
      country = formatCountryLabel(addr.countryCode);
    }
    const has = Boolean(street || cityLine || (country && country !== '-'));
    if (!has) return null;
    return {
      street: street || '-',
      city: cityLine || '-',
      country: country && country !== '-' ? country : '-',
    };
  }

  function getAddress(customer) {
    const fallback = { full: '-', street: '-', city: '-', country: '-' };
    if (!customer) return fallback;

    const brp =
      buildAddressFromBrpAddressOut(customer.shippingAddress) ||
      buildAddressFromBrpAddressOut(customer.billingAddress);
    if (brp) {
      const parts = [brp.street, brp.city, brp.country].filter((x) => x && x !== '-');
      const full = parts.length ? parts.join(', ') : '-';
      return { full, ...brp };
    }

    const addr = customer.address;
    if (typeof addr === 'string') {
      const t = addr.trim();
      return {
        full: t || '-',
        street: t || '-',
        city: customer?.city || '-',
        country: formatCountryLabel(customer?.country) !== '-' ? formatCountryLabel(customer?.country) : '-',
      };
    }
    if (addr && typeof addr === 'object') {
      const street = (addr.street || customer?.streetAddress || '').trim() || '-';
      const pc = addr.postalCode != null && addr.postalCode !== '' ? String(addr.postalCode) : customer?.postalCode || customer?.zip || '';
      const cityLine = [pc, addr.city || customer?.city].filter(Boolean).join(' ').trim() || '-';
      let country = formatCountryLabel(addr.country);
      if (country === '-') country = formatCountryLabel(customer?.country);
      const full = [street, cityLine, country].filter((x) => x && x !== '-').join(', ') || '-';
      return { full, street, city: cityLine, country };
    }
    const street = (customer?.streetAddress || '').trim() || '-';
    const cityLine =
      [customer?.postalCode || customer?.zip, customer?.city].filter(Boolean).join(' ').trim() || '-';
    let country = formatCountryLabel(customer?.country);
    if (country === '-') country = '-';
    const full = [street, cityLine, country].filter((x) => x && x !== '-').join(', ') || '-';
    return { full, street, city: cityLine, country };
  }

  function getPhoneDisplay(customer) {
    const raw = customer?.mobilePhone || customer?.phone || customer?.phoneNumber || null;
    if (!raw) return '-';
    if (typeof raw === 'string' || typeof raw === 'number') {
      const text = String(raw).trim();
      // If phone is stored like "45 12345678", normalize to "+45 12345678".
      const match = text.match(/^(\d{1,4})\s+(.+)$/);
      if (match) return `+${match[1]} ${match[2]}`.trim();
      return text;
    }
    if (typeof raw === 'object') {
      const countryCodeRaw = raw.countryCode || raw.country || '';
      const countryCode = countryCodeRaw
        ? (String(countryCodeRaw).startsWith('+') ? String(countryCodeRaw) : `+${String(countryCodeRaw)}`)
        : '';
      const number = raw.number || raw.phone || raw.value || '';
      const combined = [countryCode, number].filter(Boolean).join(' ').trim();
      return combined || '-';
    }
    return '-';
  }

  /**
   * City line on profile: keep pure-numeric postal tokens; sentence-style casing for words (da-DK).
   * e.g. "8200 AARHUS N" → "8200 Aarhus N"
   */
  function formatProfileCityDisplay(value) {
    if (value == null || value === '' || value === '-') return '-';
    const t = String(value).replace(/\s+/g, ' ').trim();
    if (!t) return '-';
    const loc = 'da-DK';
    return t
      .split(/\s+/)
      .map((w) => {
        if (!w) return w;
        if (/^\d+$/.test(w)) return w;
        const lower = w.toLocaleLowerCase(loc);
        return lower.charAt(0).toLocaleUpperCase(loc) + lower.slice(1);
      })
      .join(' ');
  }

  function pickDisplaySubscription(customer) {
    const all = collectSubscriptionsArray(customer);
    const active = all.filter((s) => !subscriptionIsTerminated(s));
    return active[0] || all[0] || null;
  }

  function getMembershipData(customer) {
    const sub =
      pickDisplaySubscription(customer) ||
      customer?.activeSubscription ||
      customer?.membership ||
      null;

    let planName =
      sub?.name ||
      sub?.productName ||
      sub?.subscriptionProduct?.name ||
      sub?.type ||
      customer?.membershipType ||
      '-';
    if (planName === '-' && customer?.hasMembership === true) {
      planName = 'Membership';
    }

    const activeSince =
      sub?.startDate ||
      sub?.start ||
      sub?.activeSince ||
      customer?.memberJoinDate ||
      customer?.memberSince ||
      '-';

    const priceRaw = sub?.price;
    let price = '-';
    if (priceRaw != null && typeof priceRaw === 'object' && priceRaw.amount != null) {
      const cur = priceRaw.currency || 'DKK';
      price = `${priceRaw.amount} ${cur}`;
    } else if (priceRaw != null && priceRaw !== '') {
      price = priceRaw;
    } else if (sub?.monthlyPrice != null) {
      price = sub.monthlyPrice;
    }

    const gym =
      sub?.gymName ||
      sub?.businessUnitName ||
      sub?.businessUnit?.name ||
      customer?.primaryGym ||
      customer?.gymName ||
      '-';

    return {
      type: planName,
      activeSince,
      price,
      gym,
      memberId: sub?.memberId || sub?.id || customer?.membershipNumber || customer?.memberId || customer?.id || '-',
      contractStatus: sub?.contractStatus || customer?.contractStatus || '-',
      boundUntil: sub?.boundUntil || sub?.end || customer?.boundUntil || null,
      cardConsentStatus: sub?.cardConsentStatus || customer?.cardConsentStatus || null
    };
  }

  function hasActiveMembership(customer) {
    if (!customer) return false;
    if (customer.hasMembership === true) return true;
    const subs = collectSubscriptionsArray(customer);
    if (subs.some((s) => !subscriptionIsTerminated(s))) return true;
    const membership = getMembershipData(customer || {});
    const hasDirectSub = Boolean(
      customer?.activeSubscription ||
      customer?.membership ||
      (Array.isArray(customer?.subscriptions) && customer.subscriptions.length > 0) ||
      (Array.isArray(customer?.memberships) && customer.memberships.length > 0)
    );
    return hasDirectSub || (membership.type && membership.type !== '-');
  }

  function updateSubscriptionActionVisibility(customer) {
    const subscriptionActions = document.getElementById('subscriptionActions');
    if (!subscriptionActions) return;
    subscriptionActions.style.display = hasActiveMembership(customer) ? '' : 'none';
  }

  function populateProfileViews(customer, metadata) {
    if (!customer && !metadata) return;

    const firstName = customer?.firstName || metadata?.firstName || '-';
    const lastName = customer?.lastName || metadata?.lastName || '-';
    const fullName = [firstName, lastName].filter((v) => v && v !== '-').join(' ') || firstName || metadata?.username || 'User';
    const apiEmail = customer?.email != null ? String(customer.email).trim() : '';
    const email = apiEmail || state?.authenticatedEmail || metadata?.email || '-';
    const phone = getPhoneDisplay(customer);
    const dob = customer?.dateOfBirth || customer?.birthDate || '-';
    const address = getAddress(customer || {});
    const membership = getMembershipData(customer || {});

    setText('dashboardName', fullName);
    setText('dashboardEmail', email);
    setText('dashboardPhone', phone);

    setText('activityMemberSince', formatDisplayDate(membership.activeSince));
    setText('activityLoyaltyTier', customer?.loyaltyTier || '-');

    setText('profileFirstName', firstName);
    setText('profileLastName', lastName);
    setText('profileCustomerNumber', customer?.customerNumber || customer?.id || metadata?.username || '-');
    setText('profilePrimaryGym', customer?.primaryGym || customer?.gymName || membership.gym);
    setText('profileBirthdate', formatDisplayDate(dob));
    setText('profileGender', customer?.gender || '-');
    setText('profileStudentId', customer?.studentId || '-');
    setText('profilePhone', phone);
    setText('profileEmail', email);
    setText('profileStreet', address.street);
    setText('profileCity', formatProfileCityDisplay(address.city));
    setText('profileCountry', address.country);

    setText('settingsEmail', email);
    setText('settingsPhone', phone);

    const headerFirstName = firstName && firstName !== '-'
      ? firstName
      : (metadata?.username ? String(metadata.username).split(/[\s@._-]+/)[0] : 'User');
    const navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.textContent = headerFirstName || 'User';
    const navUserAvatar = document.getElementById('navUserAvatar');
    if (navUserAvatar) {
      navUserAvatar.style.display = 'none';
    }

    updateSubscriptionActionVisibility(customer);
    renderDashboardValueCardsSection(customer);
    syncNotificationPrivacyFromCustomer(customer || {});
  }

  function refreshLoginPageUI() {
    const authenticated = Boolean(isUserAuthenticated());
    const metadata = getTokenMetadata() || {};
    const customer = getBestCustomerData();

    document.body.classList.toggle('authenticated', authenticated);

    if (DOM.loginFormContainerPage) {
      DOM.loginFormContainerPage.style.display = authenticated ? 'none' : '';
    }
    if (DOM.profileEditSection) {
      DOM.profileEditSection.style.display = authenticated ? '' : 'none';
    }

    if (DOM.loginStatusPage) {
      DOM.loginStatusPage.style.display = authenticated ? 'block' : 'none';
    }

    if (DOM.loginStatusNamePage) {
      const name = customer?.firstName && customer?.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : (customer?.firstName || customer?.lastName || '-');
      DOM.loginStatusNamePage.textContent = name || '-';
    }
    if (DOM.loginStatusEmailPage) {
      DOM.loginStatusEmailPage.textContent = state?.authenticatedEmail || customer?.email || metadata?.email || '-';
    }
    if (DOM.loginStatusDobPage) {
      const dobValueEl = DOM.loginStatusDobPage.querySelector('.profile-detail-value');
      const dobValue = customer?.dateOfBirth || customer?.birthDate || null;
      DOM.loginStatusDobPage.style.display = dobValue ? '' : 'none';
      if (dobValueEl) dobValueEl.textContent = dobValue || '-';
    }
    if (DOM.loginStatusAddressPage) {
      const addressText = getAddress(customer || {}).full;
      const addressValueEl = DOM.loginStatusAddressPage.querySelector('.profile-detail-value');
      DOM.loginStatusAddressPage.style.display = addressText !== '-' ? '' : 'none';
      if (addressValueEl) addressValueEl.textContent = addressText;
    }
    if (DOM.loginStatusPhonePage) {
      const phoneValueEl = DOM.loginStatusPhonePage.querySelector('.profile-detail-value');
      const phoneValue = getPhoneDisplay(customer);
      DOM.loginStatusPhonePage.style.display = phoneValue && phoneValue !== '-' ? '' : 'none';
      if (phoneValueEl) phoneValueEl.textContent = phoneValue || '-';
    }

    const pageContentWrapper = document.getElementById('pageContentWrapper');
    if (pageContentWrapper) {
      pageContentWrapper.style.display = authenticated ? 'block' : 'none';
    }
    const mainNavigation = document.getElementById('mainNavigation');
    if (mainNavigation) {
      mainNavigation.style.display = authenticated ? 'block' : 'none';
    }

    if (authenticated) {
      populateProfileEditForm();
      populateProfileViews(customer, metadata);
      const hashRoute = window.location.hash.replace('#', '');
      setRoute(PAGE_ROUTES.includes(hashRoute) ? hashRoute : 'dashboard');
    } else {
      if (window.location.hash) {
        window.location.hash = '';
      }
    }
  }

  function updateNavigation() {
    const hashRoute = window.location.hash.replace('#', '');
    if (!isUserAuthenticated()) return;
    if (PAGE_ROUTES.includes(hashRoute)) {
      setRoute(hashRoute);
    } else {
      setRoute('dashboard');
    }
  }

  function initNavigation() {
    const navUser = document.getElementById('navUser');
    const userDropdown = document.getElementById('userDropdown');

    const setDropdownOpen = (isOpen) => {
      if (!navUser || !userDropdown) return;
      userDropdown.style.display = isOpen ? 'block' : 'none';
      navUser.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    const toggleDropdown = () => {
      if (!navUser || !userDropdown) return;
      const isOpen = userDropdown.style.display === 'block';
      setDropdownOpen(!isOpen);
    };

    if (navUser && userDropdown) {
      navUser.setAttribute('role', 'button');
      navUser.setAttribute('tabindex', '0');
      navUser.setAttribute('aria-haspopup', 'menu');
      navUser.setAttribute('aria-expanded', 'false');
      userDropdown.setAttribute('role', 'menu');
      setDropdownOpen(false);

      navUser.addEventListener('click', (e) => {
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

    document.querySelectorAll('.nav-link[data-route]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        setRoute(link.getAttribute('data-route') || 'dashboard');
      });
    });

    const profileDropdown = document.querySelector('[data-action="nav-profile"]');
    if (profileDropdown) {
      profileDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        setDropdownOpen(false);
        setRoute('profile');
      });
    }

    const settingsDropdown = document.querySelector('[data-action="nav-settings"]');
    if (settingsDropdown) {
      settingsDropdown.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        setDropdownOpen(false);
        setRoute('settings');
      });
    }

    window.addEventListener('hashchange', updateNavigation);

    const settingsRegisterCardConsentBtn = document.getElementById('settingsRegisterCardConsentBtn');
    if (settingsRegisterCardConsentBtn) {
      settingsRegisterCardConsentBtn.addEventListener('click', () => {
        window.location.href = './index.html';
      });
    }

    const bindClickOnce = (el, handler) => {
      if (!el || el.dataset.boundClick === 'true') return;
      el.addEventListener('click', handler);
      el.dataset.boundClick = 'true';
    };

    const editEmailBtn = document.getElementById('editEmailBtn');
    const editPhoneBtn = document.getElementById('editPhoneBtn');
    const contactFieldModal = document.getElementById('contactFieldModal');
    const closeContactFieldModal = document.getElementById('closeContactFieldModal');
    const cancelContactFieldModal = document.getElementById('cancelContactFieldModal');
    const saveContactFieldModal = document.getElementById('saveContactFieldModal');
    const contactFieldModalTitle = document.getElementById('contactFieldModalTitle');
    const contactFieldInput = document.getElementById('contactFieldInput');
    const contactFieldModalError = document.getElementById('contactFieldModalError');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const passwordModal = document.getElementById('passwordModal');
    const closePasswordModal = document.getElementById('closePasswordModal');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const savePasswordBtn = document.getElementById('savePasswordBtn');
    const passwordFormError = document.getElementById('passwordFormError');

    const closeContactModal = () => {
      if (!contactFieldModal) return;
      contactFieldModal.style.display = 'none';
      if (contactFieldModalError) {
        contactFieldModalError.style.display = 'none';
        contactFieldModalError.textContent = '';
      }
      if (contactFieldInput) {
        contactFieldInput.value = '';
        contactFieldInput.dataset.field = '';
      }
    };

    const openContactModal = (field) => {
      if (!contactFieldModal || !contactFieldInput || !contactFieldModalTitle) return;
      const customer = getBestCustomerData() || {};
      const isEmail = field === 'email';
      contactFieldInput.dataset.field = field;
      contactFieldModalTitle.textContent = isEmail ? 'Edit Email Address' : 'Edit Phone Number';
      contactFieldInput.type = isEmail ? 'email' : 'tel';
      contactFieldInput.placeholder = isEmail ? 'Enter email address' : 'Enter phone number';
      contactFieldInput.value = isEmail
        ? (state.authenticatedEmail || customer.email || '')
        : getPhoneDisplay(customer).replace(/^\-$/, '');
      contactFieldModal.style.display = 'flex';
      setTimeout(() => contactFieldInput.focus(), 0);
    };

    bindClickOnce(editEmailBtn, () => openContactModal('email'));
    bindClickOnce(editPhoneBtn, () => openContactModal('phone'));
    bindClickOnce(closeContactFieldModal, closeContactModal);
    bindClickOnce(cancelContactFieldModal, closeContactModal);
    if (contactFieldModal && contactFieldModal.dataset.boundOverlay !== 'true') {
      contactFieldModal.addEventListener('click', (event) => {
        if (event.target === contactFieldModal) closeContactModal();
      });
      contactFieldModal.dataset.boundOverlay = 'true';
    }
    if (document.body.dataset.boundContactEscape !== 'true') {
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && contactFieldModal?.style?.display === 'flex') {
          closeContactModal();
        }
      });
      document.body.dataset.boundContactEscape = 'true';
    }
    bindClickOnce(saveContactFieldModal, async () => {
      const field = contactFieldInput?.dataset?.field || '';
      const value = contactFieldInput?.value?.trim() || '';
      if (!field) return;
      if (!value) {
        if (contactFieldModalError) {
          contactFieldModalError.textContent = `Please enter a valid ${field}.`;
          contactFieldModalError.style.display = 'block';
        }
        return;
      }
      try {
        saveContactFieldModal.disabled = true;
        if (field === 'email') {
          await authAPI.updateCustomer(state.customerId, { email: value });
          state.authenticatedEmail = value;
        } else {
          await authAPI.updateCustomer(state.customerId, { phone: value });
        }
        const updatedCustomer = await authAPI.getCustomer(state.customerId);
        state.authenticatedCustomer = updatedCustomer;
        closeContactModal();
        refreshLoginUI();
        refreshLoginPageUI();
        showToast(field === 'email' ? 'Email updated successfully.' : 'Phone number updated successfully.', 'success');
      } catch (error) {
        if (contactFieldModalError) {
          contactFieldModalError.textContent = getErrorMessage(error, 'Profile update');
          contactFieldModalError.style.display = 'block';
        }
      } finally {
        saveContactFieldModal.disabled = false;
      }
    });

    const setPasswordModalOpen = (isOpen) => {
      if (!passwordModal) return;
      passwordModal.style.display = isOpen ? 'flex' : 'none';
      if (!isOpen && passwordFormError) {
        passwordFormError.style.display = 'none';
        passwordFormError.textContent = '';
      }
    };

    bindClickOnce(changePasswordBtn, () => setPasswordModalOpen(true));
    bindClickOnce(closePasswordModal, () => setPasswordModalOpen(false));
    bindClickOnce(cancelPasswordBtn, () => setPasswordModalOpen(false));
    bindClickOnce(savePasswordBtn, async () => {
      const oldPassword = document.getElementById('oldPasswordInput')?.value?.trim() || '';
      const newPassword = document.getElementById('newPasswordInput')?.value?.trim() || '';
      const confirmPassword = document.getElementById('confirmPasswordInput')?.value?.trim() || '';

      if (!oldPassword || !newPassword || !confirmPassword) {
        if (passwordFormError) {
          passwordFormError.textContent = 'Please fill in all password fields.';
          passwordFormError.style.display = 'block';
        }
        return;
      }
      if (newPassword !== confirmPassword) {
        if (passwordFormError) {
          passwordFormError.textContent = 'New passwords do not match.';
          passwordFormError.style.display = 'block';
        }
        return;
      }

      try {
        savePasswordBtn.disabled = true;
        const email = state.authenticatedEmail || getBestCustomerData()?.email || '';
        if (!email) throw new Error('Missing account email');
        await authAPI.resetPassword(email);
        setPasswordModalOpen(false);
        showToast('Password reset instructions sent to your email.', 'success');
      } catch (error) {
        if (passwordFormError) {
          passwordFormError.textContent = getErrorMessage(error, 'Password update');
          passwordFormError.style.display = 'block';
        }
      } finally {
        savePasswordBtn.disabled = false;
      }
    });

    const closeModal = (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    };
    const openModal = (id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'flex';
    };
    const closeAllSubscriptionModals = () => {
      [
        'freezeSubscriptionModal',
        'freezeSubscriptionModalStep2',
        'freezeSubscriptionModalStep3',
        'cancelSubscriptionModal',
        'cancelSubscriptionModalStep2',
        'cancelSubscriptionModalStep3'
      ].forEach(closeModal);
    };

    const freezeSubscriptionSettingsBtn = document.getElementById('freezeSubscriptionSettingsBtn');
    const cancelSubscriptionSettingsBtn = document.getElementById('cancelSubscriptionSettingsBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const requireActiveMembershipOrToast = () => {
      const customer = getBestCustomerData();
      if (!hasActiveMembership(customer)) {
        showToast('No active membership found for this account.', 'error');
        return false;
      }
      return true;
    };

    if (freezeSubscriptionSettingsBtn) {
      freezeSubscriptionSettingsBtn.addEventListener('click', () => {
        if (!requireActiveMembershipOrToast()) return;
        openModal('freezeSubscriptionModal');
      });
    }
    if (cancelSubscriptionSettingsBtn) {
      cancelSubscriptionSettingsBtn.addEventListener('click', () => {
        if (!requireActiveMembershipOrToast()) return;
        const customer = getBestCustomerData() || {};
        const cancelNameEl = document.getElementById('cancelSubscriptionUserName');
        if (cancelNameEl) {
          cancelNameEl.textContent = customer.firstName || getUserDisplayName() || 'User';
        }
        openModal('cancelSubscriptionModal');
      });
    }
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        handleLogout();
        refreshLoginPageUI();
      });
    }

    const freezeError = document.getElementById('freezeSubscriptionError');
    const freezeErrorStep2 = document.getElementById('freezeSubscriptionErrorStep2');
    const cancelErrorStep2 = document.getElementById('cancelSubscriptionErrorStep2');
    const freezeDatePreview = document.getElementById('freezeDatePreview');

    const setError = (el, message) => {
      if (!el) return;
      el.textContent = message || '';
      el.style.display = message ? 'block' : 'none';
    };

    document.getElementById('closeFreezeSubscriptionModal')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeFreezeSubscriptionModalStep2')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeFreezeSubscriptionModalStep3')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('stayMembershipBtn')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('stayMembershipBtnStep2')?.addEventListener('click', closeAllSubscriptionModals);

    document.getElementById('proceedFreezeBtn')?.addEventListener('click', () => {
      const start = document.getElementById('freezeStartDate')?.value || '';
      const end = document.getElementById('freezeEndDate')?.value || '';
      if (!start || !end) {
        setError(freezeError, 'Please choose both start and end dates.');
        return;
      }
      if (new Date(start) > new Date(end)) {
        setError(freezeError, 'End date must be after start date.');
        return;
      }
      setError(freezeError, '');
      if (freezeDatePreview) freezeDatePreview.textContent = `Freeze period: ${start} to ${end}`;
      closeModal('freezeSubscriptionModal');
      openModal('freezeSubscriptionModalStep2');
    });

    document.getElementById('proceedFreezeBtnStep2')?.addEventListener('click', () => {
      const accepted = document.getElementById('freezeAcceptTerms')?.checked;
      if (!accepted) {
        setError(freezeErrorStep2, 'Please accept the terms to continue.');
        return;
      }
      setError(freezeErrorStep2, '');
      // UI flow is completed here; backend freeze endpoint can be wired later.
      closeModal('freezeSubscriptionModalStep2');
      openModal('freezeSubscriptionModalStep3');
    });

    document.getElementById('sendFreezeFeedbackBtn')?.addEventListener('click', () => {
      closeAllSubscriptionModals();
      showToast('Freeze request flow completed.', 'success');
    });

    document.getElementById('closeCancelSubscriptionModal')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeCancelSubscriptionModalStep2')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeCancelSubscriptionModalStep3')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('nevermindCancelBtn')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('stayMembershipCancelBtn')?.addEventListener('click', closeAllSubscriptionModals);

    document.getElementById('freezeInsteadBtn')?.addEventListener('click', () => {
      closeModal('cancelSubscriptionModal');
      openModal('freezeSubscriptionModal');
    });
    document.getElementById('proceedCancelBtn')?.addEventListener('click', () => {
      closeModal('cancelSubscriptionModal');
      openModal('cancelSubscriptionModalStep2');
    });
    document.getElementById('confirmCancelSubscriptionBtn')?.addEventListener('click', () => {
      const password = document.getElementById('cancelPasswordInput')?.value?.trim() || '';
      if (!password) {
        setError(cancelErrorStep2, 'Please confirm your password to continue.');
        return;
      }
      setError(cancelErrorStep2, '');
      // UI flow is completed here; backend cancel endpoint can be wired later.
      closeModal('cancelSubscriptionModalStep2');
      openModal('cancelSubscriptionModalStep3');
    });
    document.getElementById('sendCancelFeedbackBtn')?.addEventListener('click', () => {
      closeAllSubscriptionModals();
      showToast('Cancellation request flow completed.', 'success');
    });

    initBookingsTabSwitching();
    initBookingsBrowseControls();
  }

  window.refreshLoginPageUI = refreshLoginPageUI;
  window.populateProfileEditForm = populateProfileEditForm;
  window.navigateToRoute = setRoute;
  window.updateNavigation = updateNavigation;
  window.initNavigation = initNavigation;
  window.refreshDashboardPanels = refreshDashboardPanels;

  // Refresh UI on page load
  refreshLoginPageUI();
  updateSubscriptionActionVisibility(getBestCustomerData());

  // Populate profile edit form if logged in
  if (isUserAuthenticated && typeof isUserAuthenticated === 'function' && isUserAuthenticated()) {
    if (!state.authenticatedCustomer) {
      const metadata = getTokenMetadata() || {};
      const username = state.customerId || metadata.username || metadata.userName || null;
      const email = state.authenticatedEmail || metadata.email || null;
      syncAuthenticatedCustomerState(username, email).finally(() => refreshLoginPageUI());
    } else {
      populateProfileEditForm();
    }
  }

  // Auto-populate form from URL parameters if present
  const urlParams = new URLSearchParams(window.location.search);
  const urlEmail = urlParams.get('loginEmail');
  const urlPassword = urlParams.get('loginPassword');
  
  if (urlEmail && DOM.loginPageForm) {
    const emailInput = document.getElementById('loginEmailPage');
    if (emailInput) {
      emailInput.value = decodeURIComponent(urlEmail);
      console.log('[Login Page] Auto-populated email from URL');
    }
  }
  if (urlPassword && DOM.loginPageForm) {
    const passwordInput = document.getElementById('loginPasswordPage');
    if (passwordInput) {
      passwordInput.value = decodeURIComponent(urlPassword);
      console.log('[Login Page] Auto-populated password from URL');
      
      // Auto-submit if both email and password are in URL
      if (urlEmail) {
        console.log('[Login Page] Both email and password in URL, auto-submitting...');
        setTimeout(() => {
          if (DOM.loginPageForm) {
            DOM.loginPageForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }, 100);
      }
    }
  }

  // Handle login form submission
  if (DOM.loginPageForm) {
    DOM.loginPageForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      
      // Check if login is already in progress
      if (state.loginInProgress) {
        return;
      }

      const emailInput = document.getElementById('loginEmailPage');
      const passwordInput = document.getElementById('loginPasswordPage');

      // Check if inputs exist
      if (!emailInput || !passwordInput) {
        console.error('[Login Page] Form inputs not found', {
          emailInput: !!emailInput,
          passwordInput: !!passwordInput
        });
        showToast('Form inputs not found. Please refresh the page.', 'error');
        return;
      }

      const email = emailInput.value?.trim() || '';
      const password = passwordInput.value || '';

      console.log('[Login Page] Form submission', {
        email: email ? `${email.substring(0, 3)}...` : 'empty',
        password: password ? '***' : 'empty',
        emailInputExists: !!emailInput,
        passwordInputExists: !!passwordInput
      });

      if (!email || !password) {
        console.warn('[Login Page] Validation failed', { email: !!email, password: !!password });
        showToast('Please enter both email and password.', 'error');
        if (!email && emailInput) {
          emailInput.closest('.form-group')?.classList.add('error');
        }
        if (!password && passwordInput) {
          passwordInput.closest('.form-group')?.classList.add('error');
        }
        return;
      }

      state.loginInProgress = true;
      const submitButton = DOM.loginPageForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'LOG IN';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
      }

      try {
        // Check for mock login in test mode
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const urlParams = new URLSearchParams(window.location.search);
        const isTestMode = urlParams.get('test') === 'true' || localStorage.getItem('testMode') === 'true';
        const useMockLogin = urlParams.get('mock') === 'true' || localStorage.getItem('mockLogin') === 'true';
        
        let response;
        if ((isDevelopment || isTestMode) && useMockLogin) {
          // Mock login for testing - bypasses API
          console.log('%c🧪 MOCK LOGIN: Using mock authentication', 'color: #F401F5; font-weight: bold;');
          console.log('Email:', email);
          console.log('💡 To disable mock login: remove ?mock=true or localStorage.removeItem(\'mockLogin\')');
          
          // Simulate API response
          response = {
            data: {
              username: email.split('@')[0] || 'testuser',
              email: email,
              accessToken: 'mock_access_token_' + Date.now(),
              refreshToken: 'mock_refresh_token_' + Date.now(),
              expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
              expiresIn: 3600,
              roles: ['customer'],
              tokenType: 'Bearer'
            }
          };
          
          // Manually save tokens
          if (typeof window.saveTokens === 'function') {
            window.saveTokens(
              response.data.accessToken,
              response.data.refreshToken,
              response.data.expiresAt,
              {
                username: response.data.username,
                email: response.data.email,
                roles: response.data.roles,
                tokenType: response.data.tokenType,
                expiresIn: response.data.expiresIn
              }
            );
          }
          
          // Set authenticated state
          state.authenticatedEmail = email;
          state.customerId = response.data.username;
          
          // Create mock customer data
          state.authenticatedCustomer = {
            id: response.data.username,
            username: response.data.username,
            email: email,
            firstName: email.split('@')[0] || 'Test',
            lastName: 'User',
            dateOfBirth: '1990-01-01',
            address: {
              street: '123 Test Street',
              postalCode: '1000',
              city: 'Copenhagen'
            },
            phone: '+45 12345678'
          };
          
          showToast(`🧪 Mock login successful as ${email}`, 'success');
        } else {
          // Real API login
          response = await authAPI.login(email, password);
        }
        
        const payload = response?.data ?? response;
        const username = payload?.username || email;
        
        state.authenticatedEmail = email;

        // Sync customer state and fetch profile
        await window.syncAuthenticatedCustomerState(username, email);

        // Fetch full customer profile if not already fetched
        if (!state.authenticatedCustomer) {
          try {
            const customerId = state.customerId || username;
            if (customerId) {
              const customerData = await authAPI.getCustomer(customerId);
              state.authenticatedCustomer = customerData;
              console.log('[login page] Customer profile loaded:', customerData);
            }
          } catch (profileError) {
            console.warn('[login page] Could not fetch customer profile:', profileError);
          }
        }

        // Refresh login page UI and populate edit form
        refreshLoginPageUI();
        if (state.authenticatedCustomer) {
          populateProfileEditForm();
        }
        
        // Show toast with user's name (after fetching profile)
        if (!useMockLogin) {
          let displayName = email; // Default fallback
          if (getUserDisplayName) {
            displayName = getUserDisplayName();
          } else if (state.authenticatedCustomer) {
            // Fallback if getUserDisplayName not available yet
            const customer = state.authenticatedCustomer;
            if (customer?.firstName && customer?.lastName) {
              displayName = `${customer.firstName} ${customer.lastName}`;
            } else if (customer?.firstName) {
              displayName = customer.firstName;
            } else if (customer?.lastName) {
              displayName = customer.lastName;
            }
          }
          showToast(`Logged in as ${displayName}.`, 'success');
        }

        // Reset form
        DOM.loginPageForm.reset();
        
        // Ensure navigation and routing are properly initialized after login
        // Use setTimeout to ensure all state updates are complete
        setTimeout(() => {
          if (typeof window.updateNavigation === 'function') {
            window.updateNavigation();
          }
          
          // Ensure page content is visible and route is set after login
          const pageContentWrapper = document.getElementById('pageContentWrapper');
          if (pageContentWrapper) {
            const currentHash = window.location.hash.replace('#', '');
            const validRoutes = ['dashboard', 'classes', 'activity', 'profile', 'settings'];
            if (!currentHash || !validRoutes.includes(currentHash)) {
              if (typeof window.navigateToRoute === 'function') {
                window.navigateToRoute('dashboard');
              }
            } else {
              // Re-navigate to current route to ensure it's properly displayed
              if (typeof window.navigateToRoute === 'function') {
                window.navigateToRoute(currentHash);
              }
            }
          }
        }, 100);
      } catch (error) {
        console.error('[login page] Login failed:', error);
        
        // In test mode, provide more helpful error messages
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const urlParams = new URLSearchParams(window.location.search);
        const isTestMode = urlParams.get('test') === 'true' || localStorage.getItem('testMode') === 'true';
        
        if ((isDevelopment || isTestMode) && error.message && (error.message.includes('Rate limit') || error.message.includes('429'))) {
          console.warn('%c🧪 TEST MODE: Rate limit error detected', 'color: #F401F5; font-weight: bold;');
          console.warn('You can continue testing - the error is shown but login attempts are not blocked');
          console.warn('The API server will still enforce rate limits, but you can retry immediately');
          console.warn('💡 TIP: Wait for the retry period or contact API admin to reset rate limits');
        }
        
        showToast(getErrorMessage(error, 'Login'), 'error');
      } finally {
        state.loginInProgress = false;
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  // Handle profile edit form submission
  if (DOM.profileEditForm) {
    DOM.profileEditForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!isUserAuthenticated() || !state.customerId) {
        showToast('Please log in to edit your profile.', 'error');
        return;
      }

      const firstNameInput = document.getElementById('editFirstName');
      const lastNameInput = document.getElementById('editLastName');
      const dobInput = document.getElementById('editDateOfBirth');
      const streetInput = document.getElementById('editStreetAddress');
      const postalCodeInput = document.getElementById('editPostalCode');
      const cityInput = document.getElementById('editCity');
      const phoneInput = document.getElementById('editPhone');

      // Validate required fields
      if (!firstNameInput?.value?.trim() || !lastNameInput?.value?.trim() || !dobInput?.value || !streetInput?.value?.trim() || !postalCodeInput?.value?.trim()) {
        showToast('Please fill in all required fields.', 'error');
        return;
      }

      // Build customer data object
      const customerData = {
        firstName: firstNameInput.value.trim(),
        lastName: lastNameInput.value.trim(),
        dateOfBirth: dobInput.value,
        address: {
          street: streetInput.value.trim(),
          postalCode: postalCodeInput.value.trim(),
          city: cityInput.value.trim() || null,
        },
      };

      if (phoneInput?.value?.trim()) {
        customerData.phone = phoneInput.value.trim();
      }

      const submitButton = DOM.profileEditForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'SAVE CHANGES';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Saving...';
      }

      try {
        // Update customer via API
        await authAPI.updateCustomer(state.customerId, customerData);

        // Refresh customer profile
        const updatedCustomer = await authAPI.getCustomer(state.customerId);
        state.authenticatedCustomer = updatedCustomer;

        // Refresh UI
        refreshLoginUI();
        refreshLoginPageUI();
        window.updateHeaderLoginButton();

        showToast('Profile updated successfully!', 'success');
      } catch (error) {
        console.error('[profile edit] Update failed:', error);
        showToast(getErrorMessage(error, 'Profile update'), 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  // Handle logout
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="logout"]') || event.target.closest('[data-action="nav-logout"]')) {
      event.preventDefault();
      handleLogout();
      refreshLoginPageUI();
      // Update navigation after logout
      if (typeof window.updateNavigation === 'function') {
        window.updateNavigation();
      }
    }
  });

  // Handle forgot password
  const forgotPasswordLink = document.querySelector('[data-action="forgot-password"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (DOM.forgotPasswordModal) {
        DOM.forgotPasswordModal.style.display = 'flex';
      }
    });
  }

  // Close forgot password modal
  document.addEventListener('click', (e) => {
    if (e.target.dataset.action === 'close-forgot-password') {
      if (DOM.forgotPasswordModal) {
        DOM.forgotPasswordModal.style.display = 'none';
      }
      if (DOM.forgotPasswordForm) {
        DOM.forgotPasswordForm.reset();
      }
      if (DOM.forgotPasswordSuccess) {
        DOM.forgotPasswordSuccess.style.display = 'none';
      }
    }
  });

  // Close modal when clicking outside
  if (DOM.forgotPasswordModal) {
    DOM.forgotPasswordModal.addEventListener('click', (e) => {
      if (e.target === DOM.forgotPasswordModal) {
        DOM.forgotPasswordModal.style.display = 'none';
      }
    });
  }

  // Close modal on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && DOM.forgotPasswordModal && DOM.forgotPasswordModal.style.display !== 'none') {
      DOM.forgotPasswordModal.style.display = 'none';
    }
  });

  // Handle forgot password form submission
  if (DOM.forgotPasswordForm) {
    DOM.forgotPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = DOM.forgotPasswordEmail?.value?.trim() || '';

      if (!email) {
        showToast('Please enter your email address.', 'error');
        return;
      }

      const submitButton = DOM.forgotPasswordForm.querySelector('button[type="submit"]');
      const originalText = submitButton?.textContent || 'SEND RESET LINK';
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }

      try {
        console.log('[Forgot Password] Requesting password reset for:', email);
        await authAPI.resetPassword(email);

        // Show success message
        DOM.forgotPasswordForm.style.display = 'none';
        if (DOM.forgotPasswordSuccess) {
          DOM.forgotPasswordSuccess.style.display = 'block';
        }
      } catch (error) {
        console.error('[Forgot Password] Error:', error);
        showToast(getErrorMessage(error, 'Password reset'), 'error');
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    });
  }

  bindNotificationPrivacyToggles();
}
