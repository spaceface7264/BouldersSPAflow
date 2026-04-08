import { bindProfileAuthUi } from './bind-profile-auth-ui.js';
import { buildProfileContext } from './profile-context.js';
import {
  resolveProductAssetImageUrl as resolveProductAssetImageUrlForHost,
  resolveGroupActivityClassImageUrl as resolveGroupActivityClassImageUrlForHost,
  extractGroupActivityProductId,
  classCardBusinessUnitId as classCardBusinessUnitIdImpl,
} from './lib/brp-assets.js';
import {
  getMembershipData,
  hasActiveMembership,
  detectPrimaryAccess,
} from './lib/subscriptions-and-access.js';
import {
  collectValueCardsArray,
  formatAddonExpiryDisplay,
  valueCardIsExpiredOrInvalid,
  formatValueCardRemainingLabel,
  valueCardProductRef,
  valueCardProductId,
  valueCardProductDisplayName,
} from './lib/value-cards.js';
import {
  formatDisplayDate,
  formatCountryLabel,
  formatPriceDisplay,
  buildAddressFromBrpAddressOut,
} from './lib/display-format.js';
import {
  bookingStartIsoValue,
  isBrpWaitingListBooking,
  brpBookingStartMs,
  brpBookingEndMs,
  formatClassSessionWhenLine,
  formatClassSessionDurationMinutes,
  formatGroupActivitySlotsAvailability,
  formatClassCardAvailabilityFromContext,
  isBrowseSlotsFullyBooked,
  isDropInOnlyClass,
  isLikelySeriesSession,
  hasSeriesCopyHint,
} from './lib/class-activity-pure.js';
export function initializeLoginPage(DOM) {
  const ctx = buildProfileContext(DOM);
  const {
    state,
    authAPI,
    refreshLoginUI,
    handleLogout,
    showToast,
    getErrorMessage,
    isUserAuthenticated,
    getTokenMetadata,
    syncAuthenticatedCustomerState,
    getUserDisplayName,
    PAGE_ROUTES,
    PAGE_ROUTE_MAP,
  } = ctx;

  const resolveProductAssetImageUrl = (product) =>
    resolveProductAssetImageUrlForHost(product, ctx.hostname);
  const resolveGroupActivityClassImageUrl = (source) =>
    resolveGroupActivityClassImageUrlForHost(source, ctx.hostname);

  function getBestCustomerData() {
    return state?.authenticatedCustomer || null;
  }

  function classCardBusinessUnitId(source) {
    return classCardBusinessUnitIdImpl(source, getBestCustomerData());
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
      titleEl.textContent =
        displayName && displayName !== 'there'
          ? `Welcome back, ${displayName}! 👋`
          : 'Welcome back! 👋';
    }
  }


  async function fetchEventProductDetail(productId, businessUnitId) {
    if (productId == null) return null;
    const bu = businessUnitId != null ? Number(businessUnitId) : NaN;
    if (!Number.isFinite(bu) || bu <= 0) return null;
    const params = new URLSearchParams();
    params.set('businessUnit', String(bu));
    const qs = `?${params.toString()}`;
    const headers = {
      'Accept-Language': 'da-DK',
      Accept: 'application/json',
    };
    try {
      const res = await fetch(`/api/ver3/products/events/${productId}${qs}`, { headers });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
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

  const bookingEventImageCache = new Map();

  async function resolveBookedClassImageUrlFromEvents(booking) {
    if (!booking || typeof booking !== 'object' || !authAPI?.listBusinessUnitEvents) return '';
    const buId = classCardBusinessUnitId(booking);
    const title = bookingDisplayLine(booking).title;
    const startIso = bookingStartIsoValue(booking);
    const startMs = Date.parse(startIso);
    if (!buId || !title || !Number.isFinite(startMs)) return '';
    const day = new Date(startMs);
    day.setHours(0, 0, 0, 0);
    const key = `${buId}|${String(title).toLowerCase().trim()}|${day.toISOString().slice(0, 10)}`;
    if (bookingEventImageCache.has(key)) return bookingEventImageCache.get(key) || '';
    const start = new Date(day.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(day.getTime() + 3 * 24 * 60 * 60 * 1000 - 1).toISOString();
    try {
      const events = await authAPI.listBusinessUnitEvents(buId, { periodStart: start, periodEnd: end });
      const normalize = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const name = normalize(title);
      const match = (Array.isArray(events) ? events : []).find((ev) => {
        const evName = normalize(ev?.name);
        if (!evName) return false;
        const sameName = evName === name || evName.includes(name) || name.includes(evName);
        if (!sameName) return false;
        const evStart = Date.parse(ev?.duration?.start || '');
        const evEnd = Date.parse(ev?.duration?.end || '');
        if (!Number.isFinite(evStart)) return false;
        const effectiveEnd = Number.isFinite(evEnd) ? evEnd : evStart;
        return startMs >= evStart && startMs <= effectiveEnd + 24 * 60 * 60 * 1000;
      });
      if (!match) {
        bookingEventImageCache.set(key, '');
        return '';
      }
      let url = resolveGroupActivityClassImageUrl(match);
      if (!url) {
        const productId = extractGroupActivityProductId(match);
        if (productId) {
          const detail = await fetchEventProductDetail(productId, buId);
          url = detail ? resolveProductAssetImageUrl(detail) : '';
        }
      }
      const finalUrl = url || '';
      bookingEventImageCache.set(key, finalUrl);
      return finalUrl;
    } catch {
      bookingEventImageCache.set(key, '');
      return '';
    }
  }

  function createClassCardMediaEl(source, title, options) {
    const wrap = document.createElement('div');
    wrap.className = 'booking-item-card__media';
    if (options && typeof options.extraMediaClasses === 'string') {
      options.extraMediaClasses.split(/\s+/).forEach((c) => {
        if (c) wrap.classList.add(c);
      });
    }
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
    const isEvent = source && typeof source === 'object' && (source.__kind === 'event' || source.occasions);

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
      const fetchDetail = isEvent
        ? fetchEventProductDetail(productId, buId)
        : fetchGroupActivityProductDetail(productId, buId, customerId);
      Promise.resolve(fetchDetail).then((detail) => {
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

    if (source && isDropInOnlyClass(source)) {
      const badge = document.createElement('span');
      badge.className = 'booking-item-card__dropin-ribbon';
      badge.textContent = 'DROP-IN';
      wrap.appendChild(badge);
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
    const rowsEl = document.getElementById('dashboardAccessRows');
    const badgeEl = document.getElementById('dashboardAccessBadge');
    const supportSlot = document.getElementById('dashboardAccessSupportSlot');
    if (!rowsEl || !badgeEl) return;

    clearDashboardEl(rowsEl);
    if (supportSlot) {
      clearDashboardEl(supportSlot);
      supportSlot.setAttribute('hidden', '');
    }
    const access = detectPrimaryAccess(customer || {});
    const membership = getMembershipData(customer || {});

    if (access.kind === 'membership') {
      badgeEl.textContent = 'Membership';
      addAccessRow(rowsEl, 'Member since', formatDisplayDate(membership.activeSince));
      addAccessRow(
        rowsEl,
        'Price',
        formatPriceDisplay(membership.price, membership.priceCurrency)
      );
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


  const seriesSessionProductCache = new Map();


  async function isSeriesSessionByProductDetail(activity) {
    if (!activity || typeof activity !== 'object') return false;
    const productId = extractGroupActivityProductId(activity);
    if (!productId) return false;
    if (seriesSessionProductCache.has(productId)) {
      return seriesSessionProductCache.get(productId) === true;
    }
    const buId = classCardBusinessUnitId(activity);
    const customerId = getBrpNumericCustomerId(getBestCustomerData());
    const detail = await fetchGroupActivityProductDetail(productId, buId, customerId);
    const isSeries = hasSeriesCopyHint(detail?.description) || hasSeriesCopyHint(activity?.externalMessage);
    seriesSessionProductCache.set(productId, isSeries);
    return isSeries;
  }

  async function shouldBlockDirectSessionBooking(activity) {
    if (isLikelySeriesSession(activity)) return true;
    try {
      return await isSeriesSessionByProductDetail(activity);
    } catch (_) {
      return false;
    }
  }

  let classCardExpandRoot = null;
  let classCardExpandEscapeBound = false;

  function clearClassCardExpandLayoutModifiers(root) {
    root?.classList.remove('class-card-expand--saved-fallback');
  }

  function closeClassCardExpand() {
    if (!classCardExpandRoot) return;
    classCardExpandRoot.classList.remove('class-card-expand--open');
    clearClassCardExpandLayoutModifiers(classCardExpandRoot);
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

    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');
    if (hero && heroImg && !heroImg.dataset.brpHeroBound) {
      heroImg.dataset.brpHeroBound = '1';
      heroImg.loading = 'lazy';
      heroImg.decoding = 'async';
      heroImg.addEventListener('error', () => {
        const fallback =
          typeof window.getProductPlaceholderImage === 'function'
            ? window.getProductPlaceholderImage()
            : '';
        const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
        if (token && heroImg.dataset.brpImgTokenRetry !== '1' && heroImg.src && !heroImg.src.startsWith('data:')) {
          try {
            const u = new URL(heroImg.src, window.location.href);
            const path = u.pathname || '';
            if (
              (path.includes('/api/assets/') || path.includes('/apiserver/api/assets/')) &&
              !u.searchParams.has('access_token')
            ) {
              heroImg.dataset.brpImgTokenRetry = '1';
              u.searchParams.set('access_token', token);
              heroImg.src = u.toString();
              return;
            }
          } catch (_) {
            /* continue */
          }
        }
        if (heroImg.dataset.brpMediaFallback === '1') {
          heroImg.removeAttribute('src');
          hero.classList.add('class-card-expand__hero--empty');
          return;
        }
        if (fallback && heroImg.src !== fallback) {
          heroImg.dataset.brpMediaFallback = '1';
          heroImg.src = fallback;
          return;
        }
        heroImg.removeAttribute('src');
        hero.classList.add('class-card-expand__hero--empty');
      });
    }

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
    const avail = formatGroupActivitySlotsAvailability(activity.slots);
    const extra = [avail].filter(Boolean).join(' · ');
    if (extra) lines.push(extra);
    const loc = groupActivityBrowseLocationLabel(activity, gymSel);
    if (loc) lines.push(loc);
    return lines.join('\n');
  }

  function appendClassCardDurationAvailability(main, startIso, endIso, ctx) {
    if (!main) return;
    const sourceName = String(
      ctx?.source?.name || ctx?.booking?.name || ctx?.booking?.groupActivity?.name || ''
    ).trim();
    const normalizedName = sourceName.toLowerCase().replace(/\s+/g, '');
    if (!normalizedName.includes('introhold')) return;

    const slots = ctx && typeof ctx === 'object' ? ctx.slots : null;
    const leftRaw = slots?.leftToBookIncDropin ?? slots?.leftToBook ?? slots?.available ?? slots?.left;
    const totalRaw = slots?.total ?? slots?.totalBookable;
    const left = leftRaw != null ? Number(leftRaw) : NaN;
    const total = totalRaw != null ? Number(totalRaw) : NaN;
    if (Number.isFinite(left) && Number.isFinite(total) && total > 0) {
      const wrap = document.createElement('div');
      wrap.className = 'booking-item-card__availability';
      const dots = document.createElement('div');
      dots.className = 'booking-item-card__availability-dots';
      const visibleDots = Math.max(1, Math.min(10, Math.round(total)));
      const used = Math.max(0, total - left);
      const fillRatio = Math.max(0, Math.min(1, used / total));
      const filledDots = Math.max(0, Math.min(visibleDots, Math.round(fillRatio * visibleDots)));
      dots.setAttribute(
        'aria-label',
        left <= 0 ? 'Fully booked' : `${left} of ${total} spots left`
      );
      dots.setAttribute('role', 'img');
      for (let i = 0; i < visibleDots; i += 1) {
        const dot = document.createElement('span');
        dot.className = `booking-item-card__availability-dot${
          i < filledDots ? ' booking-item-card__availability-dot--filled' : ''
        }`;
        dots.appendChild(dot);
      }
      const label = document.createElement('span');
      label.className = 'booking-item-card__availability-label';
      label.textContent = left <= 0 ? 'full' : `${left} left`;
      wrap.append(dots, label);
      main.appendChild(wrap);
      return;
    }
    const avail = formatClassCardAvailabilityFromContext(ctx || {});
    if (!avail) return;
    const sub = document.createElement('div');
    sub.className = 'booking-item-card__submeta';
    sub.textContent = avail;
    main.appendChild(sub);
  }

  function buildBookingExpandLines(book) {
    if (Array.isArray(book?.__seriesBookings) && book.__seriesBookings.length > 1) {
      const rows = [...book.__seriesBookings]
        .sort((a, b) => brpBookingStartMs(a) - brpBookingStartMs(b))
        .map((rec, idx, arr) => {
          const startIso =
            rec.duration?.start ||
            rec.startTime ||
            rec.startDateTime ||
            rec.dateTime ||
            rec.scheduledStart ||
            rec.date ||
            rec.start;
          const endIso = rec.duration?.end || rec.endTime || rec.endDateTime || null;
          return `Session ${idx + 1}/${arr.length} · ${formatClassSessionWhenLine(
            typeof startIso === 'string' ? startIso : '',
            typeof endIso === 'string' ? endIso : null
          )}`;
        });
      const { where } = bookingDisplayLine(book);
      if (where) rows.push(where);
      return rows.join('\n');
    }
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
    const avail = formatClassCardAvailabilityFromContext({ slots: book.slots, booking: book });
    const extra = [avail].filter(Boolean).join(' · ');
    if (extra) lines.push(extra);
    const { where } = bookingDisplayLine(book);
    if (where) lines.push(where);
    return lines.join('\n');
  }

  function browseBookingConfirmationInfo(activity, gymSel) {
    const startIso = activity?.duration?.start;
    const endIso = activity?.duration?.end || null;
    const when = formatClassSessionWhenLine(
      typeof startIso === 'string' ? startIso : '',
      typeof endIso === 'string' ? endIso : null
    );
    const location = groupActivityBrowseLocationLabel(activity, gymSel) || 'Location not available';
    return {
      when: when && when !== '—' ? when : 'Date and time not available',
      location,
    };
  }

  function renderBrowseBookingConfirmation(actionsEl, activity, gymSel) {
    if (!actionsEl) return;
    if (isLikelySeriesSession(activity)) {
      actionsEl.innerHTML = '';
      const titleEl = document.createElement('p');
      titleEl.className = 'class-card-expand__hint';
      titleEl.style.marginBottom = '6px';
      titleEl.textContent = 'This class is part of a multi-session course.';
      actionsEl.appendChild(titleEl);

      const detailsEl = document.createElement('p');
      detailsEl.className = 'class-card-expand__muted';
      detailsEl.style.marginBottom = '12px';
      detailsEl.textContent = 'Please book the course series card to join all sessions.';
      actionsEl.appendChild(detailsEl);

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
      backBtn.textContent = 'Back';
      backBtn.addEventListener('click', () => openClassCardExpandBrowse(activity, gymSel));
      actionsEl.appendChild(backBtn);
      return;
    }
    const fully = isBrowseSlotsFullyBooked(activity?.slots);
    const allowWaitingList = fully;
    const title = allowWaitingList ? 'Join waiting list?' : 'Confirm booking?';
    const confirmLabel = allowWaitingList ? 'Confirm waitlist' : 'Confirm booking';
    const { when, location } = browseBookingConfirmationInfo(activity, gymSel);

    actionsEl.innerHTML = '';

    const titleEl = document.createElement('p');
    titleEl.className = 'class-card-expand__hint';
    titleEl.style.marginBottom = '6px';
    titleEl.textContent = title;
    actionsEl.appendChild(titleEl);

    const detailsEl = document.createElement('p');
    detailsEl.className = 'class-card-expand__muted';
    detailsEl.style.marginBottom = '12px';
    detailsEl.textContent = `${when}\n${location}`;
    detailsEl.style.whiteSpace = 'pre-line';
    actionsEl.appendChild(detailsEl);

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'profile-action-btn class-card-expand__btn-primary';
    confirmBtn.textContent = confirmLabel;
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      const shouldBlock = await shouldBlockDirectSessionBooking(activity);
      if (shouldBlock) {
        actionsEl.innerHTML = '';
        const titleBlocked = document.createElement('p');
        titleBlocked.className = 'class-card-expand__hint';
        titleBlocked.style.marginBottom = '6px';
        titleBlocked.textContent = 'This class is part of a multi-session course.';
        actionsEl.appendChild(titleBlocked);

        const detailsBlocked = document.createElement('p');
        detailsBlocked.className = 'class-card-expand__muted';
        detailsBlocked.style.marginBottom = '12px';
        detailsBlocked.textContent = 'Please book the course series card to join all sessions.';
        actionsEl.appendChild(detailsBlocked);

        const backBlocked = document.createElement('button');
        backBlocked.type = 'button';
        backBlocked.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
        backBlocked.textContent = 'Back';
        backBlocked.addEventListener('click', () => openClassCardExpandBrowse(activity, gymSel));
        actionsEl.appendChild(backBlocked);
        showToast(
          'This class cannot be booked directly. If it is part of a multi-session course, please book the course series card.',
          'error'
        );
        return;
      }
      runBrowseBookCommit(activity, allowWaitingList, confirmBtn);
    });
    actionsEl.appendChild(confirmBtn);

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    backBtn.textContent = 'Back';
    backBtn.addEventListener('click', () => openClassCardExpandBrowse(activity, gymSel));
    actionsEl.appendChild(backBtn);
  }

  function openDropInClassInfoExpand(activity, gymSel) {
    const root = ensureClassCardExpandRoot();
    clearClassCardExpandLayoutModifiers(root);
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const info = browseBookingConfirmationInfo(activity, gymSel);

    titleEl.textContent = 'No need to book this class, just show up!';
    linesEl.textContent = `${info.when}\n${info.location}`;
    resetClassCardExpandDescEl(descEl);
    descEl.textContent = 'This is a drop-in class and cannot be booked in advance.';
    actionsEl.innerHTML = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'profile-action-btn class-card-expand__btn-primary';
    closeBtn.textContent = 'Got it';
    closeBtn.addEventListener('click', () => closeClassCardExpand());
    actionsEl.appendChild(closeBtn);
  }

  function resetClassCardExpandDescEl(descEl) {
    if (!descEl) return;
    descEl.className = 'class-card-expand__desc';
    descEl.removeAttribute('role');
    descEl.textContent = '';
  }

  function renderClassExpandDescSkeleton(descEl) {
    if (!descEl) return;
    resetClassCardExpandDescEl(descEl);
    descEl.classList.add('class-card-expand__desc--loading');
    descEl.innerHTML =
      '<span class="class-card-expand__skeleton-line"></span>' +
      '<span class="class-card-expand__skeleton-line class-card-expand__skeleton-line--short"></span>' +
      '<span class="class-card-expand__skeleton-line"></span>' +
      '<span class="class-card-expand__skeleton-line class-card-expand__skeleton-line--mid"></span>';
  }

  function clearClassExpandDescSkeleton(descEl) {
    if (!descEl) return;
    descEl.classList.remove('class-card-expand__desc--loading');
    descEl.innerHTML = '';
  }

  function renderBrowseCardsSkeleton(container, count = 8) {
    if (!container) return;
    container.innerHTML = '';
    const n = Math.max(2, Math.min(12, Number(count) || 8));
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i += 1) {
      const card = document.createElement('div');
      card.className = 'booking-item-card booking-item-card--browse booking-item-card--skeleton';
      const media = document.createElement('div');
      media.className = 'booking-item-card__media booking-item-card__media--skeleton';
      const main = document.createElement('div');
      main.className = 'booking-item-card__main';

      const line1 = document.createElement('span');
      line1.className = 'booking-item-card__skeleton-line booking-item-card__skeleton-line--title';
      const line2 = document.createElement('span');
      line2.className = 'booking-item-card__skeleton-line booking-item-card__skeleton-line--meta';
      const line3 = document.createElement('span');
      line3.className = 'booking-item-card__skeleton-line booking-item-card__skeleton-line--sub';
      const line4 = document.createElement('span');
      line4.className = 'booking-item-card__skeleton-line booking-item-card__skeleton-line--subshort';

      main.append(line1, line2, line3, line4);
      card.append(media, main);
      frag.appendChild(card);
    }
    container.appendChild(frag);
  }

  async function runBrowseBookCommit(activity, allowWaitingList, primaryBtn) {
    if (await shouldBlockDirectSessionBooking(activity)) {
      showToast(
        'This class cannot be booked directly. If it is part of a multi-session course, please book the course series card.',
        'error'
      );
      return;
    }
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
      const status = Number(err?.status);
      if (status === 403) {
        showToast(
          'This class cannot be booked directly. If it is part of a multi-session course, please book the course series card.',
          'error'
        );
      } else {
        showToast(getErrorMessage(err), 'error');
      }
    } finally {
      primaryBtn.disabled = false;
    }
  }

  function openClassCardExpandBrowse(activity, gymSel) {
    const root = ensureClassCardExpandRoot();
    clearClassCardExpandLayoutModifiers(root);
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');
    const browseTitle = activity.name || 'Class';

    titleEl.textContent = browseTitle;
    linesEl.textContent = buildBrowseExpandLines(activity, gymSel);
    resetClassCardExpandDescEl(descEl);
    actionsEl.innerHTML = '';

    hero.classList.remove('class-card-expand__hero--empty');
    const primaryUrl = resolveGroupActivityClassImageUrl(activity);
    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    const productIdForHero = extractGroupActivityProductId(activity);
    const buIdForHero = classCardBusinessUnitId(activity);
    const customerIdForHero = getBrpNumericCustomerId(getBestCustomerData());
    heroImg.alt = browseTitle;
    if (primaryUrl || fallback) {
      applyClassCardImgSrc(heroImg, primaryUrl || fallback);
      hero.classList.toggle('class-card-expand__hero--empty', !(primaryUrl || fallback));
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }

    if (!primaryUrl && productIdForHero) {
      fetchGroupActivityProductDetail(productIdForHero, buIdForHero, customerIdForHero).then((detail) => {
        if (!heroImg.isConnected) return;
        const u = detail && resolveProductAssetImageUrl(detail);
        if (!u) return;
        hero.classList.remove('class-card-expand__hero--empty');
        applyClassCardImgSrc(heroImg, u);
      });
    }

    const ext = activity.externalMessage && String(activity.externalMessage).trim();
    if (ext) {
      clearClassExpandDescSkeleton(descEl);
      descEl.textContent = ext;
    } else {
      renderClassExpandDescSkeleton(descEl);
    }
    const productId = extractGroupActivityProductId(activity);
    const buId = classCardBusinessUnitId(activity);
    const customerId = getBrpNumericCustomerId(getBestCustomerData());
    if (productId) {
      fetchGroupActivityProductDetail(productId, buId, customerId).then((detail) => {
        if (!descEl.isConnected) return;
        const pd = detail?.description && String(detail.description).trim();
        const parts = [ext, pd].filter(Boolean);
        clearClassExpandDescSkeleton(descEl);
        descEl.textContent = parts.length ? parts.join('\n\n') : 'No description for this class.';
      });
    } else if (!ext) {
      clearClassExpandDescSkeleton(descEl);
      descEl.textContent = 'No description for this class.';
    }

    const fully = isBrowseSlotsFullyBooked(activity.slots);
    const wl = activity.slots && activity.slots.hasWaitingList === true;
    const dropInOnly = isDropInOnlyClass(activity);

    if (!isUserAuthenticated()) {
      const hint = document.createElement('p');
      hint.className = 'class-card-expand__hint';
      hint.textContent = 'Log in to book this class.';
      actionsEl.appendChild(hint);
    } else if (dropInOnly) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-action-btn class-card-expand__btn-primary';
      btn.textContent = 'Drop In class';
      btn.addEventListener('click', () => openDropInClassInfoExpand(activity, gymSel));
      actionsEl.appendChild(btn);
    } else if (isLikelySeriesSession(activity)) {
      const p = document.createElement('p');
      p.className = 'class-card-expand__muted';
      p.textContent = 'This session belongs to a multi-session course. Please book the course series card.';
      actionsEl.appendChild(p);
    } else if (fully && wl) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-action-btn class-card-expand__btn-primary';
      btn.textContent = 'Join waiting list';
      btn.addEventListener('click', () => renderBrowseBookingConfirmation(actionsEl, activity, gymSel));
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
      btn.addEventListener('click', () => renderBrowseBookingConfirmation(actionsEl, activity, gymSel));
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
    clearClassCardExpandLayoutModifiers(root);
    const { title } = bookingDisplayLine(book);
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');

    titleEl.textContent = title;
    linesEl.textContent = buildBookingExpandLines(book);
    resetClassCardExpandDescEl(descEl);
    actionsEl.innerHTML = '';

    hero.classList.remove('class-card-expand__hero--empty');
    const primaryUrl = resolveGroupActivityClassImageUrl(book);
    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    const productIdForHero = extractGroupActivityProductId(book);
    const buIdForHero = classCardBusinessUnitId(book);
    const customerIdForHero = getBrpNumericCustomerId(getBestCustomerData());
    heroImg.alt = title;
    if (primaryUrl || fallback) {
      applyClassCardImgSrc(heroImg, primaryUrl || fallback);
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }

    if (!primaryUrl && productIdForHero) {
      fetchGroupActivityProductDetail(productIdForHero, buIdForHero, customerIdForHero).then((detail) => {
        if (!heroImg.isConnected) return;
        const u = detail && resolveProductAssetImageUrl(detail);
        if (!u) return;
        hero.classList.remove('class-card-expand__hero--empty');
        applyClassCardImgSrc(heroImg, u);
      });
    }
    if (!primaryUrl && Array.isArray(book?.__seriesBookings) && book.__seriesBookings.length) {
      const firstWithImage = book.__seriesBookings.find((rec) => resolveGroupActivityClassImageUrl(rec));
      const firstSeries = firstWithImage || book.__seriesBookings[0];
      const seriesUrl = firstSeries ? resolveGroupActivityClassImageUrl(firstSeries) : '';
      if (seriesUrl) {
        hero.classList.remove('class-card-expand__hero--empty');
        applyClassCardImgSrc(heroImg, seriesUrl);
      } else {
        resolveBookedClassImageUrlFromEvents(firstSeries || book).then((url) => {
          if (!url || !heroImg.isConnected) return;
          hero.classList.remove('class-card-expand__hero--empty');
          applyClassCardImgSrc(heroImg, url);
        });
      }
    }

    const bMsg =
      (book.externalMessage && String(book.externalMessage).trim()) ||
      (book.groupActivity?.externalMessage && String(book.groupActivity.externalMessage).trim()) ||
      '';
    if (bMsg) {
      descEl.textContent = bMsg;
    } else if (Array.isArray(book?.__seriesBookings) && book.__seriesBookings.length > 1) {
      descEl.textContent =
        'You are booked for all sessions in this series. Use "Cancel full series" to remove every session.';
    } else {
      descEl.textContent =
        'You have a booking for this class. Times and location are shown above.';
    }

    const isSeriesModal = Array.isArray(book?.__seriesBookings) && book.__seriesBookings.length > 1;
    const bookingId = bookingIdValue(book);
    const seriesHintText = String(book?.externalMessage || book?.groupActivity?.externalMessage || '');
    const seriesLooksLike =
      isSeriesModal ||
      Number.isFinite(bookingEventIdValue(book)) ||
      hasSeriesCopyHint(seriesHintText);

    const cancelFullSeries = async (seriesBookings, buttonEl) => {
      const cid = getBrpNumericCustomerId(getBestCustomerData());
      if (!cid) {
        showToast('Log in to manage bookings.', 'error');
        return;
      }
      buttonEl.disabled = true;
      try {
        const title = bookingDisplayLine(book).title;
        const buId = classCardBusinessUnitId(book);
        const firstStart = brpBookingStartMs(seriesBookings[0]);
        const lastStart = brpBookingStartMs(seriesBookings[seriesBookings.length - 1]);
        const startIso = Number.isFinite(firstStart)
          ? new Date(firstStart - 7 * 24 * 60 * 60 * 1000).toISOString()
          : undefined;
        const endIso = Number.isFinite(lastStart)
          ? new Date(lastStart + 7 * 24 * 60 * 60 * 1000).toISOString()
          : undefined;
        if (authAPI?.listCustomerEventBookings && authAPI?.cancelCustomerEventBooking) {
          const eventBookings = await authAPI.listCustomerEventBookings(cid, {
            periodStart: startIso,
            periodEnd: endIso,
          });
          const normalize = (s) =>
            String(s || '')
              .toLowerCase()
              .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          const targetName = normalize(title);
          const match = (Array.isArray(eventBookings) ? eventBookings : []).find((evb) => {
            const evName = normalize(evb?.event?.name || evb?.name);
            if (!evName) return false;
            const sameName = evName === targetName || evName.includes(targetName) || targetName.includes(evName);
            if (!sameName) return false;
            const evBu = Number(evb?.businessUnit?.id);
            if (buId && Number.isFinite(evBu) && evBu !== buId) return false;
            return true;
          });
          const eventBookingId = Number(match?.id);
          if (Number.isFinite(eventBookingId) && eventBookingId > 0) {
            await authAPI.cancelCustomerEventBooking(cid, eventBookingId, { tryToRefund: false });
            showToast('Series bookings cancelled.', 'success');
            closeClassCardExpand();
            ensureGroupActivityBookingsLoaded().then(() => {
              refreshClassesBookingsLists();
              refreshDashboardPanels();
            });
            applyBrowseClassFilters();
            return;
          }
        }
        // Fallback: cancel each session booking one by one.
        for (const rec of seriesBookings) {
          const bid = bookingIdValue(rec);
          if (!bid) continue;
          await authAPI.cancelCustomerGroupActivityBooking(cid, bid, {
            tryToRefund: false,
            bookingType: 'groupActivityBooking',
          });
        }
        showToast('Series bookings cancelled.', 'success');
        closeClassCardExpand();
        ensureGroupActivityBookingsLoaded().then(() => {
          refreshClassesBookingsLists();
          refreshDashboardPanels();
        });
        applyBrowseClassFilters();
      } catch (err) {
        if (Number(err?.status) === 403) {
          showToast('You do not have permission to perform this action.', 'error');
        } else {
          showToast(getErrorMessage(err), 'error');
        }
      } finally {
        buttonEl.disabled = false;
      }
    };
    if (
      isUserAuthenticated() &&
      Number.isFinite(bookingId) &&
      bookingId > 0 &&
      authAPI?.cancelCustomerGroupActivityBooking
    ) {
      if (!seriesLooksLike) {
        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
        cancelBtn.textContent = 'Cancel booking';
        cancelBtn.addEventListener('click', async () => {
          const confirmed = window.confirm('Cancel this booking?');
          if (!confirmed) return;
          const cid = getBrpNumericCustomerId(getBestCustomerData());
          if (!cid) {
            showToast('Log in to manage bookings.', 'error');
            return;
          }
          cancelBtn.disabled = true;
          try {
            await authAPI.cancelCustomerGroupActivityBooking(cid, bookingId, {
              tryToRefund: false,
              bookingType: 'groupActivityBooking',
            });
            showToast('Booking cancelled.', 'success');
            closeClassCardExpand();
            ensureGroupActivityBookingsLoaded().then(() => {
              refreshClassesBookingsLists();
              refreshDashboardPanels();
            });
            applyBrowseClassFilters();
          } catch (err) {
            showToast(getErrorMessage(err), 'error');
          } finally {
            cancelBtn.disabled = false;
          }
        });
        actionsEl.appendChild(cancelBtn);
      }

      const seriesBookings = getSeriesBookingsForBooking(book).filter((b) => bookingIdValue(b));
      if (seriesLooksLike || seriesBookings.length > 1) {
        const cancelSeriesBtn = document.createElement('button');
        cancelSeriesBtn.type = 'button';
        cancelSeriesBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
        cancelSeriesBtn.textContent =
          seriesBookings.length > 1
            ? `Cancel full series (${seriesBookings.length})`
            : 'Cancel series booking';
        cancelSeriesBtn.addEventListener('click', async () => {
          const count = Math.max(1, seriesBookings.length);
          const confirmed = window.confirm(
            count > 1
              ? `Cancel all ${count} booked sessions in this course series?`
              : 'Cancel this series booking?'
          );
          if (!confirmed) return;
          await cancelFullSeries(seriesBookings.length ? seriesBookings : [book], cancelSeriesBtn);
        });
        actionsEl.appendChild(cancelSeriesBtn);
      }
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
      if (e?.target && e.target.closest && e.target.closest('.dashboard-class-booked-details')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      openClassCardExpandBooking(book);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target instanceof HTMLElement && e.target.closest('.dashboard-class-booked-details summary')) {
        return;
      }
      e.preventDefault();
      open(e);
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

  function resolveSavedClassesOwnerKeys() {
    const ids = [];
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (cid) ids.push(String(cid));
    if (state?.customerId) ids.push(String(state.customerId));
    if (typeof getTokenMetadata === 'function') {
      const md = getTokenMetadata() || {};
      if (md?.username) ids.push(String(md.username));
      if (md?.userName) ids.push(String(md.userName));
    }
    const unique = Array.from(new Set(ids.filter(Boolean)));
    const primary = unique[0] || 'anon';
    const all = Array.from(new Set([primary, ...unique, 'anon']));
    return {
      primaryKey: `boulders:saved-classes:${primary}`,
      allKeys: all.map((id) => `boulders:saved-classes:${id}`),
    };
  }

  function loadSavedClasses() {
    try {
      const { primaryKey, allKeys } = resolveSavedClassesOwnerKeys();
      const merged = [];
      allKeys.forEach((k) => {
        const raw = localStorage.getItem(k);
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) merged.push(...parsed);
      });
      const deduped = [];
      const seen = new Set();
      merged.forEach((rec) => {
        if (!rec || !rec.key || seen.has(rec.key)) return;
        seen.add(rec.key);
        deduped.push(rec);
      });
      // Keep one canonical copy for this profile to avoid split lists.
      localStorage.setItem(primaryKey, JSON.stringify(deduped));
      return deduped;
    } catch {
      return [];
    }
  }

  function persistSavedClasses(list) {
    try {
      const { primaryKey } = resolveSavedClassesOwnerKeys();
      localStorage.setItem(primaryKey, JSON.stringify(Array.isArray(list) ? list : []));
    } catch (_) {
      // ignore quota/privacy mode errors
    }
  }

  function classSaveKey(source) {
    if (Array.isArray(source?.__seriesBookings) && source.__seriesBookings.length) {
      const bu = classCardBusinessUnitId(source);
      const name = normalizeSeriesNameForBookings(bookingDisplayLine(source).title);
      const first = bookingStartIsoValue(source.__seriesBookings[0]);
      const last = bookingStartIsoValue(source.__seriesBookings[source.__seriesBookings.length - 1]);
      return `series:${bu || 'x'}:${name}:${first}:${last}:${source.__seriesBookings.length}`;
    }
    const eventId = bookingEventIdValue(source);
    if (eventId) return `event:${eventId}`;
    const id = source?.id ?? source?.groupActivity?.id ?? source?.groupActivityBookingId;
    if (id != null) return `ga:${id}`;
    const { title, where } = bookingDisplayLine(source || {});
    return `fallback:${normalizeSeriesNameForBookings(title)}:${normalizeSeriesNameForBookings(where)}:${bookingStartIsoValue(source)}`;
  }

  function isClassSaved(source) {
    const key = classSaveKey(source);
    return loadSavedClasses().some((x) => x && x.key === key);
  }

  const MAX_SAVED_CLASS_SNAPSHOT_JSON = 200000;

  function safeCloneForSavedClassSnapshot(source) {
    if (!source || typeof source !== 'object') return null;
    try {
      const json = JSON.stringify(source);
      if (!json || json.length > MAX_SAVED_CLASS_SNAPSHOT_JSON) return null;
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /**
   * Opens expand from JSON stored at save time (browse / event card). Avoids schedule re-fetch mismatches.
   */
  function tryOpenSavedClassSnapshot(rec) {
    const snap = rec?.browseSnapshot;
    if (!snap || typeof snap !== 'object') return false;
    const gymSel = document.getElementById('browseGymFilter');
    try {
      if (Array.isArray(snap.__seriesBookings) && snap.__seriesBookings.length > 0) {
        openClassCardExpandBooking(snap);
        return true;
      }
      if (snap.__kind === 'event' || (snap.occasions && snap.__kind !== 'groupActivity')) {
        const ev = { ...snap };
        if (rec.buId && !classCardBusinessUnitId(ev)) ev.__buId = rec.buId;
        openEventExpand(ev);
        return true;
      }
      if (snap.__kind === 'groupActivity' || snap.slots != null || snap.groupActivity != null) {
        const activity = { ...snap };
        if (rec.buId && !classCardBusinessUnitId(activity)) activity.__buId = rec.buId;
        if (!activity.__kind) activity.__kind = 'groupActivity';
        openClassCardExpandBrowse(activity, gymSel);
        return true;
      }
    } catch (_) {
      return false;
    }
    return false;
  }

  function saveClassRecord(source, title, where, startIso, endIso, isSeries = false) {
    const key = classSaveKey(source);
    const imageUrl =
      resolveGroupActivityClassImageUrl(source) ||
      (typeof source?.__resolvedImageUrl === 'string' ? source.__resolvedImageUrl : '');
    const occasionSlots =
      isSeries && (source?.__kind === 'event' || source?.occasions)
        ? mapEventOccasionSlots(source)
        : [];
    const effectiveStart =
      (occasionSlots[0] && occasionSlots[0].start) || (typeof startIso === 'string' ? startIso : '') || '';
    const lastSlot = occasionSlots.length ? occasionSlots[occasionSlots.length - 1] : null;
    const effectiveEnd =
      (lastSlot && (lastSlot.end || lastSlot.start)) || (typeof endIso === 'string' ? endIso : '') || '';

    let seriesLines = [];
    if (isSeries && Array.isArray(source?.__seriesBookings) && source.__seriesBookings.length) {
      seriesLines = source.__seriesBookings.map((rec, idx, arr) => {
        const s = bookingStartIsoValue(rec);
        const e = rec.duration?.end || rec.endTime || rec.endDateTime || null;
        return `${idx + 1}/${arr.length} · ${formatClassSessionWhenLine(
          typeof s === 'string' ? s : '',
          typeof e === 'string' ? e : null
        )}`;
      });
    } else if (isSeries && occasionSlots.length) {
      const totalRaw = Number(source?.occasions?.numberOf);
      const total = Number.isFinite(totalRaw) && totalRaw > 0 ? totalRaw : occasionSlots.length;
      seriesLines = occasionSlots.map(({ start: s, end: e }, idx) => {
        const when = formatClassSessionWhenLine(s, e || null);
        return `${idx + 1}/${total} · ${when}`;
      });
    }

    const record = {
      key,
      title: String(title || 'Class'),
      where: where ? String(where) : '',
      buId: classCardBusinessUnitId(source) || null,
      productId: extractGroupActivityProductId(source) || null,
      kind:
        source?.__kind === 'event' || source?.occasions
          ? 'event'
          : source?.__kind === 'groupActivity'
            ? 'groupActivity'
            : 'unknown',
      startIso: effectiveStart,
      endIso: effectiveEnd,
      imageUrl: imageUrl || '',
      isSeries: !!isSeries,
      seriesCount:
        isSeries && Array.isArray(source?.__seriesBookings) && source.__seriesBookings.length
          ? source.__seriesBookings.length
          : isSeries
            ? Number(source?.occasions?.numberOf) || occasionSlots.length || 0
            : 0,
      seriesLines,
      savedAt: new Date().toISOString(),
    };
    if (
      source &&
      typeof source === 'object' &&
      (source.__kind === 'groupActivity' ||
        source.__kind === 'event' ||
        (source.occasions && !Array.isArray(source.__seriesBookings)))
    ) {
      const snap = safeCloneForSavedClassSnapshot(source);
      if (snap) record.browseSnapshot = snap;
    } else if (
      source &&
      typeof source === 'object' &&
      isSeries &&
      Array.isArray(source.__seriesBookings) &&
      source.__seriesBookings.length
    ) {
      const snap = safeCloneForSavedClassSnapshot(source);
      if (snap) record.browseSnapshot = snap;
    }
    const list = loadSavedClasses();
    const idx = list.findIndex((x) => x && x.key === key);
    if (idx >= 0) list[idx] = record;
    else list.unshift(record);
    persistSavedClasses(list);
  }

  async function resolveSavedRecordImageUrl(rec) {
    if (!rec || rec.imageUrl) return rec?.imageUrl || '';
    let buId = Number(rec?.buId);
    const startMs = Date.parse(rec?.startIso || '');
    if (!Number.isFinite(startMs)) {
      return '';
    }
    if ((!Number.isFinite(buId) || buId <= 0) && rec?.where && authAPI?.listVer3BusinessUnits) {
      try {
        const units = await authAPI.listVer3BusinessUnits();
        const want = String(rec.where).trim().toLowerCase();
        const hit = (Array.isArray(units) ? units : []).find((u) =>
          String(u?.name || u?.displayName || '').trim().toLowerCase() === want
        );
        const maybe = Number(hit?.id);
        if (Number.isFinite(maybe) && maybe > 0) buId = maybe;
      } catch {
        // ignore
      }
    }
    if (!Number.isFinite(buId) || buId <= 0) return '';
    try {
      const day = new Date(startMs);
      day.setHours(0, 0, 0, 0);
      const periodStart = new Date(day.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const periodEnd = new Date(day.getTime() + 3 * 24 * 60 * 60 * 1000 - 1).toISOString();
      const normalize = (s) =>
        String(s || '')
          .toLowerCase()
          .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      const targetName = normalize(rec?.title);
      const sameName = (name) => {
        const n = normalize(name);
        return n && (n === targetName || n.includes(targetName) || targetName.includes(n));
      };

      // 1) Prefer direct product lookup if available.
      const directProductId = Number(rec?.productId);
      if (Number.isFinite(directProductId) && directProductId > 0) {
        const customerId = getBrpNumericCustomerId(getBestCustomerData());
        if (rec?.kind === 'event') {
          const detail = await fetchEventProductDetail(directProductId, buId);
          const url = detail ? resolveProductAssetImageUrl(detail) : '';
          if (url) return url;
        } else {
          const detail = await fetchGroupActivityProductDetail(directProductId, buId, customerId);
          const url = detail ? resolveProductAssetImageUrl(detail) : '';
          if (url) return url;
        }
      }

      // 2) Group activity schedule around time window.
      if (authAPI?.listBusinessUnitGroupActivities) {
        const customerId = getBrpNumericCustomerId(getBestCustomerData());
        const acts = await authAPI.listBusinessUnitGroupActivities(buId, {
          periodStart,
          periodEnd,
          customerId: customerId || undefined,
        });
        const actMatch = (Array.isArray(acts) ? acts : []).find((a) => sameName(a?.name));
        if (actMatch) {
          let url = resolveGroupActivityClassImageUrl(actMatch);
          if (!url) {
            const productId = extractGroupActivityProductId(actMatch);
            if (productId) {
              const detail = await fetchGroupActivityProductDetail(productId, buId, customerId);
              url = detail ? resolveProductAssetImageUrl(detail) : '';
            }
          }
          if (url) return url;
        }
      }

      // 3) Event schedule fallback.
      if (authAPI?.listBusinessUnitEvents) {
        const events = await authAPI.listBusinessUnitEvents(buId, { periodStart, periodEnd });
        const match = (Array.isArray(events) ? events : []).find((ev) => sameName(ev?.name));
        if (match) {
          let url = resolveGroupActivityClassImageUrl(match);
          if (!url) {
            const productId = extractGroupActivityProductId(match);
            if (productId) {
              const detail = await fetchEventProductDetail(productId, buId);
              url = detail ? resolveProductAssetImageUrl(detail) : '';
            }
          }
          if (url) return url;
        }
      }
      return '';
    } catch {
      return '';
    }
  }

  function removeSavedClass(source) {
    const key = classSaveKey(source);
    persistSavedClasses(loadSavedClasses().filter((x) => x && x.key !== key));
  }

  function parseSavedClassKey(key) {
    if (!key || typeof key !== 'string') return { type: 'unknown' };
    if (key.startsWith('event:')) {
      const id = Number(key.slice(6));
      return { type: 'event', id: Number.isFinite(id) && id > 0 ? id : NaN };
    }
    if (key.startsWith('ga:')) {
      const id = Number(key.slice(3));
      return { type: 'ga', id: Number.isFinite(id) && id > 0 ? id : NaN };
    }
    if (key.startsWith('series:')) return { type: 'series' };
    if (key.startsWith('fallback:')) return { type: 'fallback' };
    return { type: 'unknown' };
  }

  async function resolveBuIdFromSavedRecord(rec) {
    let buId = Number(rec?.buId);
    if (Number.isFinite(buId) && buId > 0) return buId;
    if (rec?.where && authAPI?.listVer3BusinessUnits) {
      try {
        const units = await authAPI.listVer3BusinessUnits();
        const want = String(rec.where).trim().toLowerCase();
        const list = Array.isArray(units) ? units : [];
        const norm = (u) =>
          String(u?.name || u?.displayName || '')
            .trim()
            .toLowerCase();
        let hit = list.find((u) => norm(u) === want);
        if (!hit && want.length >= 4) {
          const partial = list
            .map((u) => ({ u, n: norm(u) }))
            .filter(({ n }) => n && (n.includes(want) || want.includes(n)));
          partial.sort((a, b) => b.n.length - a.n.length);
          hit = partial[0]?.u;
        }
        const maybe = Number(hit?.id);
        if (Number.isFinite(maybe) && maybe > 0) return maybe;
      } catch (_) {
        /* ignore */
      }
    }
    return null;
  }

  /**
   * Resolve a persisted saved-class record to a live browse activity (group or event) for expand + book.
   */
  async function resolveSavedRecordToLiveActivity(rec) {
    if (!rec || !rec.key) return null;
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    const buId = await resolveBuIdFromSavedRecord(rec);
    const startMs = Date.parse(rec.startIso || '');
    const parsed = parseSavedClassKey(rec.key);
    const EVENT_LOOKBACK_DAYS = 42;

    const scheduleWindow = () => {
      const now = Date.now();
      if (Number.isFinite(startMs)) {
        const d = new Date(startMs);
        d.setHours(0, 0, 0, 0);
        const savedStart = d.getTime() - 30 * 86400000;
        const savedEnd = d.getTime() + 30 * 86400000;
        // Always include a forward window from "now" so old saves still resolve recurring drop-ins.
        const nowStart = now - 7 * 86400000;
        const nowEnd = now + 120 * 86400000;
        return {
          periodStart: new Date(Math.min(savedStart, nowStart)).toISOString(),
          periodEnd: new Date(Math.max(savedEnd, nowEnd)).toISOString(),
        };
      }
      return {
        periodStart: new Date(now - 7 * 86400000).toISOString(),
        periodEnd: new Date(now + 120 * 86400000).toISOString(),
      };
    };
    const { periodStart, periodEnd } = scheduleWindow();
    const eventPeriodStart = new Date(
      Date.parse(periodStart) - EVENT_LOOKBACK_DAYS * 86400000
    ).toISOString();

    const normalize = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const nameMatches = (actName) => {
      const t = normalize(rec.title);
      const n = normalize(actName);
      return Boolean(t && n && (n === t || n.includes(t) || t.includes(n)));
    };

    function groupActivityBrowseTitle(a) {
      if (!a || typeof a !== 'object') return '';
      return (
        a.name ||
        a.groupActivity?.name ||
        a.title ||
        a.className ||
        a.activityName ||
        ''
      );
    }

    const withBu = (item, kind, buOverride) => {
      const out = { ...item, __kind: kind };
      const effectiveBu =
        buOverride != null && Number.isFinite(Number(buOverride)) && Number(buOverride) > 0
          ? Number(buOverride)
          : buId;
      if (!classCardBusinessUnitId(out) && effectiveBu) out.__buId = effectiveBu;
      return out;
    };

    /** Recurring classes get new group-activity ids per occurrence — pick next session or closest in time. */
    function pickBestGroupActivityOccurrence(activities, predicate) {
      const now = Date.now();
      const GRACE_MS = 20 * 60 * 1000;
      const candidates = (Array.isArray(activities) ? activities : [])
        .map((a) => {
          const s = bookingStartIsoValue(a);
          const t = typeof s === 'string' && s ? Date.parse(s) : NaN;
          return { a, t };
        })
        .filter((x) => Number.isFinite(x.t) && predicate(x.a, x.t));
      if (!candidates.length) return null;
      const upcoming = candidates.filter((x) => x.t >= now - GRACE_MS).sort((x, y) => x.t - y.t);
      if (upcoming.length) return upcoming[0].a;
      if (Number.isFinite(startMs)) {
        const sorted = [...candidates].sort((x, y) => Math.abs(x.t - startMs) - Math.abs(y.t - startMs));
        const best = sorted[0];
        if (best && Math.abs(best.t - startMs) < 80 * 86400000) return best.a;
      }
      return null;
    }

    if (
      parsed.type === 'ga' &&
      Number.isFinite(parsed.id) &&
      parsed.id > 0 &&
      buId &&
      authAPI?.listBusinessUnitGroupActivities
    ) {
      try {
        const acts = await authAPI.listBusinessUnitGroupActivities(buId, {
          periodStart,
          periodEnd,
          customerId: cid || undefined,
        });
        const list = Array.isArray(acts) ? acts : [];
        const byId = list.find((a) => Number(a?.id) === parsed.id);
        if (byId) return { item: withBu(byId, 'groupActivity'), kind: 'groupActivity' };
        const savedPid = Number(rec.productId);
        if (Number.isFinite(savedPid) && savedPid > 0) {
          const byProduct = pickBestGroupActivityOccurrence(list, (a) => extractGroupActivityProductId(a) === savedPid);
          if (byProduct) return { item: withBu(byProduct, 'groupActivity'), kind: 'groupActivity' };
        }
        const byName = pickBestGroupActivityOccurrence(list, (a) => nameMatches(groupActivityBrowseTitle(a)));
        if (byName) return { item: withBu(byName, 'groupActivity'), kind: 'groupActivity' };
      } catch (_) {
        /* continue */
      }
    }

    if (
      parsed.type === 'event' &&
      Number.isFinite(parsed.id) &&
      parsed.id > 0 &&
      buId &&
      authAPI?.listBusinessUnitEvents
    ) {
      try {
        const evs = await authAPI.listBusinessUnitEvents(buId, {
          periodStart: eventPeriodStart,
          periodEnd,
        });
        const list = Array.isArray(evs) ? evs : [];
        const byId = list.find((ev) => Number(ev?.id) === parsed.id);
        if (byId) return { item: withBu(byId, 'event'), kind: 'event' };
        const byNameEv = pickBestEventOccurrence(list, (ev) => nameMatches(ev?.name));
        if (byNameEv) return { item: withBu(byNameEv, 'event'), kind: 'event' };
      } catch (_) {
        /* continue */
      }
    }

    if (buId && rec.isSeries && authAPI?.listBusinessUnitEvents) {
      try {
        const evs = await authAPI.listBusinessUnitEvents(buId, {
          periodStart: eventPeriodStart,
          periodEnd,
        });
        const list = Array.isArray(evs) ? evs : [];
        const hit = list.find((ev) => {
          if (!isGroupedEventSeries(ev) || !nameMatches(ev?.name)) return false;
          const startStr = bookingStartIsoValue(ev);
          const a = typeof startStr === 'string' && startStr ? Date.parse(startStr) : NaN;
          const b = Date.parse(ev?.duration?.end || '');
          if (!Number.isFinite(a)) return false;
          if (!Number.isFinite(startMs)) return true;
          const endOk = Number.isFinite(b) ? b : a + 120 * 86400000;
          return startMs >= a && startMs <= endOk;
        });
        if (hit) return { item: withBu(hit, 'event'), kind: 'event' };
      } catch (_) {
        /* continue */
      }
    }

    function pickBestEventOccurrence(events, predicate) {
      const now = Date.now();
      const GRACE_MS = 20 * 60 * 1000;
      const candidates = (Array.isArray(events) ? events : [])
        .map((ev) => {
          const s = bookingStartIsoValue(ev);
          const t = typeof s === 'string' && s ? Date.parse(s) : NaN;
          return { ev, t };
        })
        .filter((x) => Number.isFinite(x.t) && predicate(x.ev, x.t));
      if (!candidates.length) return null;
      const upcoming = candidates.filter((x) => x.t >= now - GRACE_MS).sort((x, y) => x.t - y.t);
      if (upcoming.length) return upcoming[0].ev;
      if (Number.isFinite(startMs)) {
        const sorted = [...candidates].sort((x, y) => Math.abs(x.t - startMs) - Math.abs(y.t - startMs));
        const best = sorted[0];
        if (best && Math.abs(best.t - startMs) < 80 * 86400000) return best.ev;
      }
      return null;
    }

    if (
      buId &&
      (rec.kind === 'event' || parsed.type === 'event' || parsed.type === 'unknown') &&
      authAPI?.listBusinessUnitEvents
    ) {
      try {
        const evs = await authAPI.listBusinessUnitEvents(buId, {
          periodStart: eventPeriodStart,
          periodEnd,
        });
        const list = Array.isArray(evs) ? evs : [];
        const hit = pickBestEventOccurrence(list, (ev) => nameMatches(ev?.name));
        if (hit) return { item: withBu(hit, 'event'), kind: 'event' };
      } catch (_) {
        /* continue */
      }
    }

    async function attemptMatchGroupActivitiesAtBu(tryBu, opts) {
      if (!tryBu || !authAPI?.listBusinessUnitGroupActivities) return null;
      try {
        const acts = await authAPI.listBusinessUnitGroupActivities(tryBu, opts);
        const list = Array.isArray(acts) ? acts : [];
        const savedPid = Number(rec.productId);
        if (Number.isFinite(savedPid) && savedPid > 0) {
          const byProduct = pickBestGroupActivityOccurrence(list, (a) => extractGroupActivityProductId(a) === savedPid);
          if (byProduct) return { item: withBu(byProduct, 'groupActivity', tryBu), kind: 'groupActivity' };
        }
        const byName = pickBestGroupActivityOccurrence(list, (a) => nameMatches(groupActivityBrowseTitle(a)));
        if (byName) return { item: withBu(byName, 'groupActivity', tryBu), kind: 'groupActivity' };
      } catch (_) {
        /* ignore */
      }
      return null;
    }

    if (rec.kind !== 'event' && authAPI?.listBusinessUnitGroupActivities) {
      const buQueue = [];
      if (Number.isFinite(buId) && buId > 0) buQueue.push(buId);
      const homeBuId = Number(getBestCustomerData()?.businessUnit?.id);
      if (Number.isFinite(homeBuId) && homeBuId > 0 && !buQueue.includes(homeBuId)) {
        buQueue.push(homeBuId);
      }
      if (authAPI.listVer3BusinessUnits) {
        try {
          const units = await authAPI.listVer3BusinessUnits();
          for (const u of Array.isArray(units) ? units : []) {
            const id = Number(u?.id);
            if (!Number.isFinite(id) || id <= 0) continue;
            if (!buQueue.includes(id)) buQueue.push(id);
            if (buQueue.length >= 10) break;
          }
        } catch (_) {
          /* ignore */
        }
      }
      for (let bi = 0; bi < buQueue.length; bi += 1) {
        const tryBu = buQueue[bi];
        const fetchPlans =
          bi === 0
            ? [
                { periodStart, periodEnd, customerId: cid || undefined },
                { periodStart, periodEnd },
                {},
              ]
            : [{ periodStart, periodEnd }, {}];
        for (const opts of fetchPlans) {
          const hit = await attemptMatchGroupActivitiesAtBu(tryBu, opts);
          if (hit) return hit;
        }
      }
    }

    return null;
  }

  function openSavedRecordFallbackExpand(savedRec) {
    const root = ensureClassCardExpandRoot();
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');

    titleEl.textContent = savedRec?.title || 'Saved class';
    const when =
      savedRec?.isSeries && Array.isArray(savedRec?.seriesLines) && savedRec.seriesLines.length
        ? savedRec.seriesLines.join('\n')
        : formatClassSessionWhenLine(savedRec?.startIso || '', savedRec?.endIso || null);
    const bits = [when, savedRec?.where ? `Location: ${savedRec.where}` : ''].filter(Boolean);
    linesEl.textContent = bits.join('\n');
    resetClassCardExpandDescEl(descEl);
    descEl.classList.add('class-card-expand__desc--notice');
    descEl.setAttribute('role', 'status');
    const noticeLead = document.createElement('p');
    noticeLead.className = 'class-card-expand__desc-notice-lead';
    noticeLead.textContent = 'We could not find this class on the current schedule.';
    const noticeBody = document.createElement('p');
    noticeBody.className = 'class-card-expand__desc-notice-body';
    noticeBody.textContent =
      'It may have moved or ended. Browse classes to find it, or open your full saved list.';
    descEl.append(noticeLead, noticeBody);
    actionsEl.innerHTML = '';

    const browseBtn = document.createElement('button');
    browseBtn.type = 'button';
    browseBtn.className = 'profile-action-btn class-card-expand__btn-primary';
    browseBtn.textContent = 'Browse classes';
    browseBtn.addEventListener('click', () => {
      closeClassCardExpand();
      openClassesBrowseTab();
    });
    actionsEl.appendChild(browseBtn);

    const savedBtn = document.createElement('button');
    savedBtn.type = 'button';
    savedBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    savedBtn.textContent = 'View saved list';
    savedBtn.addEventListener('click', () => {
      closeClassCardExpand();
      openSavedBookingsTab();
    });
    actionsEl.appendChild(savedBtn);

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => closeClassCardExpand());
    actionsEl.appendChild(closeBtn);

    heroImg.alt = savedRec?.title || '';
    if (savedRec?.imageUrl) {
      hero.classList.remove('class-card-expand__hero--empty');
      applyClassCardImgSrc(heroImg, savedRec.imageUrl);
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }

    root.classList.add('class-card-expand--saved-fallback');
    root.classList.add('class-card-expand--open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('class-card-expand-open');
    requestAnimationFrame(() => {
      root.querySelector('.class-card-expand__close')?.focus();
    });
  }

  function attachDashboardSavedReminderRow(row, savedRec) {
    row.classList.add('dashboard-saved-reminder__item--clickable');
    row.setAttribute('role', 'button');
    row.setAttribute('tabindex', '0');
    row.setAttribute('aria-haspopup', 'dialog');
    row.setAttribute(
      'aria-label',
      `${savedRec?.title || 'Saved class'} — view details and book if available`
    );

    const activate = async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (row.classList.contains('is-resolving-saved-class')) return;
      row.classList.add('is-resolving-saved-class');
      try {
        if (tryOpenSavedClassSnapshot(savedRec)) {
          return;
        }
        const resolved = await resolveSavedRecordToLiveActivity(savedRec);
        const gymSel = document.getElementById('browseGymFilter');
        if (resolved?.kind === 'event' && resolved.item) {
          openEventExpand(resolved.item);
        } else if (resolved?.kind === 'groupActivity' && resolved.item) {
          openClassCardExpandBrowse(resolved.item, gymSel);
        } else {
          openSavedRecordFallbackExpand(savedRec);
        }
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        openSavedRecordFallbackExpand(savedRec);
      } finally {
        row.classList.remove('is-resolving-saved-class');
      }
    };

    row.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('.dashboard-saved-reminder__series-details')) {
        return;
      }
      void activate(e);
    });
    row.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (e.target instanceof HTMLElement && e.target.closest('summary')) return;
      e.preventDefault();
      void activate(e);
    });
  }

  function appendSaveButtonToCardMain(main, source, meta) {
    if (!main) return null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'booking-item-card__save-btn';
    const sync = () => {
      const saved = isClassSaved(source);
      btn.classList.toggle('is-saved', saved);
      btn.setAttribute('aria-pressed', saved ? 'true' : 'false');
      btn.textContent = saved ? 'Saved' : 'Save class';
      btn.title = saved ? 'Remove from saved' : 'Save class';
    };
    sync();
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const saved = isClassSaved(source);
      if (saved) {
        removeSavedClass(source);
      } else {
        saveClassRecord(
          source,
          meta?.title || bookingDisplayLine(source).title,
          meta?.where || bookingDisplayLine(source).where,
          meta?.startIso || bookingStartIsoValue(source),
          meta?.endIso || source?.duration?.end || source?.endTime || source?.endDateTime || '',
          !!meta?.isSeries
        );
      }
      sync();
      renderSavedBookingsList();
    });
    let pills = main.querySelector('.booking-item-card__pills');
    if (!pills) {
      pills = document.createElement('div');
      pills.className = 'booking-item-card__pills';
      main.appendChild(pills);
    }
    pills.appendChild(btn);
    return btn;
  }

  function renderSavedBookingsList() {
    const container = document.getElementById('savedBookingsList');
    if (!container) return;
    const list = loadSavedClasses();
    container.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'bookings-empty-msg';
      p.textContent = 'No saved classes yet.';
      container.appendChild(p);
      return;
    }
    list.forEach((rec) => {
      const card = document.createElement('div');
      card.className = 'booking-item-card';
      const mediaSource = rec?.imageUrl ? { __resolvedImageUrl: rec.imageUrl } : {};
      card.appendChild(createClassCardMediaEl(mediaSource, rec?.title || 'Class'));
      const main = document.createElement('div');
      main.className = 'booking-item-card__main';
      const h = document.createElement('strong');
      h.className = 'booking-item-card__title';
      h.textContent = rec?.title || 'Class';
      const meta = document.createElement('div');
      meta.className = 'booking-item-card__meta';
      meta.textContent =
        rec?.isSeries && Array.isArray(rec?.seriesLines) && rec.seriesLines.length
          ? `${rec.seriesCount || rec.seriesLines.length} sessions saved`
          : formatClassSessionWhenLine(rec?.startIso || '', rec?.endIso || null);
      main.append(h, meta);
      if (rec?.where) {
        appendLocationPillToCardMain(main, rec.where);
      }
      if (rec?.isSeries && Array.isArray(rec?.seriesLines) && rec.seriesLines.length) {
        const rows = document.createElement('div');
        rows.className = 'booking-item-card__series-list';
        rec.seriesLines.forEach((line) => {
          const row = document.createElement('div');
          row.className = 'booking-item-card__series-row';
          row.textContent = line;
          rows.appendChild(row);
        });
        main.appendChild(rows);
      }
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
      saveBtn.textContent = 'Remove';
      saveBtn.addEventListener('click', () => {
        persistSavedClasses(loadSavedClasses().filter((x) => x && x.key !== rec.key));
        renderSavedBookingsList();
      });
      main.appendChild(saveBtn);
      card.appendChild(main);
      container.appendChild(card);
      if (!rec?.imageUrl) {
        resolveSavedRecordImageUrl(rec).then((url) => {
          if (!url || !card.isConnected) return;
          const current = loadSavedClasses();
          const idx = current.findIndex((x) => x && x.key === rec.key);
          if (idx < 0) return;
          current[idx] = { ...current[idx], imageUrl: url };
          persistSavedClasses(current);
          const media = card.querySelector('.booking-item-card__media');
          if (!media) return;
          media.replaceWith(createClassCardMediaEl({ __resolvedImageUrl: url }, rec?.title || 'Class'));
        });
      }
    });
  }

  function bookingIdValue(b) {
    const raw =
      b?.id ??
      b?.groupActivityBooking?.id ??
      b?.groupActivityBookingId ??
      b?.bookingId;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function bookingEventIdValue(b) {
    const raw =
      b?.event?.id ??
      b?.groupActivity?.event?.id ??
      b?.eventId ??
      b?.groupActivity?.eventId;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function normalizeSeriesNameForBookings(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getSeriesBookingsForBooking(targetBooking) {
    if (Array.isArray(targetBooking?.__seriesBookings) && targetBooking.__seriesBookings.length) {
      return targetBooking.__seriesBookings;
    }
    const list = Array.isArray(getBestCustomerData()?.groupActivityBookings)
      ? getBestCustomerData().groupActivityBookings
      : [];
    if (!targetBooking || !list.length) return [];
    const targetId = bookingIdValue(targetBooking);
    const targetEventId = bookingEventIdValue(targetBooking);
    const targetBu = classCardBusinessUnitId(targetBooking);
    const targetName = normalizeSeriesNameForBookings(bookingDisplayLine(targetBooking).title);
    const now = Date.now();

    if (targetEventId) {
      return list.filter((b) => {
        if (!b || isBrpWaitingListBooking(b)) return false;
        if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
        const start = brpBookingStartMs(b);
        if (start && start < now) return false;
        return bookingEventIdValue(b) === targetEventId;
      });
    }

    const targetMsg = String(
      targetBooking?.externalMessage || targetBooking?.groupActivity?.externalMessage || ''
    );
    const targetLooksSeries = hasSeriesCopyHint(targetMsg);
    if (!targetLooksSeries || !targetBu || !targetName) {
      return targetId ? [targetBooking] : [];
    }
    return list.filter((b) => {
      if (!b || isBrpWaitingListBooking(b)) return false;
      if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
      const bid = bookingIdValue(b);
      if (!bid) return false;
      const start = brpBookingStartMs(b);
      if (start && start < now) return false;
      const bu = classCardBusinessUnitId(b);
      if (bu !== targetBu) return false;
      const name = normalizeSeriesNameForBookings(bookingDisplayLine(b).title);
      if (!name) return false;
      const sameName = name === targetName || name.includes(targetName) || targetName.includes(name);
      if (!sameName) return false;
      const msg = String(b?.externalMessage || b?.groupActivity?.externalMessage || '');
      return hasSeriesCopyHint(msg);
    });
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
    const raw = String(gym || '').trim();
    if (!raw) return '';
    return raw.replace(/^boulders\s+/i, '').trim() || raw;
  }

  function appendLocationPillToCardMain(main, labelText) {
    if (!main || !labelText) return;
    let pills = main.querySelector('.booking-item-card__pills');
    if (!pills) {
      pills = document.createElement('div');
      pills.className = 'booking-item-card__pills';
      main.appendChild(pills);
    }
    const pill = document.createElement('span');
    pill.className = 'booking-item-card__pill booking-item-card__pill--location';
    pill.textContent = labelText;
    pills.appendChild(pill);
  }

  function appendDropInPillToCardMain(main, source) {
    if (!main || !source || !isDropInOnlyClass(source)) return;
    let pills = main.querySelector('.booking-item-card__pills');
    if (!pills) {
      pills = document.createElement('div');
      pills.className = 'booking-item-card__pills';
      main.appendChild(pills);
    }
    const pill = document.createElement('span');
    pill.className = 'booking-item-card__pill booking-item-card__pill--dropin';
    pill.textContent = 'Drop In';
    pills.appendChild(pill);
  }

  function appendSeriesPillToCardMain(main, source) {
    if (!main || !source || !isGroupedEventSeries(source)) return;
    let pills = main.querySelector('.booking-item-card__pills');
    if (!pills) {
      pills = document.createElement('div');
      pills.className = 'booking-item-card__pills';
      main.appendChild(pills);
    }
    const n = Number(source?.occasions?.numberOf);
    const pill = document.createElement('span');
    pill.className = 'booking-item-card__pill booking-item-card__pill--dropin';
    pill.textContent = Number.isFinite(n) ? `${n} sessions` : 'Series';
    pills.appendChild(pill);
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

  /** Remove duplicate booking rows (same API id or same session signature). */
  function dedupeCustomerBookings(items) {
    if (!Array.isArray(items) || !items.length) return [];
    const seenId = new Set();
    const seenSig = new Set();
    const out = [];
    items.forEach((b) => {
      if (!b || typeof b !== 'object') return;
      const id = bookingIdValue(b);
      if (id != null) {
        const k = `id:${id}`;
        if (seenId.has(k)) return;
        seenId.add(k);
        out.push(b);
        return;
      }
      const startRaw = bookingStartIsoValue(b);
      const startMs = Date.parse(startRaw);
      const minuteKey = Number.isFinite(startMs) ? Math.floor(startMs / 60000) : startRaw;
      const sig = [
        minuteKey,
        normalizeSeriesNameForBookings(bookingDisplayLine(b).title),
        classCardBusinessUnitId(b),
      ].join('|');
      if (seenSig.has(sig)) return;
      seenSig.add(sig);
      out.push(b);
    });
    return out;
  }

  /**
   * Group bookings like browse + My bookings: event id, series copy / event-linked GA rows,
   * same course product within a date chain, then weekly same-name fallback.
   */
  function buildGroupedBookingRenderUnits(items) {
    if (!Array.isArray(items) || !items.length) return [];
    const list = dedupeCustomerBookings(items);
    if (!list.length) return [];

    const bookingStartMsValue = (b) => {
      const ms = Date.parse(bookingStartIsoValue(b));
      return Number.isFinite(ms) ? ms : NaN;
    };

    const seriesKeyForBooking = (b) => {
      const eventId = bookingEventIdValue(b);
      if (eventId) return `event:${eventId}`;
      const bu = classCardBusinessUnitId(b);
      const name = normalizeSeriesNameForBookings(bookingDisplayLine(b).title);
      const ga = b?.groupActivity;
      const msg = String(b?.externalMessage || (ga && ga.externalMessage) || '');
      const looksSeries =
        hasSeriesCopyHint(msg) ||
        (ga && typeof ga === 'object' && isLikelySeriesSession(ga)) ||
        isLikelySeriesSession(b);
      if (looksSeries && bu && name) return `series:${bu}:${name}`;
      const pid = extractGroupActivityProductId(b);
      if (bu && pid) return `prod:${bu}:${pid}`;
      return null;
    };

    const keyBuckets = new Map();
    const bookingToSeriesKey = new WeakMap();

    list.forEach((b) => {
      const k = seriesKeyForBooking(b);
      if (!k) return;
      if (!keyBuckets.has(k)) keyBuckets.set(k, []);
      keyBuckets.get(k).push(b);
      bookingToSeriesKey.set(b, k);
    });

    const MAX_SESSION_GAP_DAYS = 12;
    [...keyBuckets.keys()]
      .filter((k) => k.startsWith('prod:'))
      .forEach((pk) => {
        const group = keyBuckets.get(pk);
        if (!group || group.length < 2) return;
        const sorted = [...group].sort((a, b) => bookingStartMsValue(a) - bookingStartMsValue(b));
        const clusters = [];
        let cur = [];
        sorted.forEach((b) => {
          if (!cur.length) {
            cur.push(b);
            return;
          }
          const prevMs = bookingStartMsValue(cur[cur.length - 1]);
          const ms = bookingStartMsValue(b);
          const gapDays = (ms - prevMs) / (24 * 60 * 60 * 1000);
          if (Number.isFinite(gapDays) && gapDays >= 0 && gapDays <= MAX_SESSION_GAP_DAYS) {
            cur.push(b);
          } else {
            clusters.push(cur);
            cur = [b];
          }
        });
        if (cur.length) clusters.push(cur);

        if (clusters.length === 1 && clusters[0].length === group.length) return;

        keyBuckets.delete(pk);
        group.forEach((b) => bookingToSeriesKey.delete(b));

        clusters.forEach((cl) => {
          if (cl.length < 2) return;
          const anchorMs = bookingStartMsValue(cl[0]);
          const subKey = `${pk}:c:${anchorMs}`;
          keyBuckets.set(subKey, cl);
          cl.forEach((b) => bookingToSeriesKey.set(b, subKey));
        });
      });

    const fallbackGroups = new Map();
    list.forEach((b) => {
      if (bookingToSeriesKey.has(b)) return;
      const bu = classCardBusinessUnitId(b);
      const name = normalizeSeriesNameForBookings(bookingDisplayLine(b).title);
      const startMs = bookingStartMsValue(b);
      if (!bu || !name || !Number.isFinite(startMs)) return;
      const d = new Date(startMs);
      const minuteOfDay = d.getHours() * 60 + d.getMinutes();
      const key = `fallback:${bu}:${name}:${minuteOfDay}`;
      if (!fallbackGroups.has(key)) fallbackGroups.set(key, []);
      fallbackGroups.get(key).push(b);
    });
    fallbackGroups.forEach((group, key) => {
      if (!Array.isArray(group) || group.length < 2) return;
      const sorted = [...group].sort((a, b) => bookingStartMsValue(a) - bookingStartMsValue(b));
      const deltas = [];
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = bookingStartMsValue(sorted[i - 1]);
        const cur = bookingStartMsValue(sorted[i]);
        if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
        deltas.push((cur - prev) / (24 * 60 * 60 * 1000));
      }
      if (!deltas.length) return;
      const weeklyLike = deltas.every((d) => d >= 4 && d <= 10);
      if (!weeklyLike) return;
      keyBuckets.set(key, sorted);
      sorted.forEach((rec) => bookingToSeriesKey.set(rec, key));
    });

    // Last resort: same class name (+ gym) and session starts in a tight date chain (e.g. BRP omits product / series copy).
    const orphansPreChain = list.filter((b) => !bookingToSeriesKey.has(b));
    if (orphansPreChain.length >= 2) {
      const chainBuckets = new Map();
      orphansPreChain.forEach((b) => {
        const bu = classCardBusinessUnitId(b);
        const name = normalizeSeriesNameForBookings(bookingDisplayLine(b).title);
        if (!name) return;
        const ck = `${bu || 'nobu'}::${name}`;
        if (!chainBuckets.has(ck)) chainBuckets.set(ck, []);
        chainBuckets.get(ck).push(b);
      });
      const CHAIN_MAX_GAP = 14;
      chainBuckets.forEach((group, ck) => {
        if (group.length < 2) return;
        const sorted = [...group].sort((a, b) => bookingStartMsValue(a) - bookingStartMsValue(b));
        const clusters = [];
        let cur = [];
        sorted.forEach((b) => {
          if (!cur.length) {
            cur.push(b);
            return;
          }
          const gapDays =
            (bookingStartMsValue(b) - bookingStartMsValue(cur[cur.length - 1])) / (24 * 60 * 60 * 1000);
          if (Number.isFinite(gapDays) && gapDays >= 0 && gapDays <= CHAIN_MAX_GAP) {
            cur.push(b);
          } else {
            if (cur.length >= 2) clusters.push(cur);
            cur = [b];
          }
        });
        if (cur.length >= 2) clusters.push(cur);
        clusters.forEach((cl, idx) => {
          const anchor = bookingStartMsValue(cl[0]);
          const subKey = `chain:${ck}:${anchor}:${idx}`;
          keyBuckets.set(subKey, cl);
          cl.forEach((bb) => bookingToSeriesKey.set(bb, subKey));
        });
      });
    }

    const emittedKeys = new Set();
    const renderUnits = [];
    list.forEach((b) => {
      const key = bookingToSeriesKey.get(b);
      if (!key) {
        renderUnits.push({ kind: 'single', booking: b });
        return;
      }
      if (emittedKeys.has(key)) return;
      emittedKeys.add(key);
      const group = keyBuckets.get(key);
      if (!group || !group.length) {
        renderUnits.push({ kind: 'single', booking: b });
        return;
      }
      if (group.length > 1) {
        renderUnits.push({
          kind: 'series',
          bookings: [...group].sort((a, c) => brpBookingStartMs(a) - brpBookingStartMs(c)),
        });
      } else {
        renderUnits.push({ kind: 'single', booking: group[0] });
      }
    });
    return renderUnits;
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
    const renderUnits = buildGroupedBookingRenderUnits(items);

    const attachBookingImageFallback = (card, bookingSource, titleText) => {
      if (!resolveGroupActivityClassImageUrl(bookingSource)) {
        resolveBookedClassImageUrlFromEvents(bookingSource).then((url) => {
          if (!url || !card.isConnected) return;
          bookingSource.__resolvedImageUrl = url;
          const media = card.querySelector('.booking-item-card__media');
          if (!media) return;
          media.replaceWith(createClassCardMediaEl(bookingSource, titleText));
        });
      }
    };

    renderUnits.forEach((unit) => {
      if (unit.kind === 'series') {
        const bookings = unit.bookings;
        const first = bookings[0];
        const { title, where } = bookingDisplayLine(first);
        const card = document.createElement('div');
        card.className = 'booking-item-card';
        card.appendChild(createClassCardMediaEl(first, title));
        const main = document.createElement('div');
        main.className = 'booking-item-card__main';
        const h = document.createElement('strong');
        h.className = 'booking-item-card__title';
        h.textContent = title;
        const meta = document.createElement('div');
        meta.className = 'booking-item-card__meta';
        const firstStart = bookingStartIsoValue(bookings[0]);
        const lastStart = bookingStartIsoValue(bookings[bookings.length - 1]);
        const firstText = formatDateLong(firstStart);
        const lastText = formatDateLong(lastStart);
        meta.textContent =
          firstText && lastText && firstText !== '—' && lastText !== '—' && firstText !== lastText
            ? `${firstText} – ${lastText}`
            : firstText;
        main.append(h, meta);
        const sub = document.createElement('div');
        sub.className = 'booking-item-card__submeta';
        sub.textContent = `${bookings.length} sessions booked`;
        main.appendChild(sub);
        const seriesRows = document.createElement('div');
        seriesRows.className = 'booking-item-card__series-list';
        bookings.forEach((rec, idx) => {
          const startIso = bookingStartIsoValue(rec);
          const endIso = rec.duration?.end || rec.endTime || rec.endDateTime || null;
          const row = document.createElement('div');
          row.className = 'booking-item-card__series-row';
          row.textContent = `${idx + 1}/${bookings.length} · ${formatClassSessionWhenLine(
            typeof startIso === 'string' ? startIso : '',
            typeof endIso === 'string' ? endIso : null
          )}`;
          seriesRows.appendChild(row);
        });
        main.appendChild(seriesRows);
        const pills = document.createElement('div');
        pills.className = 'booking-item-card__pills';
        const seriesPill = document.createElement('span');
        seriesPill.className = 'booking-item-card__pill booking-item-card__pill--dropin';
        seriesPill.textContent = `${bookings.length} sessions`;
        pills.appendChild(seriesPill);
        if (where) {
          const locPill = document.createElement('span');
          locPill.className = 'booking-item-card__pill booking-item-card__pill--location';
          locPill.textContent = where;
          pills.appendChild(locPill);
        }
        main.appendChild(pills);
        appendSaveButtonToCardMain(
          main,
          { ...first, __seriesBookings: bookings },
          {
            title,
            where,
            startIso: bookingStartIsoValue(bookings[0]),
            endIso: bookings[bookings.length - 1]?.duration?.end || '',
            isSeries: true,
          }
        );
        card.appendChild(main);
        attachBookingClassCardClick(card, { ...first, __seriesBookings: bookings });
        container.appendChild(card);
        attachBookingImageFallback(card, first, title);
        return;
      }
      const b = unit.booking;
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
      appendSaveButtonToCardMain(main, b, {
        title,
        where,
        startIso: typeof startIso === 'string' ? startIso : '',
        endIso: typeof endIso === 'string' ? endIso : '',
        isSeries: false,
      });
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
      attachBookingImageFallback(card, b, title);
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
    renderSavedBookingsList();
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
          opt.textContent = displayGymTitle(u.name || u.displayName || `Gym ${id}`);
          sel.appendChild(opt);
        });
        if (homeId != null) {
          sel.value = String(homeId);
        }
        sel.dataset.brpPopulated = '1';
      })
      .catch((e) => console.warn('[Browse] Business units:', e));
  }

  function isGroupedEventSeries(ev) {
    const n = Number(ev?.occasions?.numberOf);
    return Number.isFinite(n) && n > 1;
  }

  function formatDateLong(iso) {
    if (!iso) return '—';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return '—';
    try {
      return new Intl.DateTimeFormat('da-DK', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(ms));
    } catch {
      return new Date(ms).toDateString();
    }
  }

  function formatEventSeriesLine(ev) {
    const start = ev?.duration?.start;
    const end = ev?.duration?.end;
    const startText = typeof start === 'string' ? formatDateLong(start) : '—';
    const endText = typeof end === 'string' ? formatDateLong(end) : '';
    const range = endText && endText !== '—' && endText !== startText ? `${startText} – ${endText}` : startText;
    const count = Number(ev?.occasions?.numberOf);
    const countText = Number.isFinite(count) && count > 1 ? `${count} sessions` : '';
    return [range, countText].filter(Boolean).join(' · ');
  }

  function formatEventDateRangeLine(ev) {
    const start = ev?.duration?.start;
    const end = ev?.duration?.end;
    const startText = typeof start === 'string' ? formatDateLong(start) : '—';
    const endText = typeof end === 'string' ? formatDateLong(end) : '';
    return endText && endText !== '—' && endText !== startText ? `${startText} – ${endText}` : startText;
  }

  function mapEventOccasionSlots(ev) {
    const times = Array.isArray(ev?.occasions?.times) ? ev.occasions.times : [];
    return times
      .map((slot) => {
        if (!slot || typeof slot !== 'object') return null;
        const start =
          slot.start ||
          slot.duration?.start ||
          slot.timeRange?.start ||
          slot.period?.start ||
          '';
        const end =
          slot.end ||
          slot.duration?.end ||
          slot.timeRange?.end ||
          slot.period?.end ||
          '';
        const s = typeof start === 'string' && start ? start : '';
        const e = typeof end === 'string' && end ? end : '';
        if (!s) return null;
        return { start: s, end: e || null };
      })
      .filter(Boolean);
  }

  function extractEventSessionLines(ev) {
    const slots = mapEventOccasionSlots(ev);
    if (!slots.length) return [];
    const lines = slots
      .map(({ start, end }) => formatClassSessionWhenLine(start, end || null))
      .filter((w) => w && w !== '—');
    return Array.from(new Set(lines));
  }

  function openEventExpand(ev) {
    const root = ensureClassCardExpandRoot();
    clearClassCardExpandLayoutModifiers(root);
    const titleEl = root.querySelector('.class-card-expand__title');
    const linesEl = root.querySelector('.class-card-expand__lines');
    const descEl = root.querySelector('.class-card-expand__desc');
    const actionsEl = root.querySelector('.class-card-expand__actions');
    const hero = root.querySelector('.class-card-expand__hero');
    const heroImg = root.querySelector('.class-card-expand__hero-img');

    titleEl.textContent = ev?.name || 'Event';
    const sessions = extractEventSessionLines(ev);
    linesEl.textContent = sessions.length
      ? sessions.join('\n')
      : formatEventSeriesLine(ev);
    resetClassCardExpandDescEl(descEl);
    descEl.textContent = isGroupedEventSeries(ev)
      ? 'This is a multi-session course. You’ll attend all sessions in the series.'
      : 'This is an event.';

    actionsEl.innerHTML = '';
    if (isUserAuthenticated()) {
      const eventIdNum = Number(ev?.id);
      if (Number.isFinite(eventIdNum) && eventIdNum > 0 && authAPI?.bookCustomerEvent) {
        const bookBtn = document.createElement('button');
        bookBtn.type = 'button';
        bookBtn.className = 'profile-action-btn class-card-expand__btn-primary';
        bookBtn.textContent = 'Book now';
        bookBtn.addEventListener('click', async () => {
          const cid = getBrpNumericCustomerId(getBestCustomerData());
          if (!cid) {
            showToast('Log in to book.', 'error');
            return;
          }
          bookBtn.disabled = true;
          try {
            const customer = getBestCustomerData() || {};
            await authAPI.bookCustomerEvent(cid, {
              eventId: eventIdNum,
              businessUnitId: classCardBusinessUnitId(ev),
              participant: {
                firstName: customer.firstName || customer.givenName || '',
                lastName: customer.lastName || customer.familyName || '',
                birthDate: customer.birthDate || customer.dateOfBirth || '',
                ssn: customer.ssn || customer.socialSecurityNumber || '',
              },
            });
            showToast('Booked! Check My classes.', 'success');
            closeClassCardExpand();
            ensureGroupActivityBookingsLoaded().then(() => {
              refreshClassesBookingsLists();
              refreshDashboardPanels();
            });
            applyBrowseClassFilters();
          } catch (err) {
            if (Number(err?.status) === 403) {
              showToast(
                'You do not have permission to book this course online. Please contact reception and ask them to add you to the full series.',
                'error'
              );
              bookBtn.disabled = true;
              bookBtn.textContent = 'Contact reception';
              bookBtn.classList.add('profile-action-btn-secondary');
              bookBtn.classList.remove('profile-action-btn');
            } else {
              showToast(getErrorMessage(err), 'error');
            }
          } finally {
            if (bookBtn.textContent !== 'Contact reception') {
              bookBtn.disabled = false;
            }
          }
        });
        actionsEl.appendChild(bookBtn);
      }
    } else {
      const hint = document.createElement('p');
      hint.className = 'class-card-expand__hint';
      hint.textContent = 'Log in to book this course.';
      actionsEl.appendChild(hint);
    }
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => closeClassCardExpand());
    actionsEl.appendChild(closeBtn);

    const fallback =
      typeof window.getProductPlaceholderImage === 'function'
        ? window.getProductPlaceholderImage()
        : '';
    const primaryUrl = resolveGroupActivityClassImageUrl(ev);
    const buId = classCardBusinessUnitId(ev);
    const productId = extractGroupActivityProductId(ev);
    hero.classList.remove('class-card-expand__hero--empty');
    heroImg.alt = ev?.name || 'Event';
    if (primaryUrl || fallback) {
      applyClassCardImgSrc(heroImg, primaryUrl || fallback);
      hero.classList.toggle('class-card-expand__hero--empty', !(primaryUrl || fallback));
    } else {
      heroImg.removeAttribute('src');
      hero.classList.add('class-card-expand__hero--empty');
    }
    if (!primaryUrl && productId && buId) {
      fetchEventProductDetail(productId, buId).then((detail) => {
        if (!heroImg.isConnected) return;
        const u = detail && resolveProductAssetImageUrl(detail);
        if (!u) return;
        hero.classList.remove('class-card-expand__hero--empty');
        applyClassCardImgSrc(heroImg, u);
      });
    }

    root.classList.add('class-card-expand--open');
    root.setAttribute('aria-hidden', 'false');
    document.body.classList.add('class-card-expand-open');
    requestAnimationFrame(() => {
      root.querySelector('.class-card-expand__close')?.focus();
    });
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
    const browseMode = typeVal === 'event' ? 'event' : typeVal === 'groupActivity' ? 'groupActivity' : 'all';
    if ((browseMode === 'event' || browseMode === 'all') && !authAPI?.listBusinessUnitEvents) {
      results.innerHTML =
        '<p class="bookings-empty-msg">Events are not available on this connection.</p>';
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

    renderBrowseCardsSkeleton(results, 8);
    const q = searchEl?.value?.trim().toLowerCase() || '';

    const rangeStartMs = Date.parse(periodStart);
    const rangeEndMs = Date.parse(periodEnd);
    const hasRange = Number.isFinite(rangeStartMs) && Number.isFinite(rangeEndMs) && rangeEndMs >= rangeStartMs;
    const rangeDays = hasRange ? Math.ceil((rangeEndMs - rangeStartMs) / (24 * 60 * 60 * 1000)) : 0;
    const SHOULD_CHUNK_RANGE_DAYS = 8;
    const CHUNK_DAYS = 7;
    // Include ongoing multi-session events that started before the visible window.
    // This keeps "series cards" bookable even after session 1 has begun.
    const EVENT_LOOKBACK_DAYS = 42;
    const eventPeriodStartIso = hasRange
      ? new Date(rangeStartMs - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

    async function listActivitiesForBuRange(buId) {
      const base = { customerId: cid || undefined };
      if (!hasRange) {
        if (browseMode === 'event') {
          const evs = await authAPI.listBusinessUnitEvents(buId, {});
          return (Array.isArray(evs) ? evs : []).map((e) => ({ ...e, __buId: buId, __kind: 'event' }));
        }
        if (browseMode === 'all') {
          const [acts, evs] = await Promise.all([
            authAPI.listBusinessUnitGroupActivities(buId, base).catch(() => []),
            authAPI.listBusinessUnitEvents(buId, {}).catch(() => []),
          ]);
          return [
            ...(Array.isArray(acts) ? acts : []).map((a) => ({ ...a, __buId: buId, __kind: 'groupActivity' })),
            ...(Array.isArray(evs) ? evs : []).map((e) => ({ ...e, __buId: buId, __kind: 'event' })),
          ];
        }
        const acts = await authAPI.listBusinessUnitGroupActivities(buId, base);
        return (Array.isArray(acts) ? acts : []).map((a) => ({ ...a, __buId: buId, __kind: 'groupActivity' }));
      }
      // BRP schedule endpoints may behave poorly on very wide ranges; chunk long ranges.
      if (rangeDays <= SHOULD_CHUNK_RANGE_DAYS) {
        if (browseMode === 'event') {
          const evs = await authAPI.listBusinessUnitEvents(buId, {
            periodStart: eventPeriodStartIso || periodStart,
            periodEnd,
          });
          return (Array.isArray(evs) ? evs : []).map((e) => ({ ...e, __buId: buId, __kind: 'event' }));
        }
        if (browseMode === 'all') {
          const [acts, evs] = await Promise.all([
            authAPI
              .listBusinessUnitGroupActivities(buId, { ...base, periodStart, periodEnd })
              .catch(() => []),
            authAPI
              .listBusinessUnitEvents(buId, {
                periodStart: eventPeriodStartIso || periodStart,
                periodEnd,
              })
              .catch(() => []),
          ]);
          return [
            ...(Array.isArray(acts) ? acts : []).map((a) => ({ ...a, __buId: buId, __kind: 'groupActivity' })),
            ...(Array.isArray(evs) ? evs : []).map((e) => ({ ...e, __buId: buId, __kind: 'event' })),
          ];
        }
        const acts = await authAPI.listBusinessUnitGroupActivities(buId, { ...base, periodStart, periodEnd });
        return (Array.isArray(acts) ? acts : []).map((a) => ({ ...a, __buId: buId, __kind: 'groupActivity' }));
      }
      const out = [];
      let cur = rangeStartMs;
      while (cur <= rangeEndMs) {
        const chunkStart = new Date(cur);
        const chunkEnd = new Date(Math.min(rangeEndMs, cur + CHUNK_DAYS * 24 * 60 * 60 * 1000 - 1));
        if (browseMode === 'event') {
          const evs = await authAPI
              .listBusinessUnitEvents(buId, {
                periodStart: new Date(
                  chunkStart.getTime() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
                ).toISOString(),
                periodEnd: chunkEnd.toISOString(),
              })
            .catch(() => []);
          if (Array.isArray(evs) && evs.length) out.push(...evs.map((e) => ({ ...e, __kind: 'event' })));
        } else if (browseMode === 'all') {
          const [acts, evs] = await Promise.all([
            authAPI
              .listBusinessUnitGroupActivities(buId, {
                ...base,
                periodStart: chunkStart.toISOString(),
                periodEnd: chunkEnd.toISOString(),
              })
              .catch(() => []),
            authAPI
              .listBusinessUnitEvents(buId, {
                periodStart: new Date(
                  chunkStart.getTime() - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
                ).toISOString(),
                periodEnd: chunkEnd.toISOString(),
              })
              .catch(() => []),
          ]);
          if (Array.isArray(acts) && acts.length) out.push(...acts.map((a) => ({ ...a, __kind: 'groupActivity' })));
          if (Array.isArray(evs) && evs.length) out.push(...evs.map((e) => ({ ...e, __kind: 'event' })));
        } else {
          const acts = await authAPI
            .listBusinessUnitGroupActivities(buId, {
              ...base,
              periodStart: chunkStart.toISOString(),
              periodEnd: chunkEnd.toISOString(),
            })
            .catch(() => []);
          if (Array.isArray(acts) && acts.length) out.push(...acts.map((a) => ({ ...a, __kind: 'groupActivity' })));
        }
        cur = cur + CHUNK_DAYS * 24 * 60 * 60 * 1000;
      }
      return out.map((a) => ({ ...a, __buId: buId }));
    }

    try {
      const chunks = await Promise.all(buIds.map((buId) => listActivitiesForBuRange(buId).catch(() => [])));
      let flat = chunks.flat();
      const seen = new Set();
      flat = flat.filter((a) => {
        const id = a.id;
        const kind = a.__kind || 'groupActivity';
        const key = id == null ? null : `${kind}:${id}`;
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (hasRange) {
        flat = flat.filter((item) => {
          const kind = item.__kind || 'groupActivity';
          const startMs = Date.parse(item?.duration?.start || '');
          const endMs = Date.parse(item?.duration?.end || '');
          if (kind === 'event') {
            if (!Number.isFinite(startMs)) return false;
            const effectiveEndMs = Number.isFinite(endMs) ? endMs : startMs;
            return effectiveEndMs >= rangeStartMs && startMs <= rangeEndMs;
          }
          return Number.isFinite(startMs) && startMs >= rangeStartMs && startMs <= rangeEndMs;
        });
      }
      if (q) {
        flat = flat.filter((a) => String(a.name || '').toLowerCase().includes(q));
      }

      // Fallback guard: when BRP exposes a series session as plain group activity,
      // proactively resolve product detail and remove that session card from browse.
      const groupCandidates = flat.filter((item) => (item.__kind || 'groupActivity') === 'groupActivity');
      if (groupCandidates.length) {
        await Promise.all(
          groupCandidates.map(async (item) => {
            item.__blockDirectSessionBooking = await shouldBlockDirectSessionBooking(item);
          })
        );
        flat = flat.filter((item) => {
          const kind = item.__kind || 'groupActivity';
          if (kind !== 'groupActivity') return true;
          return item.__blockDirectSessionBooking !== true;
        });
      }

      // If a grouped event series exists (e.g. Intro course with 3 sessions),
      // hide the individual group-activity sessions that fall inside the series range
      // to avoid showing duplicates in "All Types".
      const seriesEvents = flat.filter((x) => (x.__kind || 'groupActivity') === 'event' && isGroupedEventSeries(x));
      if (seriesEvents.length) {
        const normalizeSeriesName = (name) =>
          String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const dayStartMs = (ms) => {
          const d = new Date(ms);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        };
        const seriesIndex = seriesEvents
          .map((ev) => {
            const buId = classCardBusinessUnitId(ev);
            const name = normalizeSeriesName(ev?.name);
            const a = Date.parse(ev?.duration?.start || '');
            const b = Date.parse(ev?.duration?.end || '');
            if (!buId || !name || !Number.isFinite(a)) return null;
            const startDay = dayStartMs(a);
            const endDay = Number.isFinite(b) ? dayStartMs(b) : startDay;
            return {
              buId,
              name,
              startDayMs: startDay,
              endDayMs: endDay >= startDay ? endDay : startDay,
            };
          })
          .filter(Boolean);

        if (seriesIndex.length) {
          flat = flat.filter((item) => {
            const kind = item.__kind || 'groupActivity';
            if (kind !== 'groupActivity') return true;
            const buId = classCardBusinessUnitId(item);
            const name = normalizeSeriesName(item?.name);
            const startMs = Date.parse(item?.duration?.start || '');
            if (!buId || !name || !Number.isFinite(startMs)) return true;
            const startDayMs = dayStartMs(startMs);
            return !seriesIndex.some((ev) => {
              if (ev.buId !== buId) return false;
              // Match exact name OR close variant ("introhold" / "intro hold")
              const sameName = ev.name === name || ev.name.includes(name) || name.includes(ev.name);
              if (!sameName) return false;
              return startDayMs >= ev.startDayMs && startDayMs <= ev.endDayMs;
            });
          });
        }
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
        const kind = a.__kind || 'groupActivity';
        const browseTitle = a.name || (kind === 'event' ? 'Event' : 'Class');
        card.appendChild(createClassCardMediaEl(a, browseTitle));
        const main = document.createElement('div');
        main.className = 'booking-item-card__main';
        const h = document.createElement('strong');
        h.className = 'booking-item-card__title';
        h.textContent = browseTitle;
        const meta = document.createElement('div');
        meta.className = 'booking-item-card__meta';
        if (kind === 'event') {
          meta.textContent = formatEventDateRangeLine(a);
          main.append(h, meta);
          appendClassCardDurationAvailability(
            main,
            typeof a.duration?.start === 'string' ? a.duration.start : '',
            typeof a.duration?.end === 'string' ? a.duration.end : null,
            { slots: a.slots, source: a, booking: a }
          );
          appendSeriesPillToCardMain(main, a);
          const whereLabel = groupActivityBrowseLocationLabel(a, gymSel);
          appendLocationPillToCardMain(main, whereLabel);
          appendSaveButtonToCardMain(main, a, {
            title: browseTitle,
            where: whereLabel || '',
            startIso: a.duration?.start || '',
            endIso: a.duration?.end || '',
            isSeries: isGroupedEventSeries(a),
          });
        } else {
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
            { slots: a.slots, source: a }
          );
          appendLocationPillToCardMain(main, groupActivityBrowseLocationLabel(a, gymSel));
          appendSaveButtonToCardMain(main, a, {
            title: browseTitle,
            where: groupActivityBrowseLocationLabel(a, gymSel),
            startIso: a.duration?.start || '',
            endIso: a.duration?.end || '',
            isSeries: false,
          });
          const canBookNow =
            !isBrowseSlotsFullyBooked(a.slots) &&
            !isDropInOnlyClass(a) &&
            !isLikelySeriesSession(a) &&
            a.__blockDirectSessionBooking !== true;
          if (canBookNow) {
            const cardBookBtn = document.createElement('button');
            cardBookBtn.type = 'button';
            cardBookBtn.className = 'profile-action-btn booking-item-card__book-btn';
            cardBookBtn.textContent = 'Book now';
            cardBookBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              openClassCardExpandBrowse(a, gymSel);
            });
            main.appendChild(cardBookBtn);
          }
        }
        card.appendChild(main);
        if (kind === 'event') {
          card.classList.add('booking-item-card--clickable');
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-haspopup', 'dialog');
          const open = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEventExpand(a);
          };
          card.addEventListener('click', open);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(e);
            }
          });
        } else {
          attachBrowseClassCardClick(card, a, gymSel);
        }
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

  function openSavedBookingsTab() {
    setRoute('classes');
    requestAnimationFrame(() => {
      document.querySelector('.booking-tab[data-tab="myBookings"]')?.click();
      requestAnimationFrame(() => {
        document.querySelector('.booking-sub-tab[data-sub-tab="saved"]')?.click();
      });
    });
  }

  function customerCityToken(customer) {
    const addr = getAddress(customer || {});
    const rawCity = addr?.city && addr.city !== '-' ? String(addr.city) : String(customer?.city || '');
    const cleaned = rawCity
      .replace(/\b\d{3,5}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned.toLowerCase();
  }

  async function getRecommendedDashboardClass(customer) {
    if (!authAPI?.listBusinessUnitGroupActivities) return null;
    const city = customerCityToken(customer);
    const homeBuId = customer?.businessUnit?.id;
    const cid = getBrpNumericCustomerId(customer);
    const now = Date.now();
    const periodStart = startOfDay(new Date(now)).toISOString();
    const periodEnd = endOfDay(new Date(now + 14 * 24 * 60 * 60 * 1000)).toISOString();

    let candidateUnits = [];
    if (authAPI.listVer3BusinessUnits) {
      try {
        const units = await authAPI.listVer3BusinessUnits();
        if (Array.isArray(units) && units.length) {
          if (city) {
            candidateUnits = units.filter((u) =>
              String(u?.name || u?.displayName || '')
                .toLowerCase()
                .includes(city)
            );
          }
          if (!candidateUnits.length && homeBuId != null) {
            candidateUnits = units.filter((u) => Number(u?.id) === Number(homeBuId));
          }
          if (!candidateUnits.length) {
            candidateUnits = units.slice(0, 4);
          }
        }
      } catch (_) {
        candidateUnits = [];
      }
    }

    if (!candidateUnits.length && homeBuId != null) {
      candidateUnits = [{ id: homeBuId, name: customer?.businessUnit?.name || `Gym ${homeBuId}` }];
    }
    if (!candidateUnits.length) return null;

    const unitIds = candidateUnits
      .map((u) => Number(u?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, 4);
    if (!unitIds.length) return null;

    const chunks = await Promise.all(
      unitIds.map((buId) =>
        authAPI
          .listBusinessUnitGroupActivities(buId, {
            periodStart,
            periodEnd,
            customerId: cid || undefined,
          })
          .then((acts) =>
            (Array.isArray(acts) ? acts : []).map((a) => ({
              ...a,
              __buId: buId,
            }))
          )
          .catch(() => [])
      )
    );

    let all = chunks.flat().filter((a) => {
      if (!a || a.cancelled === true) return false;
      const startMs = a.duration?.start ? Date.parse(a.duration.start) : NaN;
      return Number.isFinite(startMs) && startMs >= now;
    });
    if (authAPI?.listBusinessUnitEvents && all.length) {
      const EVENT_LOOKBACK_DAYS = 42;
      const eventsChunks = await Promise.all(
        unitIds.map((buId) =>
          authAPI
            .listBusinessUnitEvents(buId, {
              periodStart: new Date(
                Date.parse(periodStart) - EVENT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
              ).toISOString(),
              periodEnd,
            })
            .then((evs) =>
              (Array.isArray(evs) ? evs : [])
                .filter((ev) => isGroupedEventSeries(ev))
                .map((ev) => ({ ...ev, __buId: buId }))
            )
            .catch(() => [])
        )
      );
      const seriesEvents = eventsChunks.flat();
      if (seriesEvents.length) {
        const normalizeSeriesName = (name) =>
          String(name || '')
            .toLowerCase()
            .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        const dayStartMs = (ms) => {
          const d = new Date(ms);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        };
        const seriesIndex = seriesEvents
          .map((ev) => {
            const buId = classCardBusinessUnitId(ev);
            const name = normalizeSeriesName(ev?.name);
            const a = Date.parse(ev?.duration?.start || '');
            const b = Date.parse(ev?.duration?.end || '');
            if (!buId || !name || !Number.isFinite(a)) return null;
            const startDay = dayStartMs(a);
            const endDay = Number.isFinite(b) ? dayStartMs(b) : startDay;
            return {
              buId,
              name,
              startDayMs: startDay,
              endDayMs: endDay >= startDay ? endDay : startDay,
            };
          })
          .filter(Boolean);
        if (seriesIndex.length) {
          all = all.filter((item) => {
            const buId = classCardBusinessUnitId(item);
            const name = normalizeSeriesName(item?.name);
            const startMs = Date.parse(item?.duration?.start || '');
            if (!buId || !name || !Number.isFinite(startMs)) return true;
            const startDayMs = dayStartMs(startMs);
            return !seriesIndex.some((ev) => {
              if (ev.buId !== buId) return false;
              const sameName = ev.name === name || ev.name.includes(name) || name.includes(ev.name);
              if (!sameName) return false;
              return startDayMs >= ev.startDayMs && startDayMs <= ev.endDayMs;
            });
          });
        }
      }
    }
    if (!all.length) return null;
    all.sort((a, b) => Date.parse(a.duration.start) - Date.parse(b.duration.start));
    return all[0];
  }

  function renderDashboardClassesRecommendation(hostEl, customer) {
    if (!hostEl) return;
    const hint = document.createElement('p');
    hint.className = 'dashboard-classes-empty-summary';
    hint.textContent = 'Finding a recommended class near you…';
    hostEl.appendChild(hint);

    getRecommendedDashboardClass(customer)
      .then((rec) => {
        if (!hostEl.isConnected || !hint.isConnected) return;
        hint.remove();
        if (!rec) return;

        const recLabel = document.createElement('p');
        recLabel.className = 'dashboard-classes-empty-summary';
        recLabel.textContent = 'Recommended for you';
        hostEl.appendChild(recLabel);

        const card = document.createElement('div');
        card.className = 'booking-item-card booking-item-card--browse';
        const cardTitle = rec.name || 'Class';
        card.appendChild(createClassCardMediaEl(rec, cardTitle));
        const main = document.createElement('div');
        main.className = 'booking-item-card__main';

        const h = document.createElement('strong');
        h.className = 'booking-item-card__title';
        h.textContent = cardTitle;
        const meta = document.createElement('div');
        meta.className = 'booking-item-card__meta';
        meta.textContent = formatClassSessionWhenLine(rec.duration?.start || '', rec.duration?.end || null);
        main.append(h, meta);

        appendClassCardDurationAvailability(
          main,
          typeof rec.duration?.start === 'string' ? rec.duration.start : '',
          typeof rec.duration?.end === 'string' ? rec.duration.end : null,
          { slots: rec.slots, source: rec }
        );
        const gymSel = document.getElementById('browseGymFilter');
        appendLocationPillToCardMain(main, groupActivityBrowseLocationLabel(rec, gymSel));

        card.appendChild(main);
        attachBrowseClassCardClick(card, rec, gymSel);
        const cardGrid = document.createElement('div');
        cardGrid.className = 'browse-results dashboard-recommended-results';
        cardGrid.appendChild(card);
        hostEl.appendChild(cardGrid);
      })
      .catch(() => {
        if (!hostEl.isConnected || !hint.isConnected) return;
        hint.remove();
      });
  }

  function buildDashboardBookedLookup(bookings, units) {
    const ctx = {
      eventIds: new Set(),
      gaIds: new Set(),
      buProductPairs: new Set(),
      seriesBuName: new Set(),
    };
    if (Array.isArray(bookings)) {
      bookings.forEach((b) => {
        if (!b || typeof b !== 'object') return;
        const eid = bookingEventIdValue(b);
        if (eid) ctx.eventIds.add(eid);
        const gid = Number(b?.groupActivity?.id ?? b?.groupActivityId);
        if (Number.isFinite(gid) && gid > 0) ctx.gaIds.add(gid);
        const bu = classCardBusinessUnitId(b);
        const pid = extractGroupActivityProductId(b);
        if (bu && pid) ctx.buProductPairs.add(`${bu}|${pid}`);
      });
    }
    if (Array.isArray(units)) {
      units.forEach((u) => {
        if (u.kind !== 'series' || !Array.isArray(u.bookings) || !u.bookings.length) return;
        const fb = u.bookings[0];
        const bu = classCardBusinessUnitId(fb);
        const name = normalizeSeriesNameForBookings(bookingDisplayLine(fb).title);
        if (bu && name) ctx.seriesBuName.add(`${bu}|${name}`);
      });
    }
    return ctx;
  }

  function dashboardSavedRecordIsBooked(rec, ctx) {
    if (!rec || !ctx) return false;
    const key = String(rec.key || '');
    const ev = /^event:(\d+)$/.exec(key);
    if (ev && ctx.eventIds.has(Number(ev[1]))) return true;
    const ga = /^ga:(\d+)$/.exec(key);
    if (ga && ctx.gaIds.has(Number(ga[1]))) return true;
    const bu = Number(rec.buId);
    const pid = rec.productId != null ? Number(rec.productId) : NaN;
    if (Number.isFinite(bu) && bu > 0 && Number.isFinite(pid) && pid > 0) {
      if (ctx.buProductPairs.has(`${bu}|${pid}`)) return true;
    }
    const name = normalizeSeriesNameForBookings(rec.title);
    if (rec.isSeries && Number.isFinite(bu) && bu > 0 && name && ctx.seriesBuName.has(`${bu}|${name}`)) {
      return true;
    }
    return false;
  }

  function appendDashboardBookedUnitToFragment(frag, unit) {
    if (unit.kind === 'series') {
      const bookings = unit.bookings;
      const first = bookings[0];
      const { title, where } = bookingDisplayLine(first);
      const row = document.createElement('div');
      row.className = 'dashboard-class-booked dashboard-class-booked--series';
      row.appendChild(
        createClassCardMediaEl(first, title, { extraMediaClasses: 'booking-item-card__media--dashboard-compact' })
      );
      const main = document.createElement('div');
      main.className = 'dashboard-class-booked-main';
      const head = document.createElement('div');
      head.className = 'dashboard-class-booked-head';
      const t = document.createElement('strong');
      t.className = 'dashboard-class-booked-title';
      t.textContent = title;
      const bookedPill = document.createElement('span');
      bookedPill.className = 'booking-item-card__pill booking-item-card__pill--booked';
      bookedPill.textContent = 'Booked';
      head.append(t, bookedPill);
      main.appendChild(head);
      const details = document.createElement('details');
      details.className = 'dashboard-class-booked-details';
      const sum = document.createElement('summary');
      sum.className = 'dashboard-class-booked-details__summary';
      const fs = bookingStartIsoValue(first);
      const fe = first.duration?.end || first.endTime || first.endDateTime || null;
      sum.textContent = `${bookings.length} sessions · Next: ${formatClassSessionWhenLine(
        typeof fs === 'string' ? fs : '',
        typeof fe === 'string' ? fe : null
      )}`;
      const seriesRows = document.createElement('div');
      seriesRows.className = 'booking-item-card__series-list dashboard-class-booked-series-list';
      bookings.forEach((rec, idx) => {
        const startIso = bookingStartIsoValue(rec);
        const endIso = rec.duration?.end || rec.endTime || rec.endDateTime || null;
        const r = document.createElement('div');
        r.className = 'booking-item-card__series-row';
        r.textContent = `${idx + 1}/${bookings.length} · ${formatClassSessionWhenLine(
          typeof startIso === 'string' ? startIso : '',
          typeof endIso === 'string' ? endIso : null
        )}`;
        seriesRows.appendChild(r);
      });
      details.append(sum, seriesRows);
      main.appendChild(details);
      const minsVals = bookings.map((rec) => {
        const s = bookingStartIsoValue(rec);
        const e = rec.duration?.end || rec.endTime || rec.endDateTime || null;
        return formatClassSessionDurationMinutes(
          typeof s === 'string' ? s : '',
          typeof e === 'string' ? e : null
        );
      });
      const uniqMins = [...new Set(minsVals.filter((x) => x != null))];
      if (uniqMins.length === 1) {
        const dur = document.createElement('div');
        dur.className = 'booking-item-card__submeta dashboard-class-booked-submeta';
        dur.textContent = `${uniqMins[0]} min per session`;
        main.appendChild(dur);
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
      row.appendChild(main);
      attachBookingClassCardClick(row, { ...first, __seriesBookings: bookings });
      frag.appendChild(row);
      return;
    }

    const b = unit.booking;
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
    const tt = document.createElement('strong');
    tt.className = 'dashboard-class-booked-title';
    tt.textContent = title;
    const meta = document.createElement('div');
    meta.className = 'dashboard-class-booked-meta';
    meta.textContent = formatClassSessionWhenLine(
      typeof startIso === 'string' ? startIso : '',
      typeof endIso === 'string' ? endIso : null
    );
    main.append(tt, meta);
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
    row.appendChild(main);
    attachBookingClassCardClick(row, b);
    frag.appendChild(row);
  }

  function createDashboardClassesSectionHeader(headingId, label, count) {
    const header = document.createElement('div');
    header.className = 'dashboard-classes-section__header';
    const h3 = document.createElement('h3');
    h3.className = 'dashboard-classes-section__heading';
    h3.id = headingId;
    h3.textContent = label;
    header.appendChild(h3);
    if (count != null && count > 0) {
      const badge = document.createElement('span');
      badge.className = 'dashboard-classes-section__count';
      badge.textContent = String(count);
      badge.setAttribute('aria-label', count === 1 ? '1 item' : `${count} items`);
      header.appendChild(badge);
    }
    return header;
  }

  function renderDashboardClassesSection(customer) {
    const wrap = document.getElementById('dashboardUpcomingClasses');
    if (!wrap) return;
    clearDashboardEl(wrap);
    const bookings = extractUpcomingBookings(customer || {});
    const bookingUnits = bookings.length ? buildGroupedBookingRenderUnits(bookings) : [];
    const bookedLookup = buildDashboardBookedLookup(bookings, bookingUnits);
    const savedAll = loadSavedClasses();
    const saved = savedAll.filter((rec) => !dashboardSavedRecordIsBooked(rec, bookedLookup));
    const hasSaved = saved.length > 0;
    const hasBookings = bookings.length > 0;

    if (hasSaved) {
      const savedSection = document.createElement('section');
      savedSection.className = 'dashboard-classes-section dashboard-classes-section--saved';
      savedSection.setAttribute('aria-labelledby', 'dashboardSavedClassesHeading');
      savedSection.appendChild(
        createDashboardClassesSectionHeader('dashboardSavedClassesHeading', 'Saved classes', saved.length)
      );
      const reminder = document.createElement('div');
      reminder.className = 'dashboard-saved-reminder';
      const meta = document.createElement('p');
      meta.className = 'dashboard-saved-reminder__meta';
      meta.textContent = 'Reminder: review your saved classes before they fill up.';
      const hiddenSaved = savedAll.length - saved.length;
      const hint =
        hiddenSaved > 0
          ? (() => {
              const p = document.createElement('p');
              p.className = 'dashboard-saved-reminder__hint';
              p.textContent =
                hiddenSaved === 1
                  ? 'One saved class is hidden here because you’re already booked for it.'
                  : `${hiddenSaved} saved classes are hidden here because you’re already booked for them.`;
              return p;
            })()
          : null;
      const actions = document.createElement('div');
      actions.className = 'dashboard-saved-reminder__actions';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'profile-action-btn-secondary dashboard-access-cta';
      cta.textContent = 'View saved';
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        openSavedBookingsTab();
      });
      actions.appendChild(cta);
      const savedList = document.createElement('div');
      savedList.className = 'dashboard-saved-reminder__list';
      saved.forEach((rec) => {
        const row = document.createElement('div');
        row.className = 'dashboard-saved-reminder__item';
        const rowTitle = document.createElement('strong');
        rowTitle.className = 'dashboard-saved-reminder__item-title';
        rowTitle.textContent = rec?.title || 'Class';
        row.appendChild(rowTitle);
        if (rec?.isSeries && Array.isArray(rec?.seriesLines) && rec.seriesLines.length > 1) {
          const det = document.createElement('details');
          det.className = 'dashboard-saved-reminder__series-details';
          const sum = document.createElement('summary');
          sum.className = 'dashboard-saved-reminder__series-summary';
          const firstPlain = String(rec.seriesLines[0]).replace(/^\d+\/\d+\s*·\s*/, '');
          sum.textContent = `${rec.seriesLines.length} sessions — ${firstPlain}`;
          const body = document.createElement('div');
          body.className = 'dashboard-saved-reminder__series-body';
          body.style.whiteSpace = 'pre-line';
          body.textContent = rec.seriesLines.join('\n');
          det.append(sum, body);
          row.appendChild(det);
        } else {
          const rowMeta = document.createElement('div');
          rowMeta.className = 'dashboard-saved-reminder__item-meta';
          if (rec?.isSeries && Array.isArray(rec?.seriesLines) && rec.seriesLines.length === 1) {
            rowMeta.textContent = rec.seriesLines[0];
          } else {
            rowMeta.textContent = formatClassSessionWhenLine(rec?.startIso || '', rec?.endIso || null);
          }
          row.appendChild(rowMeta);
        }
        attachDashboardSavedReminderRow(row, rec);
        savedList.appendChild(row);
      });
      reminder.append(meta, ...(hint ? [hint] : []), savedList, actions);
      savedSection.appendChild(reminder);
      wrap.appendChild(savedSection);
    }

    if (hasBookings) {
      const bookedSection = document.createElement('section');
      bookedSection.className = 'dashboard-classes-section dashboard-classes-section--booked';
      bookedSection.setAttribute('aria-labelledby', 'dashboardBookedClassesHeading');
      bookedSection.appendChild(
        createDashboardClassesSectionHeader(
          'dashboardBookedClassesHeading',
          'Upcoming bookings',
          bookingUnits.length
        )
      );
      const body = document.createElement('div');
      body.className = 'dashboard-classes-section__body dashboard-classes-section__body--booked';
      const frag = document.createDocumentFragment();
      const unitStartMs = (u) =>
        u.kind === 'series' ? brpBookingStartMs(u.bookings[0]) : brpBookingStartMs(u.booking);
      const units = [...bookingUnits].sort((a, b) => (unitStartMs(a) || 0) - (unitStartMs(b) || 0));
      const maxUnits = 6;
      units.slice(0, maxUnits).forEach((unit) => {
        appendDashboardBookedUnitToFragment(frag, unit);
      });
      body.appendChild(frag);
      bookedSection.appendChild(body);
      wrap.appendChild(bookedSection);
      return;
    }

    const empty = document.createElement('div');
    empty.className = 'dashboard-classes-empty';
    const emptyMain = document.createElement('div');
    emptyMain.className = 'dashboard-classes-empty-main';
    const title = document.createElement('p');
    title.className = 'dashboard-classes-empty-title';
    title.textContent = 'No bookings yet';
    const lead = document.createElement('p');
    lead.className = 'dashboard-classes-empty-lead';
    lead.textContent = 'Your upcoming classes will appear here once you book something.';
    const recSlot = document.createElement('div');
    recSlot.className = 'dashboard-classes-recommendation-slot';
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'profile-action-btn dashboard-book-class-cta';
    cta.id = 'dashboardBookClassCTA';
    cta.textContent = 'See more classes';
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      openClassesBrowseTab();
    });
    emptyMain.append(title, lead, cta);
    empty.append(emptyMain, recSlot);
    renderDashboardClassesRecommendation(recSlot, customer || {});

    if (hasSaved) {
      const bookedSection = document.createElement('section');
      bookedSection.className = 'dashboard-classes-section dashboard-classes-section--booked';
      bookedSection.setAttribute('aria-labelledby', 'dashboardBookedClassesHeading');
      bookedSection.appendChild(
        createDashboardClassesSectionHeader('dashboardBookedClassesHeading', 'Upcoming bookings', null)
      );
      const body = document.createElement('div');
      body.className =
        'dashboard-classes-section__body dashboard-classes-section__body--booked dashboard-classes-section__body--empty-booked';
      body.appendChild(empty);
      bookedSection.appendChild(body);
      wrap.appendChild(bookedSection);
      return;
    }

    wrap.appendChild(empty);
  }

  function refreshDashboardPanels() {
    if (!isUserAuthenticated()) return;
    ensureGroupActivityBookingsLoaded().then(() => {
      const customer = getBestCustomerData();
      renderDashboardAccessPanel(customer);
      renderDashboardClassesSection(customer);
      renderDashboardValueCardsSection(customer);
    });
  }

  let gymsDirectoryLoadToken = 0;

  function formatGymAddressLines(gym) {
    const a = gym?.address;
    if (!a || typeof a !== 'object') {
      return { street: '', postalCity: '' };
    }
    const street = a.street != null ? String(a.street).trim() : '';
    const pc = a.postalCode != null ? String(a.postalCode).trim() : '';
    const city = a.city != null ? String(a.city).trim() : '';
    const postalCity = [pc, city].filter(Boolean).join(' ').trim();
    return { street, postalCity };
  }

  function buildMapsSearchQuery(gym) {
    const name = gym?.name != null ? String(gym.name).trim() : '';
    const { street, postalCity } = formatGymAddressLines(gym);
    return [name, street, postalCity].filter(Boolean).join(', ');
  }

  /** Shorter card heading when every name starts with "Boulders …". Full name stays in tooltip + maps query. */
  function displayGymTitle(fullName) {
    const s = fullName != null ? String(fullName).trim() : '';
    if (!s) return 'Location';
    const m = /^boulders\s+/i.exec(s);
    if (m) {
      const rest = s.slice(m[0].length).trim();
      return rest || s;
    }
    return s;
  }

  function normalizeGymTitleKey(s) {
    return String(s || '')
      .trim()
      .toLowerCase()
      .replace(/^boulders\s+/i, '');
  }

  function isMemberPrimaryGymDirectoryEntry(gym, customer) {
    if (!gym || !customer) return false;
    const gid = gym.id;
    const bu = customer.businessUnit;
    if (gid != null && bu?.id != null && Number(gid) === Number(bu.id)) return true;
    const gKey = normalizeGymTitleKey(gym.name);
    const candidates = [customer.primaryGym, bu?.name, bu?.displayName]
      .filter((x) => x != null && String(x).trim())
      .map((x) => String(x).trim());
    for (const c of candidates) {
      const ck = normalizeGymTitleKey(c);
      if (ck && gKey && ck === gKey) return true;
      if (c && gym.name && String(gym.name).trim().toLowerCase() === c.toLowerCase()) return true;
    }
    return false;
  }

  const GYM_HOURS_TZ = 'Europe/Copenhagen';

  function getNowMinutesCopenhagen() {
    const d = new Date();
    const str = d.toLocaleTimeString('en-GB', {
      timeZone: GYM_HOURS_TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = str.split(':');
    const hh = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0;
    return hh * 60 + mm;
  }

  /** Parse strings like "08 - 23", "10:00–22:30" into minutes since midnight (same-day only). */
  function parseOpeningHoursRange(text) {
    if (!text || typeof text !== 'string') return null;
    const t = text.trim();
    const m = t.match(/(\d{1,2})(?:[:.](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:.](\d{2}))?/);
    if (!m) return null;
    const oh = parseInt(m[1], 10);
    const om = m[2] != null && m[2] !== '' ? parseInt(m[2], 10) : 0;
    const ch = parseInt(m[3], 10);
    const cm = m[4] != null && m[4] !== '' ? parseInt(m[4], 10) : 0;
    if (
      [oh, om, ch, cm].some((x) => !Number.isFinite(x)) ||
      oh < 0 ||
      oh > 23 ||
      ch < 0 ||
      ch > 23 ||
      om < 0 ||
      om > 59 ||
      cm < 0 ||
      cm > 59
    ) {
      return null;
    }
    const openMin = oh * 60 + om;
    const closeMin = ch * 60 + cm;
    if (closeMin <= openMin) return null;
    return { openMin, closeMin };
  }

  function formatTimeDK(totalMin) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return m === 0 ? `${h}.00` : `${h}.${String(m).padStart(2, '0')}`;
  }

  function buildGymOpeningStatusRow(gym) {
    const getter =
      typeof window !== 'undefined' && typeof window.getGymOpeningHours === 'function'
        ? window.getGymOpeningHours
        : null;
    if (!getter) return null;
    const hoursText = getter(gym);
    if (!hoursText || !String(hoursText).trim()) return null;
    const parsed = parseOpeningHoursRange(String(hoursText));
    if (!parsed) return null;

    const now = getNowMinutesCopenhagen();
    const el = document.createElement('div');
    el.className = 'gym-directory-openstatus';
    if (now >= parsed.openMin && now < parsed.closeMin) {
      el.classList.add('gym-directory-openstatus--open');
      el.textContent = `Open now · Closes at ${formatTimeDK(parsed.closeMin)}`;
    } else {
      el.classList.add('gym-directory-openstatus--closed');
      el.textContent = `Closed · ${String(hoursText).trim()}`;
    }
    return el;
  }

  function appendMapPinIcon(linkEl) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '16');
    svg.setAttribute('height', '16');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute(
      'd',
      'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z'
    );
    svg.appendChild(path);
    linkEl.appendChild(svg);
    const label = document.createElement('span');
    label.textContent = 'Maps';
    linkEl.appendChild(label);
  }

  async function refreshGymsDirectoryPage() {
    const listEl = document.getElementById('gymsDirectoryList');
    const skeletonEl = document.getElementById('gymsDirectorySkeleton');
    const sectionEl = document.getElementById('gymsDirectorySection');
    const errorEl = document.getElementById('gymsDirectoryError');
    if (!listEl || !errorEl) return;

    const token = ++gymsDirectoryLoadToken;
    listEl.innerHTML = '';
    errorEl.hidden = true;
    errorEl.textContent = '';
    if (skeletonEl) skeletonEl.hidden = false;
    if (sectionEl) sectionEl.setAttribute('aria-busy', 'true');

    const api = typeof window !== 'undefined' ? window.businessUnitsAPI : null;
    if (!api || typeof api.getBusinessUnits !== 'function') {
      if (skeletonEl) skeletonEl.hidden = true;
      if (sectionEl) sectionEl.removeAttribute('aria-busy');
      errorEl.hidden = false;
      errorEl.textContent = 'Locations could not be loaded. Please refresh the page.';
      return;
    }

    try {
      const response = await api.getBusinessUnits();
      const gyms = Array.isArray(response) ? response : (response?.data || response?.items || []);
      if (token !== gymsDirectoryLoadToken) return;

      if (skeletonEl) skeletonEl.hidden = true;
      if (sectionEl) sectionEl.removeAttribute('aria-busy');
      const customer = isUserAuthenticated() ? getBestCustomerData() : null;
      gyms
        .filter((g) => g && (g.name || g.address))
        .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }))
        .forEach((gym) => {
          const { street, postalCity } = formatGymAddressLines(gym);
          const fullName = gym.name != null ? String(gym.name).trim() : '';
          const shortTitle = displayGymTitle(fullName || 'Boulders location');
          const isPrimary = customer && isMemberPrimaryGymDirectoryEntry(gym, customer);

          const card = document.createElement('article');
          card.className = 'gym-directory-card';
          if (isPrimary) {
            card.classList.add('gym-directory-card--primary');
          }
          if (fullName) {
            card.setAttribute('aria-label', isPrimary ? `${fullName}, your home gym` : fullName);
          }

          const head = document.createElement('div');
          head.className = 'gym-directory-card-head';

          const title = document.createElement('h3');
          title.className = 'gym-directory-name';
          title.textContent = shortTitle;
          if (fullName && shortTitle !== fullName) {
            title.setAttribute('title', fullName);
          }
          head.appendChild(title);

          if (isPrimary) {
            const badge = document.createElement('span');
            badge.className = 'gym-directory-badge';
            badge.textContent = 'My gym';
            head.appendChild(badge);
          }

          card.appendChild(head);

          const addr = document.createElement('div');
          addr.className = 'gym-directory-address';
          const oneLine = [street, postalCity].filter(Boolean).join(' · ');
          if (oneLine) {
            const line = document.createElement('div');
            line.className = 'gym-directory-address-line';
            line.textContent = oneLine;
            addr.appendChild(line);
          } else {
            const na = document.createElement('div');
            na.className = 'gym-directory-address-muted';
            na.textContent = 'No address listed.';
            addr.appendChild(na);
          }

          const actions = document.createElement('div');
          actions.className = 'gym-directory-actions';
          const q = buildMapsSearchQuery(gym);
          if (q) {
            const mapLink = document.createElement('a');
            mapLink.className = 'gym-directory-link';
            mapLink.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
            mapLink.target = '_blank';
            mapLink.rel = 'noopener noreferrer';
            mapLink.setAttribute('aria-label', fullName ? `Maps: ${fullName}` : 'Open in Google Maps');
            appendMapPinIcon(mapLink);
            actions.appendChild(mapLink);
          }

          card.appendChild(addr);

          const openRow = buildGymOpeningStatusRow(gym);
          if (openRow) {
            card.appendChild(openRow);
          }

          if (actions.childNodes.length) {
            card.appendChild(actions);
          }
          listEl.appendChild(card);
        });

      if (!listEl.children.length) {
        const empty = document.createElement('p');
        empty.className = 'gym-directory-empty';
        empty.textContent = 'No locations were returned. Try again later.';
        listEl.appendChild(empty);
      }
    } catch (err) {
      if (token !== gymsDirectoryLoadToken) return;
      if (skeletonEl) skeletonEl.hidden = true;
      if (sectionEl) sectionEl.removeAttribute('aria-busy');
      errorEl.hidden = false;
      errorEl.textContent = getErrorMessage(err, 'Locations');
    }
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
          saved: 'savedBookings',
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
    if (safeRoute === 'gyms') {
      refreshGymsDirectoryPage();
    }
  }

  let notificationPrivacySaving = false;

  /**
   * @param {object} [customer]
   * @param {{ applyCheckedFromCustomer?: boolean }} [opts] — when false, only updates disabled state (used while saving so we do not revert the checkbox the user just toggled)
   */
  function syncNotificationPrivacyFromCustomer(customer, opts = {}) {
    const { applyCheckedFromCustomer = true } = opts;
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

    if (applyCheckedFromCustomer) {
      emailCb.checked = c.allowMassSendEmail === true;
      smsCb.checked = c.allowMassSendSms === true;
      mailCb.checked = c.allowMassSendMail === true;
    }

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
    // Do not re-apply customer.* to .checked here — that would undo the toggle before the PATCH runs.
    syncNotificationPrivacyFromCustomer(getBestCustomerData(), {
      applyCheckedFromCustomer: false,
    });

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
    const profileHydrating = authenticated && !customer;

    document.body.classList.toggle('authenticated', authenticated);
    document.body.classList.toggle('profile-hydrating', profileHydrating);

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
      if (!profileHydrating) {
        populateProfileViews(customer, metadata);
      }
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

    // User menu: see profile/nav-user-dropdown.js (duplicate listeners here toggled twice per click).

    document.querySelectorAll('.nav-link[data-route]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        setRoute(link.getAttribute('data-route') || 'dashboard');
      });
    });

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

  bindProfileAuthUi({
    ...ctx,
    refreshLoginPageUI,
    populateProfileEditForm,
  });


  bindNotificationPrivacyToggles();
}
