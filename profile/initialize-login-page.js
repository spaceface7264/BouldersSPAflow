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
  collectSubscriptionsArray,
  isTrialLikeSub,
  extractPunchCardFromCustomer,
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
  formatTimeShort,
  formatClassSessionDurationMinutes,
  formatGroupActivitySlotsAvailability,
  formatClassCardAvailabilityFromContext,
  isBrowseSlotsFullyBooked,
  isDropInOnlyClass,
  isLikelySeriesSession,
  hasSeriesCopyHint,
} from './lib/class-activity-pure.js';
import L from 'leaflet';
import DOMPurify from 'dompurify';
import { enrichGymsWithCoordinates } from '../utils/geolocation.js';

/** Assign HTML from static templates or server-derived strings after sanitization (profile bundle). */
function setProfileHtml(el, html) {
  if (!el) return;
  el.innerHTML = DOMPurify.sanitize(String(html ?? ''));
}

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
  const savedAvailabilityLiveItemCache = new Map();

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
    setProfileHtml(
      root,
      '<div class="profile-vc-lightbox__inner">' +
        '<button type="button" class="profile-vc-lightbox__close" aria-label="Close">×</button>' +
        '<img class="profile-vc-lightbox__img" alt="" />' +
        '<p class="profile-vc-lightbox__desc"></p>' +
        '</div>'
    );
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

    const meta = document.createElement('p');
    meta.className = 'profile-addon-card__meta';
    const gym = card.businessUnit?.name || '';
    const expRaw = formatAddonExpiryDisplay(card.validUntil);
    const expPart = expRaw !== '—' ? `Expires ${expRaw}` : '';
    meta.textContent = [gym, expPart].filter(Boolean).join(' • ') || '—';

    head.append(title, side);
    article.append(head, meta);
    return article;
  }

  function renderValueCardsIntoList(listEl, customer, filterFn = null) {
    if (!listEl) return 0;
    clearDashboardEl(listEl);
    const allValueCards = collectValueCardsArray(customer || {});
    const valueCards = typeof filterFn === 'function'
      ? allValueCards.filter((card) => filterFn(card))
      : allValueCards;
    valueCards.forEach((vc) => {
      const el = buildAddonCardElement(vc);
      listEl.appendChild(el);
      hydrateProfileAddonCardMedia(el, vc).catch(() => {});
    });
    return valueCards.length;
  }

  let selectedDashboardAccessKind = null;

  function renderDashboardValueCardsSection(customer) {
    const card = document.getElementById('dashboardValueCardsCard');
    const list = document.getElementById('dashboardValueCardsList');
    if (!card || !list) return;
    const n = renderValueCardsIntoList(list, customer, (cardItem) => !isPunchCardLikeValueCard(cardItem));
    card.style.display = n > 0 ? '' : 'none';
  }



  function clearDashboardEl(el) {
    while (el.firstChild) el.removeChild(el.firstChild);
  }

  function addAccessRow(container, label, value, opts = {}) {
    const { valueMuted = false, valuePositive = false } = opts;
    const row = document.createElement('div');
    row.className = 'dashboard-access-row';
    const l = document.createElement('span');
    l.className = 'dashboard-access-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = `dashboard-access-value${valueMuted ? ' dashboard-access-value--muted' : ''}${valuePositive ? ' dashboard-access-value--positive' : ''}`;
    v.textContent = value == null || value === '' ? '—' : String(value);
    row.append(l, v);
    container.appendChild(row);
  }

  function addPunchCardAccordion(container, cards) {
    if (!container || !Array.isArray(cards) || cards.length === 0) return;
    const row = document.createElement('div');
    row.className = 'dashboard-access-row dashboard-access-row--accordion';

    const details = document.createElement('details');
    details.className = 'dashboard-access-accordion';

    const summary = document.createElement('summary');
    summary.className = 'dashboard-access-accordion__summary';
    const summaryLabel = document.createElement('span');
    summaryLabel.className = 'dashboard-access-accordion__summary-label';
    summaryLabel.textContent = `Punch card details (${cards.length})`;
    const summaryValue = document.createElement('span');
    summaryValue.className = 'dashboard-access-accordion__summary-value';
    summaryValue.textContent = '';
    summary.append(summaryLabel, summaryValue);

    const list = document.createElement('div');
    list.className = 'dashboard-access-accordion__list';

    cards.forEach((card, idx) => {
      const item = document.createElement('div');
      item.className = 'dashboard-access-accordion__item';
      const title = valueCardProductDisplayName(card) || `Punch card ${idx + 1}`;
      const remaining = formatValueCardRemainingLabel(card);
      const validUntil = formatAddonExpiryDisplay(card?.validUntil);
      const value =
        validUntil && validUntil !== '—'
          ? `${remaining || '—'} • Expires ${validUntil}`
          : (remaining || '—');
      item.textContent = `${title}: ${value}`;
      list.appendChild(item);
    });

    details.append(summary, list);
    row.appendChild(details);
    container.appendChild(row);
  }

  function appendInactiveAccessCta(container, selectedKind) {
    if (!container) return;
    const kindLabel =
      selectedKind === 'membership'
        ? 'membership'
        : selectedKind === 'punch_card'
          ? 'punch card'
          : '15-day trial';
    const ctaWrap = document.createElement('div');
    ctaWrap.className = 'dashboard-access-cta';
    const sum = document.createElement('p');
    sum.className = 'dashboard-access-empty-summary';
    sum.textContent = `No active ${kindLabel} found on your profile right now.`;
    const actionsRow = document.createElement('div');
    actionsRow.className = 'dashboard-access-cta-actions';
    const joinBtn = document.createElement('a');
    joinBtn.href = 'https://join.boulders.dk';
    joinBtn.target = '_blank';
    joinBtn.rel = 'noopener noreferrer';
    joinBtn.className = 'profile-action-btn dashboard-access-signup-btn';
    joinBtn.textContent = 'Go to join.boulders.dk';
    actionsRow.append(joinBtn);
    ctaWrap.append(sum, actionsRow);
    container.appendChild(ctaWrap);
  }

  function deriveTrialStartFromEnd(endRaw) {
    if (!endRaw) return null;
    const source = typeof endRaw === 'string' ? endRaw : String(endRaw);
    const m = source.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00Z`);
    if (!Number.isFinite(d.getTime())) return null;
    d.setUTCDate(d.getUTCDate() - 14);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function isPunchCardLikeValueCard(card) {
    const name = (valueCardProductDisplayName(card) || '').toLowerCase();
    return /punch|klip|klippekort|value\s*card|entries|entry/.test(name);
  }

  function numericPunchesLeft(card) {
    if (!card || typeof card !== 'object') return null;
    const raw =
      card.unitsLeft ??
      card.remainingEntries ??
      card.entriesLeft ??
      card.clipsLeft ??
      card.visitsRemaining ??
      card.remainingVisits;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  function getDashboardAccessSources(customer) {
    const safeCustomer = customer || {};
    const subs = collectSubscriptionsArray(safeCustomer);
    return {
      membership: getMembershipData(safeCustomer),
      hasMembership: hasActiveMembership(safeCustomer),
      trialSub: subs.find((s) => isTrialLikeSub(s)) || null,
      punch: extractPunchCardFromCustomer(safeCustomer, subs),
    };
  }

  function resolveDashboardAccessKind(sources, preferredKind) {
    const order = ['trial', 'punch_card', 'membership'];
    const available = {
      trial: Boolean(sources?.trialSub),
      punch_card: Boolean(sources?.punch),
      membership: Boolean(sources?.hasMembership),
    };
    if (selectedDashboardAccessKind && available[selectedDashboardAccessKind]) {
      return selectedDashboardAccessKind;
    }
    if (preferredKind && available[preferredKind]) return preferredKind;
    const primaryKind = detectPrimaryAccess(getBestCustomerData() || {}).kind;
    if (available[primaryKind]) return primaryKind;
    return order.find((k) => available[k]) || 'trial';
  }

  function dashboardAccessKindLabel(kind) {
    if (kind === 'membership') return 'Membership';
    if (kind === 'punch_card') return 'Punch card';
    return '15-day trial';
  }

  function bindDashboardAccessDropdown(root) {
    if (!root || root.dataset.accessDropdownBound === '1') return;
    const trigger = root.querySelector('.cs-trigger');
    const list = root.querySelector('.cs-list');
    if (!trigger || !list) return;
    root.dataset.accessDropdownBound = '1';

    function enabledOptions() {
      return Array.from(list.querySelectorAll('[role="option"]')).filter(
        (o) => o.getAttribute('aria-disabled') !== 'true'
      );
    }

    function resetOptionTabindex() {
      list.querySelectorAll('[role="option"]').forEach((o) => {
        o.tabIndex = -1;
      });
    }

    function closeDropdown(focusTrigger) {
      if (!list.classList.contains('open')) return;
      list.classList.remove('open');
      list.setAttribute('aria-hidden', 'true');
      trigger.setAttribute('aria-expanded', 'false');
      root.classList.remove('is-open');
      resetOptionTabindex();
      if (focusTrigger) trigger.focus();
    }

    function openDropdown() {
      if (list.classList.contains('open')) return;
      list.classList.add('open');
      list.setAttribute('aria-hidden', 'false');
      trigger.setAttribute('aria-expanded', 'true');
      root.classList.add('is-open');
      resetOptionTabindex();
      const opts = enabledOptions();
      const selected = list.querySelector('[role="option"][aria-selected="true"]');
      const toFocus =
        selected && selected.getAttribute('aria-disabled') !== 'true' ? selected : opts[0];
      if (toFocus) toFocus.tabIndex = 0;
      if (toFocus) toFocus.focus();
    }

    function toggleDropdown() {
      if (!list.classList.contains('open')) openDropdown();
      else closeDropdown(true);
    }

    function applySelection(value) {
      selectedDashboardAccessKind = value;
      const customer = getBestCustomerData();
      renderDashboardAccessPanel(customer);
      renderDashboardValueCardsSection(customer);
      closeDropdown(true);
    }

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    });

    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!list.classList.contains('open')) openDropdown();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!root.contains(e.target)) closeDropdown(true);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !list.classList.contains('open')) return;
      if (!root.contains(document.activeElement)) return;
      e.preventDefault();
      closeDropdown(true);
    });

    list.addEventListener('keydown', (e) => {
      const opts = enabledOptions();
      const cur = document.activeElement;
      const idx = opts.indexOf(cur);
      if (e.key === 'Escape') {
        e.preventDefault();
        closeDropdown(true);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (idx >= 0 && idx < opts.length - 1) {
          cur.tabIndex = -1;
          opts[idx + 1].tabIndex = 0;
          opts[idx + 1].focus();
        }
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (idx > 0) {
          cur.tabIndex = -1;
          opts[idx - 1].tabIndex = 0;
          opts[idx - 1].focus();
        } else {
          closeDropdown(true);
        }
        return;
      }
      if (e.key === 'Home' && opts[0]) {
        e.preventDefault();
        if (cur && cur.getAttribute('role') === 'option') cur.tabIndex = -1;
        opts[0].tabIndex = 0;
        opts[0].focus();
        return;
      }
      if (e.key === 'End' && opts.length) {
        e.preventDefault();
        const last = opts[opts.length - 1];
        if (cur && cur.getAttribute('role') === 'option') cur.tabIndex = -1;
        last.tabIndex = 0;
        last.focus();
        return;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (cur?.dataset?.value) applySelection(cur.dataset.value);
      }
    });

    list.addEventListener('click', (e) => {
      const opt = e.target.closest('.cs-option');
      if (!opt || opt.getAttribute('aria-disabled') === 'true') return;
      e.preventDefault();
      applySelection(opt.dataset.value);
    });
  }

  function renderDashboardAccessPanel(customer) {
    const rowsEl = document.getElementById('dashboardAccessRows');
    const badgeRoot = document.getElementById('dashboardAccessBadge');
    if (!rowsEl || !badgeRoot) return;

    clearDashboardEl(rowsEl);
    const sources = getDashboardAccessSources(customer);
    const membership = sources.membership;
    let selectedKind = detectPrimaryAccess(customer || {}).kind;

    bindDashboardAccessDropdown(badgeRoot);
    const optionStates = {
      trial: Boolean(sources.trialSub),
      punch_card: Boolean(sources.punch),
      membership: Boolean(sources.hasMembership),
    };
    badgeRoot.querySelectorAll('[role="option"]').forEach((opt) => {
      const value = opt.dataset.value;
      const available = optionStates[value];
      opt.setAttribute('aria-disabled', available ? 'false' : 'true');
      opt.classList.toggle('cs-option--disabled', !available);
    });
    selectedKind = resolveDashboardAccessKind(sources, selectedKind);
    selectedDashboardAccessKind = selectedKind;
    const valueEl = badgeRoot.querySelector('.cs-value');
    badgeRoot.querySelectorAll('[role="option"]').forEach((opt) => {
      const sel = opt.dataset.value === selectedKind;
      opt.setAttribute('aria-selected', sel ? 'true' : 'false');
      opt.classList.toggle('active', sel);
    });
    if (valueEl) valueEl.textContent = dashboardAccessKindLabel(selectedKind);

    if (selectedKind === 'membership') {
      if (!sources.hasMembership) {
        addAccessRow(rowsEl, 'Status', 'Inactive', { valueMuted: true });
        appendInactiveAccessCta(rowsEl, selectedKind);
        return;
      }
      addAccessRow(rowsEl, 'Status', 'Active', { valuePositive: true });
      addAccessRow(rowsEl, 'Member since', formatDisplayDate(membership.activeSince));
      addAccessRow(
        rowsEl,
        'Price',
        formatPriceDisplay(membership.price, membership.priceCurrency)
      );
      if (membership.boundUntil) {
        addAccessRow(rowsEl, 'Bound until', formatDisplayDate(membership.boundUntil));
      }
      addAccessRow(rowsEl, 'Plan', membership.type);
      return;
    }

    if (selectedKind === 'punch_card') {
      if (!sources.punch) {
        addAccessRow(rowsEl, 'Status', 'Inactive', { valueMuted: true });
        appendInactiveAccessCta(rowsEl, selectedKind);
        return;
      }
      addAccessRow(rowsEl, 'Status', 'Active', { valuePositive: true });
      const allValueCards = collectValueCardsArray(customer || {});
      const punchCards = allValueCards.filter((card) => isPunchCardLikeValueCard(card));
      const activeValueCards = punchCards.filter((card) => !valueCardIsExpiredOrInvalid(card));
      const cardsToShow = activeValueCards.length > 0 ? activeValueCards : punchCards;
      const cardsForTotals = activeValueCards.length > 0 ? activeValueCards : punchCards;
      const totalPunches = cardsForTotals.reduce((sum, card) => {
        const n = numericPunchesLeft(card);
        return n == null ? sum : sum + n;
      }, 0);
      const hasNumericTotal = cardsForTotals.some((card) => numericPunchesLeft(card) != null);
      addAccessRow(rowsEl, 'Total punches available', hasNumericTotal ? String(totalPunches) : '—');
      if (cardsToShow.length > 0) addPunchCardAccordion(rowsEl, cardsToShow);
      if (cardsToShow.length === 0) {
        const entries =
          sources.punch.entriesLeft != null && sources.punch.entriesLeft !== ''
            ? String(sources.punch.entriesLeft)
            : '—';
        addAccessRow(rowsEl, 'Entries left', entries);
        addAccessRow(
          rowsEl,
          'Valid until',
          sources.punch.expiryRaw ? formatDisplayDate(sources.punch.expiryRaw) : '—'
        );
      }
      return;
    }

    if (selectedKind === 'trial') {
      if (!sources.trialSub) {
        addAccessRow(rowsEl, 'Status', 'Inactive', { valueMuted: true });
        appendInactiveAccessCta(rowsEl, selectedKind);
        return;
      }
      addAccessRow(rowsEl, 'Status', 'Active', { valuePositive: true });
      const t = sources.trialSub || {};
      const startRaw =
        t.startDate ||
        t.activeSince ||
        t.validFrom ||
        t.beginDate ||
        t.debitedFrom ||
        t.boundFrom ||
        t.validFromDate ||
        t.createdAt;
      const end =
        t.endDate ||
        t.expires ||
        t.validTo ||
        t.trialEndDate ||
        t.boundUntil ||
        t.debitedUntil ||
        t.nextBillingDate;
      const start = startRaw || deriveTrialStartFromEnd(end);
      const trialPlanName =
        t.name ||
        t.productName ||
        t.subscriptionProduct?.name ||
        t.type ||
        t.subscriptionType ||
        '15-day trial';
      addAccessRow(rowsEl, 'Active from', formatDisplayDate(start));
      addAccessRow(rowsEl, 'Active until', formatDisplayDate(end));
      addAccessRow(rowsEl, 'Plan', trialPlanName);
      return;
    }

    if (valueEl) {
      valueEl.textContent = 'No access found';
    }
    if (membership.type && membership.type !== '-') {
      addAccessRow(rowsEl, 'Plan on file', membership.type);
    }
    addAccessRow(rowsEl, 'Status', 'Inactive', { valueMuted: true });
    appendInactiveAccessCta(rowsEl, selectedKind);

    return;
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
    setProfileHtml(
      root,
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
        '</div></div>'
    );
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
      label.textContent =
        left <= 0 ? 'Fully booked' : `${left} spot${left === 1 ? '' : 's'} left`;
      wrap.append(dots, label);
      main.appendChild(wrap);
      return;
    }
    const avail = formatClassCardAvailabilityFromContext(ctx || {});
    if (!avail) return;
    const sub = document.createElement('div');
    sub.className = 'booking-item-card__submeta';
    sub.dataset.availability = '1';
    sub.textContent = avail;
    main.appendChild(sub);
  }

  function savedRecordAvailabilityContext(rec, liveItem = null) {
    if (!rec || typeof rec !== 'object') return null;
    const snap = rec.browseSnapshot && typeof rec.browseSnapshot === 'object' ? rec.browseSnapshot : null;
    const slots =
      rec.slots ||
      snap?.slots ||
      snap?.groupActivity?.slots ||
      snap?.event?.slots ||
      liveItem?.slots ||
      liveItem?.groupActivity?.slots ||
      liveItem?.event?.slots ||
      null;
    if (!slots || typeof slots !== 'object') return null;
    const sourceName =
      rec.title ||
      liveItem?.name ||
      liveItem?.groupActivity?.name ||
      liveItem?.event?.name ||
      snap?.name ||
      '';
    return {
      slots,
      source: {
        name: sourceName,
      },
      booking: {
        name: sourceName,
      },
    };
  }

  function savedCardHasAvailability(main) {
    if (!main) return false;
    return Boolean(main.querySelector('.booking-item-card__availability, .booking-item-card__submeta[data-availability="1"]'));
  }

  async function hydrateSavedCardAvailability(card, rec) {
    if (!card || !rec || !rec.key) return;
    const info =
      card.querySelector('.booking-item-card__list-info') || card.querySelector('.booking-item-card__main');
    if (!info || savedCardHasAvailability(info)) return;
    let liveItem = null;
    if (savedAvailabilityLiveItemCache.has(rec.key)) {
      liveItem = savedAvailabilityLiveItemCache.get(rec.key) || null;
    } else {
      try {
        const resolved = await resolveSavedRecordToLiveActivity(rec);
        liveItem = resolved?.item || null;
        savedAvailabilityLiveItemCache.set(rec.key, liveItem || null);
      } catch (_) {
        savedAvailabilityLiveItemCache.set(rec.key, null);
        return;
      }
    }
    if (!card.isConnected) return;
    const freshInfo =
      card.querySelector('.booking-item-card__list-info') || card.querySelector('.booking-item-card__main');
    if (!freshInfo || savedCardHasAvailability(freshInfo)) return;
    const availabilityCtx = savedRecordAvailabilityContext(rec, liveItem);
    if (!availabilityCtx) return;
    appendClassCardDurationAvailability(freshInfo, rec?.startIso || '', rec?.endIso || null, availabilityCtx);
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
    setProfileHtml(
      descEl,
      '<span class="class-card-expand__skeleton-line"></span>' +
        '<span class="class-card-expand__skeleton-line class-card-expand__skeleton-line--short"></span>' +
        '<span class="class-card-expand__skeleton-line"></span>' +
        '<span class="class-card-expand__skeleton-line class-card-expand__skeleton-line--mid"></span>'
    );
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
    const lockKey = bookingLockKey(activity);
    if (bookingRequestLocks.has(lockKey)) {
      showToast('Booking already in progress for this class.', 'error');
      return;
    }
    if (isBrowseSourceAlreadyBooked(activity)) {
      showToast('You are already booked for this class.', 'error');
      return;
    }
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
    bookingRequestLocks.add(lockKey);
    primaryBtn.disabled = true;
    try {
      await authAPI.bookCustomerGroupActivity(cid, {
        groupActivityId: gid,
        allowWaitingList,
      });
      markRecentBookingLock(activity);
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
      bookingRequestLocks.delete(lockKey);
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
    const alreadyBooked = isBrowseSourceAlreadyBooked(activity);

    if (!isUserAuthenticated()) {
      const hint = document.createElement('p');
      hint.className = 'class-card-expand__hint';
      hint.textContent = 'Log in to book this class.';
      actionsEl.appendChild(hint);
    } else if (alreadyBooked) {
      const p = document.createElement('p');
      p.className = 'class-card-expand__muted';
      p.textContent = 'You are already booked for this class.';
      actionsEl.appendChild(p);
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
        // Prefer cancelling concrete session bookings so browse slot counts are released per class.
        let cancelledSessionCount = 0;
        for (const rec of seriesBookings) {
          const bid = bookingIdValue(rec);
          if (!bid) continue;
          await authAPI.cancelCustomerGroupActivityBooking(cid, bid, {
            tryToRefund: false,
            bookingType: 'groupActivityBooking',
          });
          cancelledSessionCount += 1;
        }
        if (cancelledSessionCount === 0 && authAPI?.listCustomerEventBookings && authAPI?.cancelCustomerEventBooking) {
          // Fallback when we cannot resolve per-session booking ids.
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
          }
        }
        showToast('Series bookings cancelled.', 'success');
        closeClassCardExpand();
        ensureGroupActivityBookingsLoaded().then(() => {
          refreshClassesBookingsLists();
          refreshDashboardPanels();
        });
        // Trigger immediate + delayed refresh to absorb backend eventual consistency on slot counters.
        applyBrowseClassFilters();
        window.setTimeout(() => {
          applyBrowseClassFilters();
        }, 1400);
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
      if (e?.target && e.target.closest && e.target.closest('.booking-item-card__series-expand')) {
        return;
      }
      if (e?.target && e.target.closest && e.target.closest('.booking-item-card__series-date-row')) {
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
      if (e.target instanceof HTMLElement && e.target.closest('.booking-item-card__series-expand')) {
        return;
      }
      if (e.target instanceof HTMLElement && e.target.closest('.booking-item-card__series-date-row')) {
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
      return buildUpcomingBrpGroupActivityBookings(fromBrp).filter((b) => {
        if (!b || typeof b !== 'object') return false;
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
    const whereText = where ? String(where) : '';
    return { title: String(title), where: whereText ? displayGymTitle(whereText) : '' };
  }

  function isIntroholdTitle(value) {
    const s = String(value || '').toLowerCase().replace(/\s+/g, '');
    return s.includes('introhold');
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

  function normalizeSavedClassRecords(list) {
    const deduped = [];
    const seen = new Set();
    const src = Array.isArray(list) ? list : [];
    src.forEach((rec) => {
      if (!rec || typeof rec !== 'object') return;
      const key = String(rec.key || '').trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      deduped.push({ ...rec, key });
    });
    return deduped;
  }

  function readSavedClassRecordsFromStorageKeys(keys) {
    const merged = [];
    (Array.isArray(keys) ? keys : []).forEach((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) merged.push(...parsed);
      } catch (_) {
        // ignore malformed or blocked storage reads
      }
    });
    return normalizeSavedClassRecords(merged);
  }

  function getSavedClassesAuthContext() {
    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    const customerId = window?.state?.customerId;
    return {
      token: token ? String(token) : '',
      customerId: customerId != null && customerId !== '' ? String(customerId) : '',
    };
  }

  function savedClassesStorageKeyForCustomer(customerId) {
    return `boulders:saved-classes:${String(customerId || '').trim()}`;
  }

  function savedClassesSyncRequest(method, token, body) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, 'https://api.boulders.dk/saved-classes', false);
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (body != null) xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.send(body == null ? null : JSON.stringify(body));
      if (xhr.status < 200 || xhr.status >= 300) {
        return { ok: false, data: null };
      }
      if (!xhr.responseText) return { ok: true, data: {} };
      try {
        return { ok: true, data: JSON.parse(xhr.responseText) };
      } catch (_) {
        return { ok: true, data: {} };
      }
    } catch (_) {
      return { ok: false, data: null };
    }
  }

  function extractSavedClassIdsFromRemotePayload(payload) {
    const raw = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.classIds)
        ? payload.classIds
        : [];
    return Array.from(
      new Set(
        raw
          .map((id) => String(id || '').trim())
          .filter(Boolean)
      )
    );
  }

  function loadSavedClasses() {
    try {
      const { token, customerId } = getSavedClassesAuthContext();
      if (!token || !customerId) {
        const { primaryKey, allKeys } = resolveSavedClassesOwnerKeys();
        const deduped = readSavedClassRecordsFromStorageKeys(allKeys);
        // Keep one canonical copy for this profile to avoid split lists.
        localStorage.setItem(primaryKey, JSON.stringify(deduped));
        return deduped;
      }

      const customerKey = savedClassesStorageKeyForCustomer(customerId);
      const localList = readSavedClassRecordsFromStorageKeys([customerKey]);
      const remoteRes = savedClassesSyncRequest('GET', token, null);
      if (!remoteRes.ok) return localList;

      const remoteIds = extractSavedClassIdsFromRemotePayload(remoteRes.data);
      const remoteIdSet = new Set(remoteIds);
      const localByKey = new Map(localList.map((rec) => [rec.key, rec]));
      const merged = [];
      const seen = new Set();
      remoteIds.forEach((key) => {
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(localByKey.get(key) || { key });
      });
      localList.forEach((rec) => {
        if (!rec?.key || seen.has(rec.key)) return;
        seen.add(rec.key);
        merged.push(rec);
      });

      const hasLocalItemsMissingRemote = localList.some((rec) => rec?.key && !remoteIdSet.has(rec.key));
      if (hasLocalItemsMissingRemote) {
        const putRes = savedClassesSyncRequest('PUT', token, {
          classIds: merged.map((rec) => rec.key),
        });
        if (!putRes.ok) return localList;
      }

      localStorage.removeItem(customerKey);
      return merged;
    } catch {
      return [];
    }
  }

  function persistSavedClasses(list) {
    const normalized = normalizeSavedClassRecords(list);
    try {
      const { token, customerId } = getSavedClassesAuthContext();
      if (!token || !customerId) {
        const { primaryKey } = resolveSavedClassesOwnerKeys();
        localStorage.setItem(primaryKey, JSON.stringify(normalized));
        return;
      }

      // Cache locally regardless of remote outcome so UI remains resilient offline.
      const customerKey = savedClassesStorageKeyForCustomer(customerId);
      localStorage.setItem(customerKey, JSON.stringify(normalized));
      savedClassesSyncRequest('PUT', token, {
        classIds: normalized.map((rec) => rec.key),
      });
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
    let seriesSessionSlots = [];
    if (isSeries && Array.isArray(source?.__seriesBookings) && source.__seriesBookings.length) {
      seriesSessionSlots = source.__seriesBookings.map((rec) => {
        const s = bookingStartIsoValue(rec);
        const e = rec.duration?.end || rec.endTime || rec.endDateTime || null;
        return {
          start: typeof s === 'string' ? s : '',
          end: typeof e === 'string' ? e : null,
        };
      });
      seriesLines = source.__seriesBookings.map((rec, idx, arr) => {
        const s = bookingStartIsoValue(rec);
        const e = rec.duration?.end || rec.endTime || rec.endDateTime || null;
        return `${idx + 1}/${arr.length} · ${formatClassSessionWhenLine(
          typeof s === 'string' ? s : '',
          typeof e === 'string' ? e : null
        )}`;
      });
    } else if (isSeries && occasionSlots.length) {
      seriesSessionSlots = occasionSlots.map(({ start: s, end: e }) => ({
        start: s || '',
        end: e || null,
      }));
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
      seriesSessionSlots,
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
        await openSavedClassBookingFlow(savedRec);
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        openSavedRecordFallbackExpand(savedRec);
      } finally {
        row.classList.remove('is-resolving-saved-class');
      }
    };

    row.addEventListener('click', (e) => {
      if (
        e.target.closest &&
        e.target.closest(
          '.dashboard-saved-reminder__series-details, summary, button, .class-card-expand__btn-secondary'
        )
      ) {
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

  async function openSavedClassBookingFlow(savedRec) {
    if (tryOpenSavedClassSnapshot(savedRec)) return;
    const resolved = await resolveSavedRecordToLiveActivity(savedRec);
    const gymSel = document.getElementById('browseGymFilter');
    if (resolved?.kind === 'event' && resolved.item) {
      openEventExpand(resolved.item);
      return;
    }
    if (resolved?.kind === 'groupActivity' && resolved.item) {
      openClassCardExpandBrowse(resolved.item, gymSel);
      return;
    }
    openSavedRecordFallbackExpand(savedRec);
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
      const card = buildSavedClassListCard(rec, {
        onRemove: () => {
          persistSavedClasses(loadSavedClasses().filter((x) => x && x.key !== rec.key));
          renderSavedBookingsList();
          refreshDashboardPanels();
        },
      });
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

  function buildSavedClassListCard(rec, options = {}) {
    const card = document.createElement('div');
    card.className = 'booking-item-card booking-item-card--my-bookings-list';
    const mediaSource = rec?.imageUrl ? { __resolvedImageUrl: rec.imageUrl } : {};
    card.appendChild(createClassCardMediaEl(mediaSource, rec?.title || 'Class'));
    const main = document.createElement('div');
    main.className = 'booking-item-card__main';
    const savedTitleText = rec?.title || 'Class';
    const isSavedSeries = rec?.isSeries && Array.isArray(rec?.seriesLines) && rec.seriesLines.length;
    if (isSavedSeries) {
      let stepRows = null;
      if (
        Array.isArray(rec.seriesSessionSlots) &&
        rec.seriesSessionSlots.length &&
        rec.seriesSessionSlots.length === rec.seriesLines.length
      ) {
        stepRows = rec.seriesSessionSlots.map((slot) => ({
          step: {
            startIso: typeof slot?.start === 'string' ? slot.start : '',
            endIso: typeof slot?.end === 'string' ? slot.end : null,
          },
        }));
      } else if (rec.browseSnapshot && typeof rec.browseSnapshot === 'object') {
        try {
          const slots = mapEventOccasionSlots(rec.browseSnapshot);
          if (slots.length && slots.length === rec.seriesLines.length) {
            stepRows = slots.map((slot) => ({
              step: {
                startIso: slot.start || '',
                endIso: slot.end || null,
              },
            }));
          }
        } catch (_) {
          /* ignore */
        }
      }
      appendMyBookingsSeriesCollapsibleBlock(main, {
        titleText: savedTitleText,
        rangeText: savedClassSeriesRangeLine(rec),
        sessionCount: rec.seriesLines.length,
        rows:
          stepRows ||
          rec.seriesLines.map((line) => ({
            fallbackText: line,
          })),
      });
    } else {
      const h = document.createElement('strong');
      h.className = 'booking-item-card__title';
      h.textContent = savedTitleText;
      const meta = document.createElement('div');
      meta.className = 'booking-item-card__meta';
      meta.textContent = formatClassSessionWhenLine(rec?.startIso || '', rec?.endIso || null);
      main.append(h, meta);
    }
    const availabilityCtx = savedRecordAvailabilityContext(rec);
    if (availabilityCtx) {
      appendClassCardDurationAvailability(main, rec?.startIso || '', rec?.endIso || null, availabilityCtx);
    }
    if (rec?.where) appendLocationPillToCardMain(main, rec.where);
    const bookBtn = document.createElement('button');
    bookBtn.type = 'button';
    bookBtn.className = 'profile-action-btn booking-item-card__book-btn booking-item-card__book-btn--saved';
    bookBtn.dataset.bookingCardAction = '1';
    bookBtn.textContent = 'Book now';
    bookBtn.setAttribute('aria-label', `Book ${savedTitleText}`);
    let bookBtnBusy = false;
    const setBookBtnBusy = (busy) => {
      bookBtnBusy = !!busy;
      bookBtn.disabled = bookBtnBusy;
      bookBtn.textContent = bookBtnBusy ? 'Opening...' : 'Book now';
      bookBtn.setAttribute('aria-busy', bookBtnBusy ? 'true' : 'false');
    };
    bookBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (bookBtnBusy) return;
      setBookBtnBusy(true);
      try {
        await openSavedClassBookingFlow(rec);
      } catch (err) {
        showToast(getErrorMessage(err), 'error');
        openSavedRecordFallbackExpand(rec);
      } finally {
        setBookBtnBusy(false);
      }
    });
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'profile-action-btn-secondary class-card-expand__btn-secondary';
    removeBtn.dataset.bookingCardAction = '1';
    removeBtn.textContent = 'Remove';
    let confirmTimeoutId = 0;
    const resetRemoveConfirmState = () => {
      removeBtn.dataset.confirmArmed = '0';
      removeBtn.textContent = 'Remove';
      removeBtn.setAttribute('aria-label', 'Remove saved class');
      if (confirmTimeoutId) {
        window.clearTimeout(confirmTimeoutId);
        confirmTimeoutId = 0;
      }
    };
    removeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (removeBtn.dataset.confirmArmed !== '1') {
        removeBtn.dataset.confirmArmed = '1';
        removeBtn.textContent = 'Remove?';
        removeBtn.setAttribute('aria-label', 'Confirm removal of saved class');
        confirmTimeoutId = window.setTimeout(() => {
          resetRemoveConfirmState();
        }, 3200);
        return;
      }
      resetRemoveConfirmState();
      if (typeof options.onRemove === 'function') options.onRemove(rec);
    });
    removeBtn.addEventListener('blur', () => {
      if (removeBtn.dataset.confirmArmed === '1') {
        resetRemoveConfirmState();
      }
    });
    main.append(bookBtn, removeBtn);
    finalizeMyBookingsListCardMain(main);
    card.appendChild(main);
    if (!savedCardHasAvailability(card)) {
      void hydrateSavedCardAvailability(card, rec);
    }
    return card;
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

  function bookingGroupActivityIdValue(b) {
    const raw =
      b?.groupActivity?.id ??
      b?.groupActivityId ??
      b?.groupActivity?.groupActivityId ??
      b?.activityId;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const bookingRequestLocks = new Set();
  const recentlyBookedAtByKey = new Map();
  const RECENT_BOOKING_LOCK_MS = 2 * 60 * 1000;

  function bookingLockKey(source) {
    return classSaveKey(source || {});
  }

  function pruneRecentBookingLocks(nowMs = Date.now()) {
    for (const [key, ts] of recentlyBookedAtByKey.entries()) {
      if (!Number.isFinite(ts) || nowMs - ts > RECENT_BOOKING_LOCK_MS) {
        recentlyBookedAtByKey.delete(key);
      }
    }
  }

  function hasRecentBookingLock(source) {
    pruneRecentBookingLocks();
    return recentlyBookedAtByKey.has(bookingLockKey(source));
  }

  function markRecentBookingLock(source) {
    recentlyBookedAtByKey.set(bookingLockKey(source), Date.now());
  }

  function activeNonCancelledBookings() {
    const raw = Array.isArray(getBestCustomerData()?.groupActivityBookings)
      ? getBestCustomerData().groupActivityBookings
      : [];
    const now = Date.now();
    return dedupeCustomerBookings(raw).filter((b) => {
      if (!b || typeof b !== 'object') return false;
      if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
      const end = brpBookingEndMs(b);
      const start = brpBookingStartMs(b);
      if (end) return end >= now;
      if (start) return start >= now;
      return true;
    });
  }

  function isBrowseSourceAlreadyBooked(source) {
    if (!source || typeof source !== 'object') return false;
    if (hasRecentBookingLock(source)) return true;
    const list = activeNonCancelledBookings();
    if (!list.length) return false;
    const kind = source.__kind || (source.occasions ? 'event' : 'groupActivity');
    const targetEventId =
      kind === 'event'
        ? (() => {
            const n = Number(source?.id ?? source?.event?.id);
            return Number.isFinite(n) && n > 0 ? n : null;
          })()
        : null;
    if (targetEventId) return list.some((b) => bookingEventIdValue(b) === targetEventId);

    const targetGaId =
      kind === 'groupActivity'
        ? (() => {
            const n = Number(source?.id ?? source?.groupActivity?.id ?? source?.groupActivityId);
            return Number.isFinite(n) && n > 0 ? n : null;
          })()
        : null;
    if (targetGaId && list.some((b) => bookingGroupActivityIdValue(b) === targetGaId)) return true;

    const targetStart = Date.parse(bookingStartIsoValue(source) || source?.duration?.start || '');
    const targetName = normalizeSeriesNameForBookings(source?.name || bookingDisplayLine(source).title);
    const targetBu = classCardBusinessUnitId(source);
    return list.some((b) => {
      if (isBrpWaitingListBooking(b)) return false;
      const bStart = Date.parse(bookingStartIsoValue(b));
      if (Number.isFinite(targetStart) && Number.isFinite(bStart)) {
        const sameMinute = Math.floor(targetStart / 60000) === Math.floor(bStart / 60000);
        if (!sameMinute) return false;
      }
      const bName = normalizeSeriesNameForBookings(bookingDisplayLine(b).title);
      if (!bName || !targetName) return false;
      const sameName = bName === targetName || bName.includes(targetName) || targetName.includes(bName);
      if (!sameName) return false;
      const bBu = classCardBusinessUnitId(b);
      return !targetBu || !bBu || bBu === targetBu;
    });
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
    const sessionFullyPast = (b) => {
      const end = brpBookingEndMs(b);
      const start = brpBookingStartMs(b);
      if (end) return end < now;
      if (start) return start < now;
      return false;
    };

    if (targetEventId) {
      return list.filter((b) => {
        if (!b || isBrpWaitingListBooking(b)) return false;
        if (b.status && String(b.status).toLowerCase() === 'cancelled') return false;
        if (sessionFullyPast(b)) return false;
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
      if (sessionFullyPast(b)) return false;
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

  function appendUrgencyPillsToCardMain(main, source) {
    if (!main || !source || typeof source !== 'object') return;
    let pills = main.querySelector('.booking-item-card__pills');
    if (!pills) {
      pills = document.createElement('div');
      pills.className = 'booking-item-card__pills';
      main.appendChild(pills);
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const startMs = Date.parse(source?.duration?.start || '');
    if (Number.isFinite(startMs)) {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startDay = new Date(startMs);
      const startDayStart = new Date(
        startDay.getFullYear(),
        startDay.getMonth(),
        startDay.getDate()
      ).getTime();
      const daysUntil = Math.round((startDayStart - todayStart) / DAY_MS);
      if (daysUntil >= 0 && daysUntil <= 7) {
        const soonPill = document.createElement('span');
        soonPill.className = 'booking-item-card__pill booking-item-card__pill--urgency-soon';
        soonPill.textContent =
          daysUntil === 0 ? 'Starting today' : `Starting in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`;
        pills.appendChild(soonPill);
      }
    }

    const slots = source?.slots && typeof source.slots === 'object' ? source.slots : null;
    const leftRaw = slots?.leftToBookIncDropin ?? slots?.leftToBook ?? slots?.available ?? slots?.left;
    const left = leftRaw != null ? Number(leftRaw) : NaN;
    if (Number.isFinite(left) && left > 0 && left <= 3) {
      const spotsPill = document.createElement('span');
      spotsPill.className = 'booking-item-card__pill booking-item-card__pill--urgency-spots';
      spotsPill.textContent = `Only ${left} spot${left === 1 ? '' : 's'} left`;
      pills.appendChild(spotsPill);
    }
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

  /**
   * Flat list of group-activity bookings for “upcoming” UIs: includes every session in a series
   * while any session is still active (end ≥ now), and uses end time—not start—to drop finished sessions.
   */
  function buildUpcomingBrpGroupActivityBookings(rawItems) {
    const list = dedupeCustomerBookings(Array.isArray(rawItems) ? rawItems : []);
    if (!list.length) return [];
    const now = Date.now();
    const sessionNotPast = (b) => {
      if (!b || isBrpWaitingListBooking(b)) return false;
      const end = brpBookingEndMs(b);
      const start = brpBookingStartMs(b);
      if (end) return end >= now;
      if (start) return start >= now;
      return true;
    };
    const units = buildGroupedBookingRenderUnits(list);
    const out = [];
    units.forEach((unit) => {
      if (unit.kind === 'single') {
        const b = unit.booking;
        if (!sessionNotPast(b)) return;
        out.push(b);
        return;
      }
      const g = unit.bookings.filter((b) => b && !isBrpWaitingListBooking(b));
      if (!g.length) return;
      if (!g.some((b) => sessionNotPast(b))) return;
      g.forEach((b) => out.push(b));
    });
    out.sort((a, b) => brpBookingStartMs(a) - brpBookingStartMs(b));
    return out;
  }

  let brpMyBookingsSeriesPanelSeq = 0;

  /** Past / completed session → filled dot; upcoming → hollow dot. */
  function myBookingsSeriesSessionCompleted(startIso, endIso, nowMs = Date.now()) {
    const endMs = typeof endIso === 'string' ? Date.parse(endIso) : NaN;
    const startMs = typeof startIso === 'string' ? Date.parse(startIso) : NaN;
    const compareMs = Number.isFinite(endMs) && endMs > startMs ? endMs : startMs;
    return Number.isFinite(compareMs) && compareMs < nowMs;
  }

  function formatMyBookingsSeriesStepLine(startIso, endIso) {
    const startMs = typeof startIso === 'string' ? Date.parse(startIso) : NaN;
    if (!Number.isFinite(startMs)) {
      return { dateStr: '—', timeStr: '—', completed: false };
    }
    const d0 = new Date(startMs);
    const dateStr = formatDateLong(startIso);
    const endMs = typeof endIso === 'string' ? Date.parse(endIso) : NaN;
    const hasEnd = Number.isFinite(endMs) && endMs > startMs;
    let timeStr = '—';
    if (hasEnd) {
      const d1 = new Date(endMs);
      const sameDay =
        d0.getFullYear() === d1.getFullYear() &&
        d0.getMonth() === d1.getMonth() &&
        d0.getDate() === d1.getDate();
      const ts = formatTimeShort(startIso);
      const te = formatTimeShort(endIso);
      if (sameDay && ts && te) {
        timeStr = `${ts}\u2013${te}`;
      } else {
        timeStr = [ts, te].filter(Boolean).join(' \u2192 ') || '—';
      }
    } else {
      timeStr = formatTimeShort(startIso) || '—';
    }
    const completed = myBookingsSeriesSessionCompleted(startIso, endIso);
    return { dateStr, timeStr, completed };
  }

  function stripSavedSeriesLinePrefix(line) {
    return String(line || '').replace(/^\d+\s*\/\s*\d+\s*[·•]\s*/u, '').trim();
  }

  function savedClassSeriesRangeLine(rec) {
    const firstText = formatDateLong(rec?.startIso);
    const lastText = formatDateLong(rec?.endIso);
    if (!firstText || firstText === '—') return '—';
    if (!lastText || lastText === '—' || lastText === firstText) return firstText;
    return `${firstText} – ${lastText}`;
  }

  const MY_BOOKINGS_SERIES_CALENDAR_SVG =
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';

  /**
   * Collapsible session list for My Bookings list cards (bookings + saved series).
   * @param {object} main — card main element
   * @param {{ titleText: string, rangeText: string, sessionCount: number, rows: { step?: { startIso: string, endIso?: string | null }, fallbackText?: string, text?: string }[] }} spec
   */
  function appendMyBookingsSeriesCollapsibleBlock(main, { titleText, rangeText, sessionCount, rows }) {
    brpMyBookingsSeriesPanelSeq += 1;
    const panelId = `brpSeriesPanel_${brpMyBookingsSeriesPanelSeq}`;
    const titleRow = document.createElement('div');
    titleRow.className = 'booking-item-card__series-title-row';
    const h = document.createElement('strong');
    h.className = 'booking-item-card__title';
    h.textContent = titleText || 'Class';
    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'booking-item-card__series-expand';
    expandBtn.setAttribute('aria-expanded', 'false');
    expandBtn.setAttribute('aria-controls', panelId);
    expandBtn.setAttribute('aria-label', `Show ${sessionCount} session times`);
    const sessionsPill = document.createElement('span');
    sessionsPill.className =
      'booking-item-card__pill booking-item-card__pill--series-sessions booking-item-card__pill--series-inline';
    sessionsPill.textContent = `${sessionCount} sessions`;
    const chev = document.createElement('span');
    chev.className = 'booking-item-card__series-chevron';
    chev.setAttribute('aria-hidden', 'true');
    setProfileHtml(
      chev,
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>'
    );
    expandBtn.appendChild(sessionsPill);
    titleRow.append(h, expandBtn);
    main.appendChild(titleRow);

    const dateRow = document.createElement('div');
    dateRow.className = 'booking-item-card__series-date-row';
    dateRow.setAttribute('role', 'button');
    dateRow.tabIndex = 0;
    dateRow.setAttribute('aria-expanded', 'false');
    dateRow.setAttribute('aria-controls', panelId);
    dateRow.setAttribute('aria-label', `Show ${sessionCount} session times`);
    const calWrap = document.createElement('span');
    calWrap.className = 'booking-item-card__series-calendar-icon';
    calWrap.setAttribute('aria-hidden', 'true');
    setProfileHtml(calWrap, MY_BOOKINGS_SERIES_CALENDAR_SVG);
    const rangeEl = document.createElement('span');
    rangeEl.className = 'booking-item-card__meta booking-item-card__meta--series-range';
    rangeEl.textContent = rangeText;
    dateRow.append(calWrap, rangeEl, chev);
    main.appendChild(dateRow);

    const seriesPanel = document.createElement('div');
    seriesPanel.className = 'booking-item-card__series-panel';
    seriesPanel.id = panelId;
    seriesPanel.setAttribute('role', 'region');
    seriesPanel.setAttribute('aria-label', 'Sessions');
    const panelSleeve = document.createElement('div');
    panelSleeve.className = 'booking-item-card__series-panel-sleeve';
    const seriesRows = document.createElement('div');
    seriesRows.className =
      'booking-item-card__series-list booking-item-card__series-list--my-bookings';
    rows.forEach((rowSpec) => {
      const row = document.createElement('div');
      row.className = 'booking-item-card__series-row';
      if (rowSpec.step) {
        const { startIso, endIso } = rowSpec.step;
        const { dateStr, timeStr, completed } = formatMyBookingsSeriesStepLine(
          typeof startIso === 'string' ? startIso : '',
          endIso != null && typeof endIso === 'string' ? endIso : null
        );
        row.classList.add('booking-item-card__series-row--step');
        const dot = document.createElement('span');
        dot.className = `booking-item-card__series-step-dot${completed ? ' is-complete' : ' is-upcoming'}`;
        dot.setAttribute('aria-hidden', 'true');
        dot.textContent = completed ? '\u25cf' : '\u25cb';
        const body = document.createElement('span');
        body.className = 'booking-item-card__series-step-body';
        const dateEl = document.createElement('span');
        dateEl.className = 'booking-item-card__series-step-date';
        dateEl.textContent = dateStr;
        const timeEl = document.createElement('span');
        timeEl.className = 'booking-item-card__series-step-time';
        timeEl.textContent = timeStr;
        body.append(dateEl, timeEl);
        row.append(dot, body);
        row.setAttribute(
          'aria-label',
          `${completed ? 'Completed session' : 'Upcoming session'}: ${dateStr} ${timeStr}`
        );
      } else if (rowSpec.fallbackText != null) {
        row.classList.add('booking-item-card__series-row--fallback');
        row.textContent = stripSavedSeriesLinePrefix(rowSpec.fallbackText);
      } else if (rowSpec.text) {
        row.textContent = rowSpec.text;
      }
      seriesRows.appendChild(row);
    });
    panelSleeve.appendChild(seriesRows);
    seriesPanel.appendChild(panelSleeve);
    main.appendChild(seriesPanel);

    const toggleSeriesPanel = () => {
      const open = !seriesPanel.classList.contains('is-expanded');
      seriesPanel.classList.toggle('is-expanded', open);
      const exp = open ? 'true' : 'false';
      const label = open ? 'Hide session times' : `Show ${sessionCount} session times`;
      expandBtn.setAttribute('aria-expanded', exp);
      expandBtn.setAttribute('aria-label', label);
      dateRow.setAttribute('aria-expanded', exp);
      dateRow.setAttribute('aria-label', label);
    };
    expandBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSeriesPanel();
    });
    dateRow.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSeriesPanel();
    });
    dateRow.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopPropagation();
      toggleSeriesPanel();
    });
  }

  /** Horizontal list-row layout: primary info vs trailing pills / remove (My Bookings lists only). */
  function finalizeMyBookingsListCardMain(main) {
    if (!main || main.dataset.listLayoutFinalized === '1') return;
    main.dataset.listLayoutFinalized = '1';
    const pills = main.querySelector('.booking-item-card__pills');
    const fallbackActionBtn = main.querySelector(
      'button.profile-action-btn-secondary.class-card-expand__btn-secondary'
    );
    const actionButtons = Array.from(main.querySelectorAll('button[data-booking-card-action="1"]'));
    if (!actionButtons.length && fallbackActionBtn) actionButtons.push(fallbackActionBtn);
    const info = document.createElement('div');
    info.className = 'booking-item-card__list-info';
    const trail = document.createElement('div');
    trail.className = 'booking-item-card__list-trail';
    const nodes = Array.from(main.childNodes);
    nodes.forEach((node) => {
      if (node === pills) return;
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        node instanceof HTMLElement &&
        node.matches('button[data-booking-card-action="1"]')
      ) {
        return;
      }
      if (node === fallbackActionBtn) return;
      if (node.nodeType === Node.ELEMENT_NODE) info.appendChild(node);
    });
    main.appendChild(info);
    if (pills || actionButtons.length) {
      if (pills) trail.appendChild(pills);
      actionButtons.forEach((btn) => trail.appendChild(btn));
      main.appendChild(trail);
    }
  }

  function renderBookingsListInto(container, items, emptyMessage, listKind = 'upcoming') {
    if (!container) return;
    container.innerHTML = '';
    if (!items.length) {
      const emptyWrap = document.createElement('div');
      emptyWrap.className = 'bookings-empty-state';
      const p = document.createElement('p');
      p.className = 'bookings-empty-msg';
      p.textContent = emptyMessage || 'Nothing here yet.';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'profile-action-btn bookings-empty-cta';
      cta.textContent = 'Browse classes';
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        openClassesBrowseTab();
      });
      emptyWrap.append(p, cta);
      container.appendChild(emptyWrap);
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
        card.className =
          'booking-item-card booking-item-card--my-bookings-list' +
          (listKind === 'past' ? ' booking-item-card--past-list' : '');
        card.appendChild(createClassCardMediaEl(first, title));
        const main = document.createElement('div');
        main.className = 'booking-item-card__main';
        const firstStart = bookingStartIsoValue(bookings[0]);
        const lastStart = bookingStartIsoValue(bookings[bookings.length - 1]);
        const firstText = formatDateLong(firstStart);
        const lastText = formatDateLong(lastStart);
        const rangeLine =
          firstText && lastText && firstText !== '—' && lastText !== '—' && firstText !== lastText
            ? `${firstText} – ${lastText}`
            : firstText;
        appendMyBookingsSeriesCollapsibleBlock(main, {
          titleText: title,
          rangeText: rangeLine,
          sessionCount: bookings.length,
          rows: bookings.map((rec) => {
            const startIso = bookingStartIsoValue(rec);
            const endIso = rec.duration?.end || rec.endTime || rec.endDateTime || null;
            return {
              step: {
                startIso: typeof startIso === 'string' ? startIso : '',
                endIso: typeof endIso === 'string' ? endIso : null,
              },
            };
          }),
        });
        const pills = document.createElement('div');
        pills.className = 'booking-item-card__pills';
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
        finalizeMyBookingsListCardMain(main);
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
      card.className =
        'booking-item-card booking-item-card--my-bookings-list' +
        (listKind === 'past' ? ' booking-item-card--past-list' : '');
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
      finalizeMyBookingsListCardMain(main);
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
    const rawList = Array.isArray(customer?.groupActivityBookings) ? customer.groupActivityBookings : [];
    const fullList = dedupeCustomerBookings(rawList);
    const now = Date.now();

    const upcomingRender = buildUpcomingBrpGroupActivityBookings(rawList);

    const pastTime = fullList.filter((b) => {
      if (!b || isBrpWaitingListBooking(b)) return false;
      const end = brpBookingEndMs(b);
      const start = brpBookingStartMs(b);
      if (end) return end < now;
      if (start) return start < now;
      return false;
    });
    const upcomingSet = new Set(upcomingRender);
    const pastRender = pastTime.filter((b) => !upcomingSet.has(b));
    pastRender.sort((a, b) => brpBookingEndMs(b) - brpBookingEndMs(a));

    const waiting = fullList.filter((b) => b && isBrpWaitingListBooking(b));
    waiting.sort((a, b) => brpBookingStartMs(a) - brpBookingStartMs(b));

    renderBookingsListInto(
      document.getElementById('upcomingBookingsList'),
      upcomingRender,
      'No upcoming bookings.',
      'upcoming'
    );
    renderBookingsListInto(
      document.getElementById('pastBookingsList'),
      pastRender,
      'No past bookings in the loaded period.',
      'past'
    );
    renderBookingsListInto(
      document.getElementById('waitingListBookingsList'),
      waiting,
      'You are not on any waiting lists.',
      'waiting'
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
    if (preset === 'anyTime') {
      start = startOfDay(now);
      end = endOfDay(new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000));
    } else if (preset === 'tomorrow') {
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
        setProfileHtml(sel, '<option value="">All gyms (search each)</option>');
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
        renderBrowseGymChips();
      })
      .catch((e) => console.warn('[Browse] Business units:', e));
  }

  function renderBrowseGymChips() {
    const host = document.getElementById('browseGymChips');
    const sel = document.getElementById('browseGymFilter');
    if (!host || !sel) return;
    const selected = new Set(
      Array.from(host.querySelectorAll('.chip.active[data-gym-value]'))
        .map((el) => String(el.getAttribute('data-gym-value') || ''))
        .filter(Boolean)
    );
    if (!selected.size && sel.value) selected.add(String(sel.value));
    host.innerHTML = '';
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = `chip${selected.size ? '' : ' active'}`;
    allBtn.dataset.gymValue = '';
    allBtn.textContent = 'All';
    host.appendChild(allBtn);
    if (selected.size) {
      const countChip = document.createElement('span');
      countChip.className = 'chip chip-meta';
      countChip.textContent = `${selected.size} selected`;
      host.appendChild(countChip);
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.className = 'chip chip-reset';
      resetBtn.dataset.gymReset = '1';
      resetBtn.textContent = 'Reset gyms';
      host.appendChild(resetBtn);
    }
    Array.from(sel.options)
      .filter((opt) => opt.value)
      .forEach((opt) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chip${selected.has(String(opt.value)) ? ' active' : ''}`;
        btn.dataset.gymValue = String(opt.value);
        btn.textContent = opt.textContent || opt.value;
        host.appendChild(btn);
      });
    refreshBrowseRailFades();
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

  async function tryJoinEventWaitlistViaGroupActivity(ev) {
    if (!ev || !authAPI?.bookCustomerGroupActivity || !authAPI?.listBusinessUnitGroupActivities) return false;
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    if (!cid) return false;
    const buCandidates = [];
    const pushBu = (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return;
      if (!buCandidates.includes(n)) buCandidates.push(n);
    };
    pushBu(classCardBusinessUnitId(ev));
    pushBu(ev?.businessUnit?.id);
    pushBu(getBestCustomerData()?.businessUnit?.id);
    if (authAPI?.listVer3BusinessUnits) {
      try {
        const units = await authAPI.listVer3BusinessUnits();
        (Array.isArray(units) ? units : []).forEach((u) => pushBu(u?.id));
      } catch (_) {
        /* ignore */
      }
    }
    if (!buCandidates.length) return false;
    const norm = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/[^a-z0-9\u00c0-\u024f]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const targetName = norm(ev?.name);
    if (!targetName) return false;
    const targetProductId = Number(extractGroupActivityProductId(ev));
    const eventStartMs = Date.parse(bookingStartIsoValue(ev) || '');
    const aroundStart = Number.isFinite(eventStartMs) ? eventStartMs : Date.now();
    const periodStart = new Date(aroundStart - 45 * 86400000).toISOString();
    const periodEnd = new Date(aroundStart + 120 * 86400000).toISOString();
    for (const buId of buCandidates) {
      const candidateFetches = [
        { periodStart, periodEnd, customerId: cid || undefined },
        { periodStart, periodEnd },
        {},
      ];
      for (const opts of candidateFetches) {
        const acts = await authAPI.listBusinessUnitGroupActivities(buId, opts);
        const list = Array.isArray(acts) ? acts : [];
        const scored = list
          .map((a) => {
            const aName = norm(a?.name);
            const aProductId = Number(extractGroupActivityProductId(a));
            const productMatch =
              Number.isFinite(targetProductId) &&
              targetProductId > 0 &&
              Number.isFinite(aProductId) &&
              aProductId === targetProductId;
            const nameMatch =
              aName && (aName === targetName || aName.includes(targetName) || targetName.includes(aName));
            if (!productMatch && !nameMatch) return null;
            const aStartMs = Date.parse(bookingStartIsoValue(a) || '');
            const delta =
              Number.isFinite(eventStartMs) && Number.isFinite(aStartMs) ? Math.abs(aStartMs - eventStartMs) : 0;
            return { a, delta, score: productMatch ? 0 : 1 };
          })
          .filter(Boolean)
          .sort((x, y) => x.score - y.score || x.delta - y.delta);
        for (const candidate of scored) {
          const gid = Number(candidate?.a?.id);
          if (!Number.isFinite(gid) || gid <= 0) continue;
          try {
            await authAPI.bookCustomerGroupActivity(cid, {
              groupActivityId: gid,
              allowWaitingList: true,
            });
            return true;
          } catch (_) {
            // Try next candidate before giving up.
          }
        }
      }
    }
    return false;
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

    const eventTitle = ev?.name || 'Event';
    const gymSel = document.getElementById('browseGymFilter');
    const eventLocation = groupActivityBrowseLocationLabel(ev, gymSel);
    titleEl.textContent = eventTitle;
    const sessions = extractEventSessionLines(ev);
    const baseLines = sessions.length ? sessions : [formatEventSeriesLine(ev)];
    const lines = [...baseLines, ...(eventLocation ? [eventLocation] : [])];
    linesEl.textContent = lines.filter(Boolean).join('\n');
    resetClassCardExpandDescEl(descEl);
    const extMsg = ev?.externalMessage && String(ev.externalMessage).trim();
    const isIntrohold = isIntroholdTitle(eventTitle);
    const defaultSeriesCopy = isIntrohold
      ? 'Introhold is a multi-session course. You will attend all sessions in the series.'
      : 'This is a multi-session course. You’ll attend all sessions in the series.';
    descEl.textContent = isGroupedEventSeries(ev)
      ? extMsg || defaultSeriesCopy
      : extMsg || 'This is an event.';

    actionsEl.innerHTML = '';
    if (isUserAuthenticated()) {
      const alreadyBooked = isBrowseSourceAlreadyBooked({ ...ev, __kind: 'event' });
      const eventIdNum = Number(ev?.id);
      if (alreadyBooked) {
        const p = document.createElement('p');
        p.className = 'class-card-expand__muted';
        p.textContent = 'You are already booked for this course.';
        actionsEl.appendChild(p);
      } else if (Number.isFinite(eventIdNum) && eventIdNum > 0 && authAPI?.bookCustomerEvent) {
        const lockKey = bookingLockKey({ ...ev, __kind: 'event' });
        const slots = ev?.slots && typeof ev.slots === 'object' ? ev.slots : null;
        const leftRaw = slots?.leftToBookIncDropin ?? slots?.leftToBook ?? slots?.available ?? slots?.left;
        const left = leftRaw != null ? Number(leftRaw) : NaN;
        const slotsKnown = Number.isFinite(left);
        const fullyBooked = slotsKnown ? left <= 0 : isBrowseSlotsFullyBooked(slots);
        const introholdSeries = isGroupedEventSeries(ev) && isIntroholdTitle(ev?.name);
        const allowWaitingList =
          (fullyBooked && slots?.hasWaitingList === true) ||
          (introholdSeries && (!slotsKnown || fullyBooked));
        const bookBtn = document.createElement('button');
        bookBtn.type = 'button';
        bookBtn.className = 'profile-action-btn class-card-expand__btn-primary';
        bookBtn.textContent = allowWaitingList ? 'Join waiting list' : 'Book now';
        bookBtn.addEventListener('click', async () => {
          if (bookingRequestLocks.has(lockKey)) {
            showToast('Booking already in progress for this course.', 'error');
            return;
          }
          if (isBrowseSourceAlreadyBooked({ ...ev, __kind: 'event' })) {
            showToast('You are already booked for this course.', 'error');
            return;
          }
          const cid = getBrpNumericCustomerId(getBestCustomerData());
          if (!cid) {
            showToast('Log in to book.', 'error');
            return;
          }
          bookingRequestLocks.add(lockKey);
          bookBtn.disabled = true;
          try {
            const customer = getBestCustomerData() || {};
            await authAPI.bookCustomerEvent(cid, {
              eventId: eventIdNum,
              businessUnitId: classCardBusinessUnitId(ev),
              allowWaitingList,
              participant: {
                firstName: customer.firstName || customer.givenName || '',
                lastName: customer.lastName || customer.familyName || '',
                birthDate: customer.birthDate || customer.dateOfBirth || '',
                ssn: customer.ssn || customer.socialSecurityNumber || '',
              },
            });
            markRecentBookingLock({ ...ev, __kind: 'event' });
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
            if (Number(err?.status) === 403) {
              if (allowWaitingList || (isGroupedEventSeries(ev) && isIntroholdTitle(ev?.name))) {
                try {
                  const joined = await tryJoinEventWaitlistViaGroupActivity(ev);
                  if (joined) {
                    showToast('You are on the waiting list.', 'success');
                    closeClassCardExpand();
                    ensureGroupActivityBookingsLoaded().then(() => {
                      refreshClassesBookingsLists();
                      refreshDashboardPanels();
                    });
                    applyBrowseClassFilters();
                    return;
                  }
                } catch (_) {
                  /* fall back to standard 403 handling */
                }
              }
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
            bookingRequestLocks.delete(lockKey);
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

    if (productId && buId) {
      fetchEventProductDetail(productId, buId).then((detail) => {
        if (!descEl.isConnected) return;
        const pd = detail?.description && String(detail.description).trim();
        const parts = [
          isGroupedEventSeries(ev) ? extMsg || defaultSeriesCopy : extMsg || '',
          pd || '',
        ].filter(Boolean);
        descEl.textContent = parts.length
          ? parts.join('\n\n')
          : isGroupedEventSeries(ev)
            ? defaultSeriesCopy
            : 'This is an event.';
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
    const onlyAvailableEl = document.getElementById('browseOnlyAvailableFilter');
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
      setProfileHtml(
        results,
        '<p class="bookings-empty-msg">Events are not available on this connection.</p>'
      );
      return;
    }

    const cid = getBrpNumericCustomerId(getBestCustomerData());
    const homeBu = getBestCustomerData()?.businessUnit?.id;
    let buIds = [];
    const selectedGymIds = Array.from(
      document.querySelectorAll('#browseGymChips .chip.active[data-gym-value]')
    )
      .map((el) => parseInt(String(el.getAttribute('data-gym-value') || ''), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (selectedGymIds.length) {
      buIds = Array.from(new Set(selectedGymIds));
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
      setProfileHtml(
        results,
        '<p class="bookings-empty-msg">No gym selected. Choose a gym or log in with a profile that has a home gym.</p>'
      );
      return;
    }

    const MAX_PARALLEL_GYMS = 12;
    if (buIds.length > MAX_PARALLEL_GYMS) {
      buIds = buIds.slice(0, MAX_PARALLEL_GYMS);
    }

    renderBrowseCardsSkeleton(results, 8);
    const q = searchEl?.value?.trim().toLowerCase() || '';
    const onlyAvailable = onlyAvailableEl?.checked === true;
    const resultsCountEl = document.getElementById('browseResultsCount');

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

      if (onlyAvailable) {
        flat = flat.filter((a) => {
          if (!isIntroholdTitle(a?.name)) return true;
          return !isBrowseSlotsFullyBooked(a?.slots);
        });
      }

      const quickType = (document.getElementById('browseQuickTypeFilter')?.value || 'all').toLowerCase();
      if (quickType === 'introhold') {
        flat = flat.filter((a) => isIntroholdTitle(a?.name));
      } else if (quickType === 'dropin') {
        flat = flat.filter((a) => isDropInOnlyClass(a));
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
      if (resultsCountEl) {
        resultsCountEl.textContent = `${flat.length} class${flat.length === 1 ? '' : 'es'}`;
      }
      if (!flat.length) {
        setProfileHtml(
          results,
          '<p class="bookings-empty-msg">No classes match these filters.</p>'
        );
        return;
      }
      flat.forEach((a) => {
        const card = document.createElement('div');
        card.className = 'booking-item-card booking-item-card--browse';
        const kind = a.__kind || 'groupActivity';
        const alreadyBooked = isBrowseSourceAlreadyBooked(a);
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
            a.__blockDirectSessionBooking !== true &&
            !alreadyBooked;
          const canJoinWaitingList =
            isIntroholdTitle(a?.name) &&
            isBrowseSlotsFullyBooked(a.slots) &&
            a?.slots?.hasWaitingList === true &&
            !isDropInOnlyClass(a) &&
            !isLikelySeriesSession(a) &&
            a.__blockDirectSessionBooking !== true &&
            !alreadyBooked;
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
          } else if (canJoinWaitingList) {
            const cardWlBtn = document.createElement('button');
            cardWlBtn.type = 'button';
            cardWlBtn.className = 'profile-action-btn booking-item-card__book-btn';
            cardWlBtn.textContent = 'Join waiting list';
            cardWlBtn.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
              openClassCardExpandBrowse(a, gymSel);
            });
            main.appendChild(cardWlBtn);
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
      setProfileHtml(
        results,
        '<p class="bookings-empty-msg">Could not load classes. Try again or pick another gym.</p>'
      );
    }
  }

  function renderBrowseActiveFilterChips() {
    const host = document.getElementById('browseActiveFilters');
    if (!host) return;
    host.hidden = true;
    host.innerHTML = '';
    return;
  }

  function bindBrowseChipInteractions() {
    const gymHost = document.getElementById('browseGymChips');
    const whenHost = document.getElementById('browseWhenChips');
    const typeHost = document.getElementById('browseTypeChips');
    const gymSel = document.getElementById('browseGymFilter');
    const presetSel = document.getElementById('browseDateRangePreset');
    const quickTypeIn = document.getElementById('browseQuickTypeFilter');
    if (gymHost && !gymHost.dataset.bound) {
      gymHost.dataset.bound = '1';
      gymHost.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-gym-value]');
        if (!gymSel) return;
        const resetBtn = e.target.closest('[data-gym-reset]');
        if (resetBtn) {
          gymHost.querySelectorAll('.chip[data-gym-value]').forEach((el) => el.classList.remove('active'));
          const allChip = gymHost.querySelector('.chip[data-gym-value=""]');
          if (allChip) allChip.classList.add('active');
          gymSel.value = '';
          renderBrowseGymChips();
          applyBrowseClassFilters();
          return;
        }
        if (!btn) return;
        const clickedValue = String(btn.dataset.gymValue || '');
        const selected = new Set(
          Array.from(gymHost.querySelectorAll('.chip.active[data-gym-value]'))
            .map((el) => String(el.getAttribute('data-gym-value') || ''))
            .filter(Boolean)
        );
        if (!clickedValue) {
          selected.clear();
        } else if (selected.has(clickedValue)) {
          selected.delete(clickedValue);
        } else {
          selected.add(clickedValue);
        }
        gymHost.querySelectorAll('.chip[data-gym-value]').forEach((el) => {
          const value = String(el.getAttribute('data-gym-value') || '');
          if (!value) {
            el.classList.toggle('active', selected.size === 0);
          } else {
            el.classList.toggle('active', selected.has(value));
          }
        });
        gymSel.value = selected.size === 1 ? Array.from(selected)[0] : '';
        renderBrowseGymChips();
        applyBrowseClassFilters();
      });
    }
    if (whenHost && !whenHost.dataset.bound) {
      whenHost.dataset.bound = '1';
      whenHost.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-preset]');
        if (!btn || !presetSel) return;
        const v = btn.dataset.preset || 'thisWeek';
        presetSel.value = v;
        whenHost.querySelectorAll('.chip').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
        applyBrowseClassFilters();
      });
    }
    if (typeHost && !typeHost.dataset.bound) {
      typeHost.dataset.bound = '1';
      typeHost.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-quick-type]');
        if (!btn || !quickTypeIn) return;
        quickTypeIn.value = btn.dataset.quickType || 'all';
        typeHost.querySelectorAll('.chip').forEach((el) => el.classList.remove('active'));
        btn.classList.add('active');
        applyBrowseClassFilters();
      });
    }
    if (quickTypeIn && !quickTypeIn.value) quickTypeIn.value = 'all';
    const resultsCountEl = document.getElementById('browseResultsCount');
    if (resultsCountEl && !resultsCountEl.textContent.trim()) resultsCountEl.textContent = '';
    bindBrowseRailFades();
  }

  function refreshBrowseRailFades() {
    document.querySelectorAll('#browseClasses .railfade').forEach((wrap) => {
      const rail = wrap.querySelector('.cr');
      if (!rail) return;
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const x = Math.max(0, rail.scrollLeft);
      wrap.classList.toggle('at-start', x <= 1);
      wrap.classList.toggle('at-end', x >= maxScroll - 1);
    });
  }

  function bindBrowseRailFades() {
    const rails = Array.from(document.querySelectorAll('#browseClasses .railfade .cr'));
    rails.forEach((rail) => {
      if (rail.dataset.fadeBound === '1') return;
      rail.dataset.fadeBound = '1';
      rail.addEventListener('scroll', refreshBrowseRailFades, { passive: true });
    });
    if (!window.__browseRailFadeResizeBound) {
      window.__browseRailFadeResizeBound = true;
      window.addEventListener('resize', () => {
        requestAnimationFrame(refreshBrowseRailFades);
      });
    }
    requestAnimationFrame(refreshBrowseRailFades);
  }

  function initBookingsBrowseControls() {
    const presetSel = document.getElementById('browseDateRangePreset');
    const customWrap = document.getElementById('customDateRangeContainer');
    const applyBtn = document.getElementById('applyFiltersBtn');
    const onlyAvailableEl = document.getElementById('browseOnlyAvailableFilter');
    const searchEl = document.getElementById('browseSearchFilter');
    const gymSel = document.getElementById('browseGymFilter');
    const typeSel = document.getElementById('browseTypeFilter');
    const startIn = document.getElementById('browseDateStart');
    const endIn = document.getElementById('browseDateEnd');
    let browseSearchDebounce;
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
    if (onlyAvailableEl && !onlyAvailableEl.dataset.browseBound) {
      onlyAvailableEl.dataset.browseBound = '1';
      onlyAvailableEl.addEventListener('change', () => {
        applyBrowseClassFilters();
      });
    }
    if (searchEl && !searchEl.dataset.browseBound) {
      searchEl.dataset.browseBound = '1';
      searchEl.addEventListener('input', () => {
        clearTimeout(browseSearchDebounce);
        browseSearchDebounce = setTimeout(() => applyBrowseClassFilters(), 220);
      });
    }
    [gymSel, typeSel, startIn, endIn].forEach((el) => {
      if (!el || el.dataset.browseBound) return;
      el.dataset.browseBound = '1';
      el.addEventListener('change', () => {
        if (el === gymSel) renderBrowseGymChips();
      });
    });
    bindBrowseChipInteractions();
    renderBrowseGymChips();
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

  function dashboardSavedClassTypeLabel(rec) {
    const raw = rec?.title != null ? String(rec.title).trim() : '';
    return raw || 'Class';
  }

  function dashboardSavedClassTypeKey(rec) {
    return dashboardSavedClassTypeLabel(rec).toLowerCase();
  }

  function promoteDashboardSavedRowLocation(row, rec) {
    if (!row || !rec) return;
    const where = rec.where != null ? String(rec.where).trim() : '';
    if (!where) return;
    const info = row.querySelector('.booking-item-card__list-info');
    if (!info) return;
    const label = document.createElement('p');
    label.className = 'dashboard-saved-reminder__location-primary';
    label.textContent = where;
    info.insertBefore(label, info.firstChild);
    const locPill = row.querySelector('.booking-item-card__pill--location');
    if (locPill) {
      const pills = locPill.closest('.booking-item-card__pills');
      locPill.remove();
      if (pills && !pills.children.length) pills.remove();
    }
  }

  function customerGeoProfile(customer) {
    const addr = getAddress(customer || {});
    const rawCity = (addr?.city && addr.city !== '-' ? String(addr.city) : String(customer?.city || '')).trim();
    const city = rawCity
      .replace(/\b\d{3,5}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    const postalRaw =
      customer?.postalCode ||
      customer?.zip ||
      customer?.address?.postalCode ||
      '';
    const postal = String(postalRaw || '')
      .replace(/[^\d]/g, '')
      .trim();
    return { city, postal };
  }

  function unitGeoScore(unit, geo, homeBuId) {
    if (!unit || typeof unit !== 'object') return Number.NEGATIVE_INFINITY;
    const unitId = Number(unit?.id);
    const isHome = Number.isFinite(unitId) && Number(unitId) === Number(homeBuId);
    const cityNeedle = String(geo?.city || '').trim();
    const postalNeedle = String(geo?.postal || '').trim();
    const unitName = String(unit?.name || unit?.displayName || '').toLowerCase();
    const unitAddr = unit?.address && typeof unit.address === 'object' ? unit.address : {};
    const unitCity = String(unitAddr?.city || '').toLowerCase().trim();
    const unitPostal = String(unitAddr?.postalCode || unitAddr?.zip || '')
      .replace(/[^\d]/g, '')
      .trim();

    let score = 0;
    if (isHome) score += 1;
    if (postalNeedle && unitPostal) {
      if (unitPostal === postalNeedle) score += 4;
      else if (unitPostal.startsWith(postalNeedle) || postalNeedle.startsWith(unitPostal)) score += 2;
    }
    if (cityNeedle) {
      const cityMatch =
        (unitCity && (unitCity === cityNeedle || unitCity.includes(cityNeedle) || cityNeedle.includes(unitCity))) ||
        (unitName && unitName.includes(cityNeedle));
      if (cityMatch) score += 6;
    }
    return score;
  }

  async function getRecommendedDashboardSeries(customer, options = {}) {
    if (!authAPI?.listBusinessUnitEvents) return [];
    const limitRaw = Number(options?.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : 16;
    const geo = customerGeoProfile(customer);
    const homeBuId = customer?.businessUnit?.id;
    const now = Date.now();
    const periodStart = startOfDay(new Date(now)).toISOString();
    const periodEnd = endOfDay(new Date(now + 60 * 24 * 60 * 60 * 1000)).toISOString();

    let candidateUnits = [];
    if (authAPI.listVer3BusinessUnits) {
      try {
        const units = await authAPI.listVer3BusinessUnits();
        if (Array.isArray(units) && units.length) {
          const scored = units
            .map((u) => ({ unit: u, score: unitGeoScore(u, geo, homeBuId) }))
            .sort((a, b) => b.score - a.score);
          const municipalityish = scored.filter((x) => x.score >= 6).map((x) => x.unit);
          const nearby = scored.filter((x) => x.score >= 2).map((x) => x.unit);
          if (municipalityish.length) {
            candidateUnits = municipalityish;
          } else if (nearby.length) {
            candidateUnits = nearby;
          } else if (homeBuId != null) {
            candidateUnits = units.filter((u) => Number(u?.id) === Number(homeBuId));
          } else {
            candidateUnits = units.slice(0, 8);
          }
        }
      } catch (_) {
        candidateUnits = [];
      }
    }

    if (!candidateUnits.length && homeBuId != null) {
      candidateUnits = [{ id: homeBuId, name: customer?.businessUnit?.name || `Gym ${homeBuId}` }];
    }
    if (!candidateUnits.length) return [];

    const unitIds = candidateUnits
      .map((u) => Number(u?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, 8);
    if (!unitIds.length) return [];

    const chunks = await Promise.all(
      unitIds.map((buId) =>
        authAPI
          .listBusinessUnitEvents(buId, {
            periodStart,
            periodEnd,
          })
          .then((events) =>
            (Array.isArray(events) ? events : []).map((ev) => ({
              ...ev,
              __kind: 'event',
              __buId: buId,
            }))
          )
          .catch(() => [])
      )
    );

    const dedupe = new Set();
    const series = chunks
      .flat()
      .filter((ev) => {
        if (!ev || ev.cancelled === true || !isGroupedEventSeries(ev)) return false;
        const startMs = Date.parse(ev?.duration?.start || '');
        if (!Number.isFinite(startMs) || startMs < now) return false;
        if (isBrowseSourceAlreadyBooked({ ...ev, __kind: 'event' })) return false;
        const key = `${classCardBusinessUnitId(ev) || 'x'}|${String(ev?.name || '').toLowerCase()}|${startMs}`;
        if (dedupe.has(key)) return false;
        dedupe.add(key);
        return true;
      })
      .sort((a, b) => Date.parse(a.duration?.start || '') - Date.parse(b.duration?.start || ''));

    return series.slice(0, limit);
  }

  function renderDashboardClassesRecommendation(hostEl, customer) {
    if (!hostEl) return;
    const hint = document.createElement('p');
    hint.className = 'dashboard-classes-empty-summary dashboard-recommendation-status';
    hint.textContent = 'Finding classes near you…';
    hostEl.appendChild(hint);

    const gymSel = document.getElementById('browseGymFilter');
    getRecommendedDashboardSeries(customer, { limit: 16 })
      .then((recs) => {
        if (!hostEl.isConnected || !hint.isConnected) return;
        hint.remove();
        if (!Array.isArray(recs) || !recs.length) {
          const fallback = document.createElement('p');
          fallback.className = 'dashboard-classes-empty-summary dashboard-recommendation-status';
          fallback.textContent =
            'Nothing to recommend right now. Browse classes to see what’s next.';
          hostEl.appendChild(fallback);
          return;
        }

        const header = document.createElement('div');
        header.className = 'dashboard-recommendation-header';
        const recLabel = document.createElement('p');
        recLabel.className = 'dashboard-classes-empty-summary dashboard-recommendation-kicker';
        recLabel.textContent = 'Recommended for you';
        const recLead = document.createElement('p');
        recLead.className = 'dashboard-recommendation-lead';
        recLead.textContent = 'Multi-session course series picked for your schedule.';
        header.append(recLabel, recLead);
        hostEl.appendChild(header);

        const cardWrap = document.createElement('div');
        cardWrap.className = 'dashboard-recommended-carousel';
        const cardGrid = document.createElement('div');
        cardGrid.className = 'dashboard-recommended-results';
        cardWrap.appendChild(cardGrid);

        const renderSeriesCard = (series) => {
          cardGrid.innerHTML = '';
          const card = document.createElement('div');
          card.className = 'booking-item-card booking-item-card--browse booking-item-card--clickable';
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-haspopup', 'dialog');
          const cardTitle = series?.name || 'Series';
          card.appendChild(createClassCardMediaEl(series, cardTitle));
          const main = document.createElement('div');
          main.className = 'booking-item-card__main';
          const h = document.createElement('strong');
          h.className = 'booking-item-card__title';
          h.textContent = cardTitle;
          const meta = document.createElement('div');
          meta.className = 'booking-item-card__meta';
          meta.textContent = formatEventDateRangeLine(series);
          main.append(h, meta);
          appendClassCardDurationAvailability(
            main,
            typeof series?.duration?.start === 'string' ? series.duration.start : '',
            typeof series?.duration?.end === 'string' ? series.duration.end : null,
            { slots: series?.slots, source: series, booking: series }
          );
          appendSeriesPillToCardMain(main, series);
          appendUrgencyPillsToCardMain(main, series);
          appendLocationPillToCardMain(main, groupActivityBrowseLocationLabel(series, gymSel));
          card.appendChild(main);
          const open = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openEventExpand(series);
          };
          card.addEventListener('click', open);
          card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open(e);
            }
          });
          cardGrid.appendChild(card);
          return card;
        };

        let activeIdx = 0;
        let activeCard = renderSeriesCard(recs[activeIdx]);
        let counterEl = null;
        const updateCounter = () => {
          if (counterEl) counterEl.textContent = `${activeIdx + 1} / ${recs.length}`;
        };
        const setActive = (idx) => {
          const safe = ((idx % recs.length) + recs.length) % recs.length;
          activeIdx = safe;
          activeCard = renderSeriesCard(recs[activeIdx]);
          updateCounter();
        };

        if (recs.length > 1) {
          const nav = document.createElement('div');
          nav.className = 'dashboard-recommendation-carousel-nav';
          const prev = document.createElement('button');
          prev.type = 'button';
          prev.className = 'profile-action-btn-secondary dashboard-recommendation-nav-btn';
          prev.textContent = 'Prev';
          prev.setAttribute('aria-label', 'Previous recommended series');
          prev.addEventListener('click', () => setActive(activeIdx - 1));
          counterEl = document.createElement('span');
          counterEl.className = 'dashboard-recommendation-carousel-counter';
          const next = document.createElement('button');
          next.type = 'button';
          next.className = 'profile-action-btn-secondary dashboard-recommendation-nav-btn';
          next.textContent = 'Next';
          next.setAttribute('aria-label', 'Next recommended series');
          next.addEventListener('click', () => setActive(activeIdx + 1));
          nav.append(prev, counterEl, next);
          updateCounter();
          cardWrap.appendChild(nav);
        }

        const actions = document.createElement('div');
        actions.className = 'dashboard-recommendation-actions';
        const viewClassBtn = document.createElement('button');
        viewClassBtn.type = 'button';
        viewClassBtn.className = 'profile-action-btn-secondary dashboard-recommendation-cta';
        viewClassBtn.textContent = 'View series details';
        viewClassBtn.addEventListener('click', (e) => {
          e.preventDefault();
          activeCard?.click();
        });
        actions.appendChild(viewClassBtn);
        hostEl.append(cardWrap, actions);
      })
      .catch(() => {
        if (!hostEl.isConnected || !hint.isConnected) return;
        hint.remove();
        const fallback = document.createElement('p');
        fallback.className = 'dashboard-classes-empty-summary dashboard-recommendation-status';
        fallback.textContent = 'Unable to load recommendations right now.';
        hostEl.appendChild(fallback);
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

    const buildNoBookingsMain = () => {
      const emptyMain = document.createElement('div');
      emptyMain.className = 'dashboard-classes-empty-main';
      const title = document.createElement('p');
      title.className = 'dashboard-classes-empty-title';
      title.textContent = 'No bookings yet';
      const lead = document.createElement('p');
      lead.className = 'dashboard-classes-empty-lead';
      lead.textContent = 'Your upcoming classes will appear here once you book something.';
      const actions = document.createElement('div');
      actions.className = 'dashboard-classes-empty-actions';
      const cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'profile-action-btn dashboard-book-class-cta';
      cta.id = 'dashboardBookClassCTA';
      cta.textContent = 'See more classes';
      cta.addEventListener('click', (e) => {
        e.preventDefault();
        openClassesBrowseTab();
      });
      actions.appendChild(cta);
      if (hasSaved) {
        const savedLink = document.createElement('button');
        savedLink.type = 'button';
        savedLink.className = 'dashboard-book-saved-link';
        savedLink.textContent = 'or book a saved class';
        savedLink.addEventListener('click', (e) => {
          e.preventDefault();
          openSavedBookingsTab();
        });
        actions.appendChild(savedLink);
      }
      emptyMain.append(title, lead, actions);
      return emptyMain;
    };

    const buildBookedSection = () => {
      const bookedSection = document.createElement('section');
      bookedSection.className = 'dashboard-classes-section dashboard-classes-section--booked';
      bookedSection.setAttribute('aria-labelledby', 'dashboardBookedClassesHeading');
      bookedSection.appendChild(
        createDashboardClassesSectionHeader(
          'dashboardBookedClassesHeading',
          'Upcoming bookings',
          hasBookings ? bookingUnits.length : null
        )
      );
      const body = document.createElement('div');
      body.className = hasBookings
        ? 'dashboard-classes-section__body dashboard-classes-section__body--booked'
        : 'dashboard-classes-section__body dashboard-classes-section__body--booked dashboard-classes-section__body--empty-booked';
      if (hasBookings) {
        const frag = document.createDocumentFragment();
        const unitStartMs = (u) =>
          u.kind === 'series' ? brpBookingStartMs(u.bookings[0]) : brpBookingStartMs(u.booking);
        const units = [...bookingUnits].sort((a, b) => (unitStartMs(a) || 0) - (unitStartMs(b) || 0));
        const maxUnits = 6;
        units.slice(0, maxUnits).forEach((unit) => {
          appendDashboardBookedUnitToFragment(frag, unit);
        });
        body.appendChild(frag);
      } else {
        body.appendChild(buildNoBookingsMain());
      }
      bookedSection.appendChild(body);
      return bookedSection;
    };

    const buildRecommendationSection = () => {
      const recSection = document.createElement('section');
      recSection.className = 'dashboard-classes-section dashboard-classes-section--recommended';
      recSection.setAttribute('aria-labelledby', 'dashboardRecommendedClassesHeading');
      recSection.appendChild(
        createDashboardClassesSectionHeader('dashboardRecommendedClassesHeading', 'Recommendations', null)
      );
      const recBody = document.createElement('div');
      recBody.className =
        'dashboard-classes-section__body dashboard-classes-section__body--recommendations';
      const recSlot = document.createElement('div');
      recSlot.className = 'dashboard-classes-recommendation-slot';
      recBody.appendChild(recSlot);
      recSection.appendChild(recBody);
      renderDashboardClassesRecommendation(recSlot, customer || {});
      return recSection;
    };

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
      const groupedSaved = new Map();
      saved.forEach((rec) => {
        const key = dashboardSavedClassTypeKey(rec);
        const existing = groupedSaved.get(key);
        if (existing) {
          existing.items.push(rec);
          return;
        }
        groupedSaved.set(key, {
          label: dashboardSavedClassTypeLabel(rec),
          items: [rec],
        });
      });
      Array.from(groupedSaved.values()).forEach((group) => {
        const groupWrap = document.createElement('section');
        groupWrap.className = 'dashboard-saved-reminder__group';
        const groupHeader = document.createElement('div');
        groupHeader.className = 'dashboard-saved-reminder__group-header';
        const groupTitle = document.createElement('h4');
        groupTitle.className = 'dashboard-saved-reminder__group-title';
        groupTitle.textContent = group.label;
        const groupCount = document.createElement('span');
        groupCount.className = 'dashboard-saved-reminder__group-count';
        groupCount.textContent = group.items.length === 1 ? '1 class' : `${group.items.length} classes`;
        groupHeader.append(groupTitle, groupCount);
        const groupList = document.createElement('div');
        groupList.className = 'dashboard-saved-reminder__group-list';
        group.items.forEach((rec) => {
          const row = buildSavedClassListCard(rec, {
            onRemove: () => {
              persistSavedClasses(loadSavedClasses().filter((x) => x && x.key !== rec.key));
              refreshDashboardPanels();
              renderSavedBookingsList();
            },
          });
          row.classList.add('dashboard-saved-reminder__item');
          promoteDashboardSavedRowLocation(row, rec);
          attachDashboardSavedReminderRow(row, rec);
          groupList.appendChild(row);
        });
        groupWrap.append(groupHeader, groupList);
        savedList.appendChild(groupWrap);
      });
      reminder.append(meta, ...(hint ? [hint] : []), savedList, actions);
      savedSection.appendChild(reminder);
      wrap.appendChild(savedSection);
      const secondaryGrid = document.createElement('div');
      secondaryGrid.className = 'dashboard-classes-secondary-grid';
      secondaryGrid.append(buildBookedSection(), buildRecommendationSection());
      wrap.appendChild(secondaryGrid);
      return;
    }

    if (hasBookings) {
      wrap.appendChild(buildBookedSection());
      return;
    }

    const empty = document.createElement('div');
    empty.className = 'dashboard-classes-empty';
    const emptyMain = buildNoBookingsMain();
    const recSlot = document.createElement('div');
    recSlot.className = 'dashboard-classes-recommendation-slot';
    empty.append(emptyMain, recSlot);
    renderDashboardClassesRecommendation(recSlot, customer || {});
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
  let gymsDirectoryRows = [];
  const gymsDirectoryState = {
    all: [],
    filtered: [],
    selectedGymId: null,
    baseGyms: [],
  };
  const gymsMapState = {
    map: null,
    markersLayer: null,
    markerByGymId: new Map(),
    isFullscreen: false,
    fullscreenBound: false,
    fullscreenScrollY: 0,
  };

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

  function getGymDistanceKm(gym) {
    if (!gym || typeof gym !== 'object') return null;
    const kmCandidates = [
      gym.distance,
      gym.distanceKm,
      gym.distanceInKm,
      gym?.meta?.distanceKm,
      gym?.location?.distanceKm,
    ];
    for (const v of kmCandidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n;
    }
    const meterCandidates = [
      gym.distanceMeters,
      gym.distanceInMeters,
      gym?.meta?.distanceMeters,
      gym?.location?.distanceMeters,
    ];
    for (const v of meterCandidates) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) return n / 1000;
    }
    return null;
  }

  function formatGymDistanceKm(gym) {
    const n = getGymDistanceKm(gym);
    if (n == null) return null;
    return `${n < 10 ? n.toFixed(1) : n.toFixed(0)} km`;
  }

  function sortGymsForDisplay(gyms) {
    const arr = Array.isArray(gyms) ? gyms.slice() : [];
    arr.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), undefined, { sensitivity: 'base' }));
    return arr;
  }

  function getGymBusynessFromApi(gym) {
    const raw =
      gym?.busyness ??
      gym?.busynessLevel ??
      gym?.busyLevel ??
      gym?.occupancyLevel ??
      gym?.occupancy ??
      gym?.liveBusyness ??
      gym?.status?.busyness ??
      gym?.meta?.busyness;
    if (raw == null) return null;

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      if (raw >= 0.75) return { level: 'high', label: 'Busy' };
      if (raw >= 0.4) return { level: 'medium', label: 'Moderate' };
      return { level: 'low', label: 'Calm' };
    }

    const s = String(raw).trim().toLowerCase();
    if (!s) return null;
    if (s.includes('high') || s.includes('busy') || s.includes('travl')) return { level: 'high', label: 'Busy' };
    if (s.includes('med') || s.includes('moderate') || s.includes('mid')) return { level: 'medium', label: 'Moderate' };
    if (s.includes('low') || s.includes('calm') || s.includes('quiet')) return { level: 'low', label: 'Calm' };
    return null;
  }

  function getGymOpenStatusText(gym) {
    const getter =
      typeof window !== 'undefined' && typeof window.getGymOpeningHours === 'function'
        ? window.getGymOpeningHours
        : null;
    const hoursText = getter ? getter(gym) : '';
    const parsed = parseOpeningHoursRange(String(hoursText || ''));
    if (!parsed) return { open: null, text: 'Hours unavailable' };
    const now = getNowMinutesCopenhagen();
    if (now >= parsed.openMin && now < parsed.closeMin) {
      return { open: true, text: `Open · closes ${formatTimeDK(parsed.closeMin)}` };
    }
    return { open: false, text: `Closed · ${String(hoursText).trim()}` };
  }

  function getGymCoordinates(gym) {
    const latCandidates = [gym?.gymLat, gym?.address?.latitude, gym?.coordinates?.[1], gym?.address?.coordinates?.[1]];
    const lonCandidates = [gym?.gymLon, gym?.address?.longitude, gym?.coordinates?.[0], gym?.address?.coordinates?.[0]];
    const lat = latCandidates.map((v) => Number(v)).find((v) => Number.isFinite(v));
    const lon = lonCandidates.map((v) => Number(v)).find((v) => Number.isFinite(v));
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  function ensureGymsMapMounted() {
    const el = document.getElementById('gymsMapCanvas');
    if (!el) return null;
    if (gymsMapState.map) {
      gymsMapState.map.invalidateSize();
      return gymsMapState.map;
    }
    const map = L.map(el, {
      zoomControl: true,
      attributionControl: false,
    }).setView([56.2, 10.2], 6);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '',
    }).addTo(map);
    gymsMapState.map = map;
    gymsMapState.markersLayer = L.layerGroup().addTo(map);
    return map;
  }

  function focusSelectedGymOnMap(gym) {
    const map = gymsMapState.map;
    if (!map || !gym) return;
    const coords = getGymCoordinates(gym);
    if (!coords) return;
    const ll = L.latLng(coords.lat, coords.lon);
    const targetZoom = Math.max(map.getZoom(), 10);
    map.flyTo(ll, targetZoom, {
      animate: true,
      duration: 0.35,
      easeLinearity: 0.2,
    });
  }

  function styleGymMarker(marker, isSelected) {
    if (!marker || typeof marker.setStyle !== 'function') return;
    const zoom = gymsMapState.map ? gymsMapState.map.getZoom() : 10;
    const baseRadius = zoom <= 7 ? 4.5 : zoom <= 9 ? 5 : 5.5;
    const selectedRadius = zoom <= 7 ? 5.5 : zoom <= 9 ? 6 : 6.5;
    marker.setStyle({
      radius: isSelected ? selectedRadius : baseRadius,
      weight: isSelected ? 2.5 : 2,
      color: isSelected ? '#f401f5' : '#9aa4b2',
      fillColor: isSelected ? '#f401f5' : '#6b7280',
      fillOpacity: isSelected ? 0.9 : 0.75,
    });
    const el = marker.getElement();
    if (el) {
      el.classList.toggle('gym-marker--selected', isSelected);
    }
    if (isSelected && typeof marker.bringToFront === 'function') {
      marker.bringToFront();
    }
  }

  function updateGymsMarkerSelection() {
    gymsMapState.markerByGymId.forEach((marker, id) => {
      styleGymMarker(marker, String(id) === String(gymsDirectoryState.selectedGymId));
    });
  }

  function setGymsMobileMapFullscreen(next) {
    const page = document.getElementById('pageGyms');
    const toggle = document.getElementById('gymsMapFullscreenToggle');
    if (!page || !toggle) return;
    const isMobile = window.matchMedia('(max-width: 700px)').matches;
    const on = Boolean(next) && isMobile;
    gymsMapState.isFullscreen = on;
    page.classList.toggle('gyms-map-fullscreen-mobile', on);
    document.body.classList.toggle('gyms-map-fullscreen-mobile-active', on);
    if (on) {
      gymsMapState.fullscreenScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${gymsMapState.fullscreenScrollY}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.width = '100%';
    } else {
      const y = Number(gymsMapState.fullscreenScrollY || 0);
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
    }
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.setAttribute('aria-label', on ? 'Exit map full screen' : 'Enter map full screen');
    const sheet = document.getElementById('gymsDetailSheet');
    if (sheet && on) {
      sheet.classList.add('is-collapsed');
    }
    if (gymsMapState.map) {
      window.requestAnimationFrame(() => gymsMapState.map?.invalidateSize());
    }
  }

  function selectGym(gym, { source = 'list', focus = true } = {}) {
    if (!gym) return;
    gymsDirectoryState.selectedGymId = gym.id;
    renderGymsListRows();
    updateGymsMarkerSelection();
    renderGymDetailSheet(gym);
    if (focus && source !== 'map') {
      focusSelectedGymOnMap(gym);
    }
  }

  function renderGymsMapMarkers({ fitToBounds = true } = {}) {
    const map = ensureGymsMapMounted();
    if (!map || !gymsMapState.markersLayer) return;
    gymsMapState.markersLayer.clearLayers();
    gymsMapState.markerByGymId.clear();
    const valid = gymsDirectoryState.filtered
      .map((gym) => ({ gym, coords: getGymCoordinates(gym) }))
      .filter((entry) => !!entry.coords);
    valid.forEach(({ gym, coords }) => {
      const isSelected = String(gym.id) === String(gymsDirectoryState.selectedGymId);
      const marker = L.circleMarker([coords.lat, coords.lon], {
        className: 'gym-marker',
      });
      styleGymMarker(marker, isSelected);
      marker.on('click', () => {
        selectGym(gym, { source: 'map', focus: false });
      });
      marker.bindTooltip(String(gym?.name || 'Boulders centre'));
      marker.addTo(gymsMapState.markersLayer);
      gymsMapState.markerByGymId.set(String(gym.id), marker);
    });
    if (!valid.length || !fitToBounds) return;
    const bounds = L.latLngBounds(valid.map(({ coords }) => [coords.lat, coords.lon]));
    if (valid.length === 1) {
      map.setView(bounds.getCenter(), 11, { animate: false });
    } else {
      map.fitBounds(bounds.pad(0.18));
    }
  }

  function ensureGymsDetailSheetDrawerBound(sheet) {
    if (!sheet || sheet.dataset.drawerBound === '1') return;
    sheet.dataset.drawerBound = '1';
    const toggleCollapsedState = (evt) => {
      const isAnchorTarget = evt?.target instanceof HTMLElement && !!evt.target.closest('a');
      if (isAnchorTarget) {
        return;
      }
      sheet.classList.toggle('is-collapsed');
    };
    // Use a single click handler to avoid double-toggling from mixed pointer/touch events.
    sheet.addEventListener('click', toggleCollapsedState);
  }

  function renderGymDetailSheet(gym) {
    const sheet = document.getElementById('gymsDetailSheet');
    if (!sheet || !gym) return;
    const { street, postalCity } = formatGymAddressLines(gym);
    const open = getGymOpenStatusText(gym);
    const mapsQuery = buildMapsSearchQuery(gym);
    sheet.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = String(gym.name || 'Boulders centre');
    const addr = document.createElement('p');
    addr.textContent = [street, postalCity].filter(Boolean).join(', ') || 'Address unavailable';
    const status = document.createElement('p');
    status.textContent = open.text;
    sheet.append(title, addr, status);
    sheet.removeAttribute('data-map-href');
    sheet.removeAttribute('role');
    sheet.removeAttribute('tabindex');
    sheet.removeAttribute('aria-label');
    sheet.onclick = null;
    sheet.onkeydown = null;
    if (mapsQuery) {
      const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open in maps';
      sheet.appendChild(link);
    }
    ensureGymsDetailSheetDrawerBound(sheet);
    if (gymsMapState.isFullscreen) {
      sheet.classList.add('is-collapsed');
    } else {
      sheet.classList.remove('is-collapsed');
    }
    sheet.hidden = false;
  }

  function renderGymsListRows() {
    const listEl = document.getElementById('gymsDirectoryList');
    const countEl = document.getElementById('gymsLiveCount');
    if (!listEl) return;
    listEl.innerHTML = '';
    gymsDirectoryRows = [];
    const rows = gymsDirectoryState.filtered;
    if (countEl) countEl.textContent = `${rows.length}`;

    rows.forEach((gym) => {
      const isPrimary = isUserAuthenticated() && isMemberPrimaryGymDirectoryEntry(gym, getBestCustomerData());
      const isSelected = String(gym.id) === String(gymsDirectoryState.selectedGymId);
      const busy = getGymBusynessFromApi(gym);
      const open = getGymOpenStatusText(gym);

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'gym-row';
      if (isSelected) row.classList.add('is-selected');
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      row.dataset.gymId = String(gym.id || '');

      const dot = document.createElement('span');
      dot.className = 'gym-row-dot';
      if (isPrimary) dot.classList.add('is-primary');
      if (isSelected) dot.classList.add('is-selected');

      const main = document.createElement('div');
      main.className = 'gym-row-main';

      const titleLine = document.createElement('div');
      titleLine.className = 'gym-row-title-line';
      const title = document.createElement('h3');
      title.className = 'gym-row-title';
      title.textContent = displayGymTitle(gym?.name || 'Boulders centre');
      titleLine.appendChild(title);
      if (isPrimary) {
        const pill = document.createElement('span');
        pill.className = 'gym-row-primary-pill';
        pill.textContent = 'Mit center';
        titleLine.appendChild(pill);
      }

      const sub = document.createElement('div');
      sub.className = 'gym-row-subline';
      const distanceText = formatGymDistanceKm(gym);
      const locationText = String(gym?.address?.city || '').trim();
      const meta = document.createElement('span');
      meta.textContent = [distanceText, locationText].filter(Boolean).join(' · ') || 'Location unavailable';
      const busyDot = document.createElement('span');
      busyDot.className = `gym-busy-dot is-${busy?.level || 'medium'}`;
      const busyLabel = document.createElement('span');
      busyLabel.textContent = busy?.label || 'Live status unavailable';
      sub.append(meta);
      if (busy) sub.append(busyDot, busyLabel);
      main.append(titleLine, sub);

      const right = document.createElement('div');
      right.className = 'gym-row-open';
      if (open.open === true) right.classList.add('is-open');
      if (open.open === false) right.classList.add('is-closed');
      right.textContent = open.text;

      row.append(dot, main, right);
      row.addEventListener('click', () => {
        selectGym(gym, { source: 'list', focus: true });
      });
      gymsDirectoryRows.push(row);
      listEl.appendChild(row);
    });
  }

  function applyGymsSearchFilter() {
    const q = String(document.getElementById('gymsSearchInput')?.value || '')
      .trim()
      .toLowerCase();
    if (!q) {
      gymsDirectoryState.filtered = gymsDirectoryState.all.slice();
    } else {
      gymsDirectoryState.filtered = gymsDirectoryState.all.filter((gym) => {
        const name = String(gym?.name || '').toLowerCase();
        const city = String(gym?.address?.city || '').toLowerCase();
        return name.includes(q) || city.includes(q);
      });
    }
    if (gymsDirectoryState.filtered.length && !gymsDirectoryState.filtered.some((g) => String(g.id) === String(gymsDirectoryState.selectedGymId))) {
      gymsDirectoryState.selectedGymId = gymsDirectoryState.filtered[0].id;
    }
    renderGymsListRows();
    renderGymsMapMarkers({ fitToBounds: true });
    const selected = gymsDirectoryState.filtered.find((g) => String(g.id) === String(gymsDirectoryState.selectedGymId));
    const sheet = document.getElementById('gymsDetailSheet');
    if (selected) {
      renderGymDetailSheet(selected);
      updateGymsMarkerSelection();
    } else if (sheet) {
      sheet.hidden = true;
      sheet.innerHTML = '';
    }
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
      let gyms = Array.isArray(response) ? response : (response?.data || response?.items || []);
      if (token !== gymsDirectoryLoadToken) return;
      gyms = await enrichGymsWithCoordinates(gyms);
      if (token !== gymsDirectoryLoadToken) return;

      if (skeletonEl) skeletonEl.hidden = true;
      if (sectionEl) sectionEl.removeAttribute('aria-busy');
      gymsDirectoryState.baseGyms = gyms.filter((g) => g && (g.name || g.address));
      gymsDirectoryState.all = sortGymsForDisplay(gymsDirectoryState.baseGyms);
      gymsDirectoryState.filtered = gymsDirectoryState.all.slice();
      gymsDirectoryState.selectedGymId = gymsDirectoryState.filtered[0]?.id ?? null;

      applyGymsSearchFilter();

      ensureGymsMapMounted();
      renderGymsMapMarkers();

      const searchEl = document.getElementById('gymsSearchInput');
      if (searchEl && searchEl.dataset.bound !== '1') {
        searchEl.dataset.bound = '1';
        searchEl.addEventListener('input', applyGymsSearchFilter);
      }
      const fullscreenBtn = document.getElementById('gymsMapFullscreenToggle');
      if (fullscreenBtn && fullscreenBtn.dataset.bound !== '1') {
        fullscreenBtn.dataset.bound = '1';
        fullscreenBtn.addEventListener('click', () => {
          setGymsMobileMapFullscreen(!gymsMapState.isFullscreen);
        });
      }
      if (!gymsMapState.fullscreenBound) {
        gymsMapState.fullscreenBound = true;
        window.addEventListener('resize', () => {
          if (!window.matchMedia('(max-width: 700px)').matches && gymsMapState.isFullscreen) {
            setGymsMobileMapFullscreen(false);
          }
        });
      }

      const page = document.getElementById('pageGyms');
      const container = document.querySelector('#pageGyms .gyms-page-container');
      if (page && container) {
        const top = page.getBoundingClientRect().top;
        const h = Math.max(320, window.innerHeight - Math.max(0, top) - 12);
        container.style.setProperty('--gyms-page-height', `${h}px`);
        if (gymsMapState.map) {
          window.requestAnimationFrame(() => gymsMapState.map?.invalidateSize());
        }
      }

      if (!gymsDirectoryState.filtered.length) {
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
    if (safeRoute !== 'gyms' && gymsMapState.isFullscreen) {
      setGymsMobileMapFullscreen(false);
    }

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

    document.querySelectorAll('.nav-link[data-route], .mobile-bottom-nav__btn[data-route]').forEach((el) => {
      const isActive = el.getAttribute('data-route') === safeRoute;
      el.classList.toggle('active', isActive);
      if (el.classList.contains('mobile-bottom-nav__btn')) {
        if (isActive) el.setAttribute('aria-current', 'page');
        else el.removeAttribute('aria-current');
      }
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
    if (safeRoute === 'activity') {
      refreshActivityPage();
    }
    if (safeRoute === 'settings') {
      refreshSettingsPaymentMethods();
      refreshSettingsInvoices();
      syncNotificationPrivacyFromCustomer(getBestCustomerData());
    }
    if (safeRoute === 'gyms') {
      refreshGymsDirectoryPage();
    }
    if (safeRoute === 'profile' || safeRoute === 'account') {
      syncProfileAccountTabFromRoute(safeRoute);
    }
  }

  /**
   * Profil vs Konto sub-tabs (same #pageProfile). Hash: #profile | #account.
   */
  function syncProfileAccountTabFromRoute(route) {
    const tabProfil = document.getElementById('tabProfil');
    const tabKonto = document.getElementById('tabKonto');
    const panelProfil = document.getElementById('profileTabProfil');
    const panelKonto = document.getElementById('profileTabKonto');
    if (!tabProfil || !tabKonto || !panelProfil || !panelKonto) return;

    const wantKonto = route === 'account';
    tabProfil.classList.toggle('active', !wantKonto);
    tabKonto.classList.toggle('active', wantKonto);
    tabProfil.setAttribute('aria-selected', wantKonto ? 'false' : 'true');
    tabKonto.setAttribute('aria-selected', wantKonto ? 'true' : 'false');
    panelProfil.toggleAttribute('hidden', wantKonto);
    panelKonto.toggleAttribute('hidden', !wantKonto);

    if (wantKonto) {
      document.querySelectorAll('#pageProfile .profile-profil-edit-row.profile-inline-editor.on').forEach((ed) => {
        const field = ed.getAttribute('data-profile-inline-editor');
        if (field) closeProfileInlineEditor(field);
      });
    }
  }

  function bindProfileAccountTabs() {
    const root = document.getElementById('pageProfile');
    if (!root || root.dataset.profileAccountTabsBound === '1') return;
    root.dataset.profileAccountTabsBound = '1';
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-profile-tab-btn]');
      if (!btn || !root.contains(btn)) return;
      const tab = btn.getAttribute('data-profile-tab-btn');
      if (tab === 'konto') {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        window.location.hash = 'account';
        return;
      }
      if (tab === 'profil') {
        e.preventDefault();
        if (!isUserAuthenticated()) return;
        window.location.hash = 'profile';
      }
    });
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
    const tryParseDigits = (value) => {
      if (value == null || value === '') return null;
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
      const s = String(value).trim();
      if (/^\d+$/.test(s)) {
        const n = parseInt(s, 10);
        return Number.isFinite(n) && n > 0 ? n : null;
      }
      return null;
    };

    const fromProfileId = tryParseDigits(customer?.id);
    if (fromProfileId != null) return fromProfileId;

    const fromCustomerNumber = tryParseDigits(customer?.customerNumber);
    if (fromCustomerNumber != null) return fromCustomerNumber;

    return tryParseDigits(state?.customerId);
  }

  function parseDanishDateTimeString(value) {
    const m = String(value || '')
      .trim()
      .match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (!m) return '';
    const [, d, mo, y, h, mi] = m;
    const hh = h != null ? Number(h) : 0;
    const mm = mi != null ? Number(mi) : 0;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), hh, mm);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : '';
  }

  async function fetchCustomerActivityCheckIns() {
    if (!authAPI || typeof authAPI.listCustomerAccessActivity !== 'function') return [];

    const customer = getBestCustomerData();
    const tryIds = new Set();
    const primary = getBrpNumericCustomerId(customer);
    if (primary != null) tryIds.add(primary);
    if (customer?.customerNumber != null) {
      const s = String(customer.customerNumber).trim();
      if (/^\d+$/.test(s)) tryIds.add(parseInt(s, 10));
    }

    if (!tryIds.size) return [];

    let last = [];
    for (const id of tryIds) {
      last = await authAPI.listCustomerAccessActivity(id);
      if (Array.isArray(last) && last.length) return last;
    }
    return Array.isArray(last) ? last : [];
  }

  function resolveCheckInIso(item) {
    if (!item || typeof item !== 'object') return '';
    const fromDanish =
      (typeof item.tid === 'string' && parseDanishDateTimeString(item.tid)) ||
      (typeof item.timeText === 'string' && parseDanishDateTimeString(item.timeText)) ||
      '';
    if (fromDanish) return fromDanish;

    const tp = item.time;
    if (tp && typeof tp === 'object') {
      const ds = tp.date || tp.day || tp.startDate;
      const ts = tp.time || tp.clock || tp.startTime;
      if (typeof ds === 'string' && typeof ts === 'string') {
        const combined = `${ds} ${ts}`.trim();
        const ms = Date.parse(combined);
        if (Number.isFinite(ms)) return new Date(ms).toISOString();
      }
      if (typeof tp.start === 'string') {
        const ms = Date.parse(tp.start);
        if (Number.isFinite(ms)) return new Date(ms).toISOString();
      }
    }

    const candidates = [
      item.checkedIn,
      item.checkInTime,
      item.checkinTime,
      item.timestamp,
      item.created,
      item.createdAt,
      item.dateTime,
      item.startTime,
      item?.duration?.start,
    ];
    for (const raw of candidates) {
      if (typeof raw !== 'string' || !raw.trim()) continue;
      const danish = parseDanishDateTimeString(raw);
      if (danish) return danish;
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) return new Date(ms).toISOString();
    }
    return '';
  }

  function resolveCheckInGym(item) {
    if (!item || typeof item !== 'object') return 'Gym';
    const reader =
      (typeof item.reader === 'string' && item.reader.trim()) ||
      (typeof item.readerName === 'string' && item.readerName.trim()) ||
      (item.reader && typeof item.reader === 'object'
        ? String(item.reader.name || item.reader.displayName || item.reader.title || '').trim()
        : '') ||
      (typeof item.laeser === 'string' && item.laeser.trim()) ||
      (typeof item.læser === 'string' && item.læser.trim()) ||
      (typeof item.accessPoint === 'string' && item.accessPoint.trim()) ||
      (item.accessPoint && typeof item.accessPoint === 'object'
        ? String(item.accessPoint.name || item.accessPoint.displayName || '').trim()
        : '');
    if (reader) return reader;
    const label =
      item?.businessUnit?.name ||
      item?.businessUnit?.displayName ||
      item?.gymName ||
      item?.locationName ||
      (typeof item.location === 'string' ? item.location : '') ||
      item?.center ||
      item?.facility;
    return String(label || '').trim() || 'Gym';
  }

  function normalizeCheckInHistory(entries) {
    const normalized = (Array.isArray(entries) ? entries : [])
      .map((entry) => {
        const iso = resolveCheckInIso(entry);
        if (!iso) return null;
        return { iso, gym: resolveCheckInGym(entry) };
      })
      .filter(Boolean);
    normalized.sort((a, b) => Date.parse(b.iso) - Date.parse(a.iso));
    return normalized;
  }

  function renderActivitySummary(history) {
    const gymCounts = new Map();
    const hourCounts = new Map();
    history.forEach((entry) => {
      gymCounts.set(entry.gym, (gymCounts.get(entry.gym) || 0) + 1);
      const h = new Date(entry.iso).getHours();
      if (Number.isFinite(h)) hourCounts.set(h, (hourCounts.get(h) || 0) + 1);
    });
    const mostVisitedGym = [...gymCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const topHour = [...hourCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    setText('activityTotalCheckins', history.length ? String(history.length) : '0');
    setText('activityMostVisitedGym', mostVisitedGym);
    setText('activityTopCheckinTime', Number.isFinite(topHour) ? `${String(topHour).padStart(2, '0')}:00` : '-');
  }

  function renderActivityHistory(history) {
    const host = document.getElementById('activityHistoryList');
    if (!host) return;
    host.textContent = '';
    if (!history.length) {
      const empty = document.createElement('p');
      empty.className = 'bookings-empty-msg';
      empty.textContent = 'No check-ins found yet.';
      host.appendChild(empty);
      return;
    }
    history.slice(0, 30).forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'activity-history-item';
      const label = document.createElement('span');
      label.className = 'profile-detail-label';
      label.textContent = entry.gym;
      const value = document.createElement('span');
      value.className = 'profile-detail-value';
      const d = new Date(entry.iso);
      value.textContent = Number.isFinite(d.getTime())
        ? d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
        : '—';
      row.append(label, value);
      host.appendChild(row);
    });
  }

  function renderActivityLast30Chart(history) {
    const host = document.getElementById('activityChart');
    if (!host) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const bars = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() - (29 - index));
      return {
        key: day.toISOString().slice(0, 10),
        label: day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        count: 0,
      };
    });
    const byDay = new Map(bars.map((b) => [b.key, b]));
    history.forEach((entry) => {
      const key = String(entry.iso).slice(0, 10);
      const bar = byDay.get(key);
      if (bar) bar.count += 1;
    });
    const maxCount = Math.max(1, ...bars.map((b) => b.count));
    host.setAttribute('aria-busy', 'false');
    host.setAttribute('aria-label', 'Activity for the last 30 days');
    host.textContent = '';
    const outer = document.createElement('div');
    outer.style.display = 'flex';
    outer.style.gap = '6px';
    outer.style.alignItems = 'flex-end';
    outer.style.minHeight = '120px';
    bars.forEach((bar, index) => {
      const pct = Math.max(6, Math.round((bar.count / maxCount) * 100));
      const showTick = index % 5 === 0 || index === bars.length - 1;
      const col = document.createElement('div');
      col.style.flex = '1';
      col.style.display = 'flex';
      col.style.flexDirection = 'column';
      col.style.alignItems = 'center';
      col.style.gap = '6px';
      const barEl = document.createElement('span');
      barEl.style.width = '100%';
      barEl.style.maxWidth = '12px';
      barEl.style.height = `${pct}%`;
      barEl.style.background = 'rgba(244,1,245,0.85)';
      barEl.style.borderRadius = '6px';
      barEl.setAttribute('title', `${bar.label}: ${bar.count} check-ins`);
      const tick = document.createElement('span');
      tick.style.fontSize = '10px';
      tick.style.opacity = showTick ? '0.8' : '0';
      tick.style.whiteSpace = 'nowrap';
      tick.textContent = showTick ? bar.label : '\u00a0';
      col.append(barEl, tick);
      outer.appendChild(col);
    });
    host.appendChild(outer);
  }

  let activityLoadToken = 0;
  async function refreshActivityPage() {
    const chart = document.getElementById('activityChart');
    const historyHost = document.getElementById('activityHistoryList');
    if (!chart || !historyHost) return;
    if (!isUserAuthenticated()) {
      chart.setAttribute('aria-busy', 'false');
      setProfileHtml(chart, '<p class="bookings-empty-msg">Sign in to view activity.</p>');
      setProfileHtml(historyHost, '<p class="bookings-empty-msg">Sign in to view check-ins.</p>');
      renderActivitySummary([]);
      return;
    }
    if (!getBestCustomerData()) {
      chart.setAttribute('aria-busy', 'true');
      return;
    }
    const token = ++activityLoadToken;
    try {
      const rawEntries = await fetchCustomerActivityCheckIns();
      if (token !== activityLoadToken) return;
      const history = normalizeCheckInHistory(rawEntries);
      renderActivitySummary(history);
      renderActivityLast30Chart(history);
      renderActivityHistory(history);
    } catch (err) {
      if (token !== activityLoadToken) return;
      chart.setAttribute('aria-busy', 'false');
      chart.textContent = '';
      const activityErr = document.createElement('p');
      activityErr.className = 'bookings-empty-msg';
      activityErr.textContent = getErrorMessage(err, 'Activity');
      chart.appendChild(activityErr);
      setProfileHtml(
        historyHost,
        '<p class="bookings-empty-msg">Unable to load check-ins right now.</p>'
      );
      renderActivitySummary([]);
    }
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

    setProfileHtml(host, SETTINGS_PAYMENT_METHODS_SKELETON.trim());
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
  const SETTINGS_INVOICE_PREVIEW_LIMIT = 2;
  let settingsInvoicesCache = [];

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

  function invoiceDateDisplay(value) {
    if (!value) return '—';
    try {
      return formatDisplayDate(value);
    } catch {
      return '—';
    }
  }

  function invoiceTypeDisplay(inv) {
    const order = inv?.order;
    const orderLabel =
      order?.type ||
      order?.name ||
      order?.displayName ||
      (typeof order === 'string' ? order : '');
    if (orderLabel) return String(orderLabel);
    if (inv?.reminderFeeAmount?.amount != null && Number(inv.reminderFeeAmount.amount) > 0) {
      return 'Reminder';
    }
    return 'Standard';
  }

  function invoiceStatusPillLabel(state) {
    const map = {
      STATE_DONE: 'BETALT',
      STATE_SENT: 'SENDT',
      STATE_NOT_SENT: 'IKKE SENDT',
      STATE_SENT_PENDING_RESPONSE: 'AFVENTER',
      STATE_REMINDER: 'RYKKER',
      STATE_REMINDER_SERVICE: 'RYKKER',
      STATE_DEBT_COLLECTION: 'INKASSO',
      STATE_EXPORTED: 'EKSPORTERET',
      STATE_PENDING_SEND: 'AFVENTER SEND',
      STATE_UNKNOWN: 'UKENDT',
    };
    return map[state] || humanizeInvoiceState(state || '').toUpperCase();
  }

  function invoiceYear(inv) {
    const raw = String(inv?.created || '');
    const m = raw.match(/^(\d{4})-/);
    if (m) return m[1];
    const ts = Date.parse(raw);
    if (Number.isFinite(ts)) return String(new Date(ts).getFullYear());
    return 'Unknown';
  }

  function sumInvoiceAmounts(invoices) {
    let amountCents = 0;
    let currency = '';
    invoices.forEach((inv) => {
      const cur = inv?.totalAmount;
      const cents = Number(cur?.amount);
      if (!Number.isFinite(cents)) return;
      amountCents += cents;
      if (!currency && typeof cur?.currency === 'string' && cur.currency.trim()) {
        currency = cur.currency.trim();
      }
    });
    return { amount: amountCents, currency };
  }

  async function downloadInvoicePdf(inv) {
    const cid = getBrpNumericCustomerId(getBestCustomerData());
    const token = typeof window.getAccessToken === 'function' ? window.getAccessToken() : null;
    const invoiceId = Number(inv?.id);
    if (!cid || !token || !Number.isFinite(invoiceId) || invoiceId <= 0) {
      showToast('PDF is not available for this invoice.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/ver3/services/generate/invoicereport', {
        method: 'POST',
        headers: {
          'Accept-Language': 'da-DK',
          Accept: 'application/pdf',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          customer: Number(cid),
          invoice: invoiceId,
        }),
      });
      if (!res.ok) {
        throw new Error(`Invoice PDF request failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formatInvoiceNumberLabel(inv).replace(/\s+/g, '-') || `invoice-${invoiceId}`}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.warn('[Settings] Invoice PDF:', err);
      showToast('Could not generate PDF right now. Try again later.', 'error');
    }
  }

  function buildSettingsInvoiceItem(inv) {
    const item = document.createElement('div');
    item.className = 'settings-item settings-invoice-item';
    item.style.padding = '12px 0';
    item.style.borderBottom = '0.5px solid var(--profile-border)';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '12px';
    row.style.width = '100%';
    row.style.minWidth = '0';
    row.style.position = 'relative';
    row.style.zIndex = '0';

    const invoiceNr = document.createElement('span');
    invoiceNr.className = 'settings-item-label';
    invoiceNr.textContent = String(inv?.number || formatInvoiceNumberLabel(inv)).replace(/^Invoice\s+/i, '');
    invoiceNr.style.flexShrink = '0';
    invoiceNr.style.fontFamily = "'DM Mono', ui-monospace, monospace";
    invoiceNr.style.fontSize = '12px';
    invoiceNr.style.fontWeight = '700';
    invoiceNr.style.color = 'var(--profile-text)';
    invoiceNr.style.minWidth = '72px';

    const statusPill = document.createElement('span');
    statusPill.textContent = invoiceStatusPillLabel(inv?.state || '');
    statusPill.style.flexShrink = '0';
    statusPill.style.display = 'inline-flex';
    statusPill.style.alignItems = 'center';
    statusPill.style.justifyContent = 'center';
    statusPill.style.padding = '4px 10px';
    statusPill.style.borderRadius = '999px';
    statusPill.style.border = '1px solid rgba(255, 0, 255, 0.30)';
    statusPill.style.background = 'rgba(255, 0, 255, 0.09)';
    statusPill.style.color = '#ff00ff';
    statusPill.style.fontFamily = "'DM Sans', sans-serif";
    statusPill.style.fontSize = '8px';
    statusPill.style.fontWeight = '700';
    statusPill.style.letterSpacing = '0.03em';
    statusPill.style.textTransform = 'uppercase';

    const meta = document.createElement('div');
    meta.style.flex = '1';
    meta.style.minWidth = '0';
    meta.style.display = 'flex';
    meta.style.flexDirection = 'column';
    meta.style.gap = '2px';

    const typeLine = document.createElement('span');
    typeLine.textContent = invoiceTypeDisplay(inv);
    typeLine.style.fontFamily = "'DM Sans', sans-serif";
    typeLine.style.fontSize = '11px';
    typeLine.style.fontWeight = '600';
    typeLine.style.color = 'var(--color-text-secondary)';
    typeLine.style.whiteSpace = 'nowrap';
    typeLine.style.overflow = 'hidden';
    typeLine.style.textOverflow = 'ellipsis';

    const dateLine = document.createElement('span');
    dateLine.textContent = `${invoiceDateDisplay(inv.created)} · forfald ${invoiceDateDisplay(inv.dueDate)}`;
    dateLine.style.fontFamily = "'DM Mono', ui-monospace, monospace";
    dateLine.style.fontSize = '10px';
    dateLine.style.color = 'var(--color-text-secondary)';
    dateLine.style.opacity = '0.75';
    dateLine.style.whiteSpace = 'nowrap';
    dateLine.style.overflow = 'hidden';
    dateLine.style.textOverflow = 'ellipsis';

    meta.appendChild(typeLine);
    meta.appendChild(dateLine);

    const amountEl = document.createElement('span');
    amountEl.className = 'settings-item-value';
    amountEl.textContent = formatCurrencyOutDisplay(inv.totalAmount);
    amountEl.style.flexShrink = '0';
    amountEl.style.fontFamily = "'DM Mono', ui-monospace, monospace";
    amountEl.style.fontSize = '13px';
    amountEl.style.fontWeight = '700';
    amountEl.style.color = 'var(--profile-text)';
    amountEl.style.textAlign = 'right';
    amountEl.style.minWidth = '86px';

    const pdfBtn = document.createElement('button');
    pdfBtn.type = 'button';
    pdfBtn.textContent = 'PDF';
    pdfBtn.style.flexShrink = '0';
    pdfBtn.style.padding = '7px 12px';
    pdfBtn.style.fontSize = '12px';
    pdfBtn.style.fontFamily = "'DM Sans', sans-serif";
    pdfBtn.style.fontWeight = '600';
    pdfBtn.style.lineHeight = '1';
    pdfBtn.style.minHeight = '28px';
    pdfBtn.style.borderRadius = '999px';
    pdfBtn.style.background = 'transparent';
    pdfBtn.style.border = '1px solid var(--profile-border)';
    pdfBtn.style.color = 'var(--color-text-secondary)';
    pdfBtn.style.cursor = 'pointer';
    const applyPdfResting = () => {
      pdfBtn.style.borderColor = 'var(--profile-border)';
      pdfBtn.style.color = 'var(--color-text-secondary)';
    };
    const applyPdfHover = () => {
      pdfBtn.style.borderColor = 'var(--profile-text)';
      pdfBtn.style.color = 'var(--profile-text)';
    };
    pdfBtn.addEventListener('mouseenter', applyPdfHover);
    pdfBtn.addEventListener('mouseleave', applyPdfResting);
    pdfBtn.addEventListener('focus', applyPdfHover);
    pdfBtn.addEventListener('blur', applyPdfResting);
    const hasInvoiceId = Number.isFinite(Number(inv?.id)) && Number(inv.id) > 0;
    pdfBtn.disabled = !hasInvoiceId;
    if (!hasInvoiceId) {
      pdfBtn.style.opacity = '0.55';
      pdfBtn.style.cursor = 'not-allowed';
    }
    pdfBtn.addEventListener('click', () => downloadInvoicePdf(inv));

    row.appendChild(invoiceNr);
    row.appendChild(statusPill);
    row.appendChild(meta);
    row.appendChild(amountEl);
    row.appendChild(pdfBtn);
    item.appendChild(row);

    const rest = inv.rest;
    const restAmt = rest && rest.amount != null ? Number(rest.amount) : 0;
    if (Number.isFinite(restAmt) && restAmt > 0) {
      const foot = document.createElement('p');
      foot.className = 'settings-item-description';
      foot.style.marginTop = '6px';
      foot.textContent = `Balance due: ${formatCurrencyOutDisplay(rest)}`;
      item.appendChild(foot);
    }

    return item;
  }

  function renderInvoiceList(host, invoices, opts = {}) {
    if (!host) return;
    host.innerHTML = '';
    const showHeader = opts.showHeader !== false;
    const totalCount = Number.isFinite(opts.totalCount) ? opts.totalCount : invoices.length;
    if (showHeader) {
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.marginBottom = '6px';

      const label = document.createElement('span');
      label.textContent = 'Fakturaer';
      label.style.fontFamily = "'DM Sans', sans-serif";
      label.style.fontSize = '11px';
      label.style.textTransform = 'uppercase';
      label.style.letterSpacing = '0.08em';
      label.style.color = 'var(--color-text-secondary)';
      label.style.opacity = '0.7';

      const count = document.createElement('span');
      count.textContent = `${totalCount} total`;
      count.style.fontFamily = "'DM Mono', ui-monospace, monospace";
      count.style.fontSize = '11px';
      count.style.color = 'var(--color-text-secondary)';
      count.style.opacity = '0.7';

      header.appendChild(label);
      header.appendChild(count);
      host.appendChild(header);
    }

    const list = document.createElement('div');
    invoices.forEach((inv, idx) => {
      const item = buildSettingsInvoiceItem(inv);
      if (idx === invoices.length - 1) item.style.borderBottom = 'none';
      list.appendChild(item);
    });
    host.appendChild(list);
  }

  function renderAllInvoicesModalContent(host, invoices) {
    host.innerHTML = '';

    const years = Array.from(new Set(invoices.map((inv) => invoiceYear(inv)).filter(Boolean))).sort((a, b) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(b) - Number(a);
    });
    const allFilterValues = ['All', ...years];
    let activeFilter = 'All';

    const controls = document.createElement('div');
    controls.style.position = 'sticky';
    controls.style.top = '0';
    controls.style.zIndex = '20';
    controls.style.isolation = 'isolate';
    controls.style.background = 'var(--color-bg, #0f1116)';
    controls.style.paddingBottom = '10px';
    controls.style.paddingTop = '2px';
    controls.style.marginBottom = '10px';
    controls.style.borderBottom = '0.5px solid var(--profile-border)';
    controls.style.display = 'flex';
    controls.style.flexWrap = 'wrap';
    controls.style.gap = '8px';

    const listHost = document.createElement('div');
    listHost.style.paddingTop = '8px';

    const footer = document.createElement('div');
    footer.style.marginTop = '12px';
    footer.style.paddingTop = '12px';
    footer.style.borderTop = '0.5px solid var(--profile-border)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'space-between';
    footer.style.alignItems = 'center';

    const footerLabel = document.createElement('span');
    footerLabel.textContent = 'Total beløb';
    footerLabel.style.fontFamily = "'DM Sans', sans-serif";
    footerLabel.style.fontSize = '12px';
    footerLabel.style.color = 'var(--color-text-secondary)';
    footerLabel.style.opacity = '0.75';

    const footerValue = document.createElement('span');
    footerValue.style.fontFamily = "'DM Mono', ui-monospace, monospace";
    footerValue.style.fontSize = '13px';
    footerValue.style.fontWeight = '700';
    footerValue.style.color = 'var(--profile-text)';

    const renderFiltered = () => {
      const filtered =
        activeFilter === 'All' ? invoices : invoices.filter((inv) => invoiceYear(inv) === activeFilter);
      listHost.innerHTML = '';

      const grouped = filtered.reduce((acc, inv) => {
        const y = invoiceYear(inv);
        if (!acc[y]) acc[y] = [];
        acc[y].push(inv);
        return acc;
      }, {});

      const groupYears = Object.keys(grouped).sort((a, b) => {
        if (a === 'Unknown') return 1;
        if (b === 'Unknown') return -1;
        return Number(b) - Number(a);
      });

      groupYears.forEach((year) => {
        const yearLabel = document.createElement('div');
        yearLabel.textContent = year;
        yearLabel.style.fontFamily = "'DM Mono', ui-monospace, monospace";
        yearLabel.style.fontSize = '11px';
        yearLabel.style.fontWeight = '700';
        yearLabel.style.color = 'var(--color-text-secondary)';
        yearLabel.style.opacity = '0.7';
        yearLabel.style.margin = '8px 0 4px';
        listHost.appendChild(yearLabel);

        grouped[year].forEach((inv, idx) => {
          const item = buildSettingsInvoiceItem(inv);
          if (idx === grouped[year].length - 1) item.style.borderBottom = 'none';
          listHost.appendChild(item);
        });
      });

      const total = sumInvoiceAmounts(filtered);
      footerValue.textContent = formatCurrencyOutDisplay(total);
    };

    allFilterValues.forEach((filterValue) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.textContent = filterValue;
      chip.style.borderRadius = '999px';
      chip.style.padding = '6px 14px';
      chip.style.fontFamily = "'DM Sans', sans-serif";
      chip.style.fontSize = '11px';
      chip.style.fontWeight = '700';
      chip.style.cursor = 'pointer';
      chip.style.background = 'transparent';
      chip.style.color = 'var(--color-text-secondary)';
      chip.style.border = '1px solid var(--profile-border)';
      chip.addEventListener('click', () => {
        activeFilter = filterValue;
        Array.from(controls.children).forEach((btn) => {
          btn.style.background = 'transparent';
          btn.style.border = '1px solid var(--profile-border)';
          btn.style.color = 'var(--color-text-secondary)';
        });
        chip.style.background = 'rgba(255, 0, 255, 0.09)';
        chip.style.border = '1px solid rgba(255, 0, 255, 0.30)';
        chip.style.color = '#ff00ff';
        renderFiltered();
      });
      controls.appendChild(chip);
    });

    if (controls.firstChild) controls.firstChild.click();

    footer.appendChild(footerLabel);
    footer.appendChild(footerValue);
    host.appendChild(controls);
    host.appendChild(listHost);
    host.appendChild(footer);
  }

  function openAllInvoicesModal() {
    const modal = document.getElementById('allInvoicesModal');
    const container = document.getElementById('allInvoicesContainer');
    if (!modal || !container) return;
    if (!Array.isArray(settingsInvoicesCache) || !settingsInvoicesCache.length) {
      setProfileHtml(
        container,
        '<p class="settings-item-description">No invoices are available yet.</p>'
      );
    } else {
      renderAllInvoicesModalContent(container, settingsInvoicesCache);
    }
    modal.style.display = 'flex';
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

    setProfileHtml(host, SETTINGS_INVOICES_SKELETON.trim());

    authAPI
      .listCustomerInvoices(cid, {
        // Request full history instead of the default 2-year window.
        periodStart: '1970-01-01T00:00:00.000Z',
        periodEnd: new Date().toISOString(),
      })
      .then((invoices) => {
        host.innerHTML = '';
        const list = Array.isArray(invoices) ? [...invoices] : [];
        list.sort((a, b) => invoiceCreatedMs(b) - invoiceCreatedMs(a));
        settingsInvoicesCache = list;

        if (!list.length) {
          const p = document.createElement('p');
          p.className = 'settings-item-description';
          p.textContent =
            'No invoices are available for this profile yet. This is normal if you have not been billed through this membership.';
          host.appendChild(p);
          return;
        }

        renderInvoiceList(host, list.slice(0, SETTINGS_INVOICE_PREVIEW_LIMIT), {
          showHeader: true,
          totalCount: list.length,
        });
        if (list.length > SETTINGS_INVOICE_PREVIEW_LIMIT) {
          const actions = document.createElement('div');
          actions.style.marginTop = '1rem';
          const link = document.createElement('button');
          link.type = 'button';
          link.textContent = `Se alle fakturaer (${list.length}) \u2192`;
          link.style.border = 'none';
          link.style.background = 'transparent';
          link.style.padding = '0';
          link.style.margin = '0';
          link.style.cursor = 'pointer';
          link.style.fontFamily = "'DM Sans', sans-serif";
          link.style.fontSize = '12px';
          link.style.fontWeight = '700';
          link.style.color = '#ff00ff';
          link.style.textDecoration = 'none';
          link.addEventListener('click', openAllInvoicesModal);
          actions.appendChild(link);
          host.appendChild(actions);
        }
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

    setValue('inlineProfileFirstName', customer.firstName || '');
    setValue('inlineProfileLastName', customer.lastName || '');
    setValue('inlineProfileDateOfBirth', customer.dateOfBirth || customer.birthDate || '');
    setValue('inlineProfileGender', customer.gender || '');
    setValue('inlineProfileStudentId', customer.studentId || '');
    setValue(
      'inlineProfilePrimaryGym',
      customer.primaryGym || customer.gymName || getMembershipData(customer).gym || ''
    );

    const address = customer.address || {};
    const street =
      typeof address === 'string' ? address : address.street || customer.streetAddress || '';
    const postal = address.postalCode || customer.postalCode || customer.zip || '';
    const city = address.city || customer.city || '';
    const countryRaw = typeof address === 'object' && address ? address.country : customer.country;
    setValue('inlineProfileStreetAddress', street);
    setValue('inlineProfilePostalCode', postal);
    setValue('inlineProfileCity', city);
    setValue('inlineProfileCountry', countryRaw != null ? String(countryRaw) : '');
  }

  function mergeCustomerAddressPayload(customer, patch) {
    const c = customer || {};
    let addr = {};
    if (c.address && typeof c.address === 'object') {
      addr = { ...c.address };
    }
    const street = patch.street ?? addr.street ?? c.streetAddress ?? '';
    const postalCode = patch.postalCode ?? addr.postalCode ?? c.postalCode ?? c.zip ?? '';
    const city = patch.city ?? addr.city ?? c.city ?? '';
    const country = patch.country ?? addr.country ?? c.country;
    const out = { street, postalCode, city };
    if (country != null && String(country).trim() !== '') {
      out.country = country;
    }
    return { address: out };
  }

  function closeProfileInlineEditor(field) {
    const ed = document.querySelector(`#pageProfile [data-profile-inline-editor="${field}"]`);
    if (ed) {
      ed.classList.remove('on');
      ed.closest('.profile-profil-row')?.classList.remove('profile-profil-row--editing');
    }
  }

  function openProfileInlineEditor(field) {
    document.querySelectorAll('#pageProfile .profile-profil-edit-row.profile-inline-editor').forEach((el) => {
      const k = el.getAttribute('data-profile-inline-editor');
      if (k && k !== field) {
        el.classList.remove('on');
        el.closest('.profile-profil-row')?.classList.remove('profile-profil-row--editing');
      }
    });
    const ed = document.querySelector(`#pageProfile [data-profile-inline-editor="${field}"]`);
    if (ed) {
      ed.classList.add('on');
      ed.closest('.profile-profil-row')?.classList.add('profile-profil-row--editing');
      const control = ed.querySelector('input, select, textarea');
      if (control) setTimeout(() => control.focus(), 0);
    }
  }

  async function saveProfileInlineField(field) {
    const customer = getBestCustomerData();
    if (!isUserAuthenticated() || !state.customerId || !authAPI?.updateCustomer) {
      showToast('Du skal være logget ind.', 'error');
      return;
    }
    const inputMap = {
      firstName: 'inlineProfileFirstName',
      lastName: 'inlineProfileLastName',
      dateOfBirth: 'inlineProfileDateOfBirth',
      gender: 'inlineProfileGender',
      studentId: 'inlineProfileStudentId',
      streetAddress: 'inlineProfileStreetAddress',
      postalCode: 'inlineProfilePostalCode',
      city: 'inlineProfileCity',
      country: 'inlineProfileCountry',
      primaryGym: 'inlineProfilePrimaryGym',
    };
    const id = inputMap[field];
    const input = id ? document.getElementById(id) : null;
    const value = input?.value?.trim() ?? '';

    const bail = (msg) => {
      showToast(msg, 'error');
      return true;
    };

    /** @type {Record<string, unknown>} */
    let payload = {};
    if (field === 'firstName') {
      if (!value && bail('Angiv fornavn.')) return;
      payload = { firstName: value };
    } else if (field === 'lastName') {
      if (!value && bail('Angiv efternavn.')) return;
      payload = { lastName: value };
    } else if (field === 'dateOfBirth') {
      if (!value && bail('Angiv fødselsdato.')) return;
      payload = { dateOfBirth: value };
    } else if (field === 'gender') {
      payload = { gender: value };
    } else if (field === 'studentId') {
      payload = { studentId: value };
    } else if (field === 'primaryGym') {
      if (!value && bail('Angiv center.')) return;
      payload = { primaryGym: value };
    } else if (field === 'streetAddress' || field === 'postalCode' || field === 'city' || field === 'country') {
      const patch = {};
      if (field === 'streetAddress') patch.street = value;
      if (field === 'postalCode') patch.postalCode = value;
      if (field === 'city') patch.city = value;
      if (field === 'country') patch.country = value;
      if (field === 'streetAddress' && !value && bail('Angiv vej og husnr.')) return;
      if (field === 'postalCode' && !value && bail('Angiv postnr.')) return;
      payload = mergeCustomerAddressPayload(customer, patch);
    } else {
      return;
    }

    try {
      await authAPI.updateCustomer(state.customerId, payload);
      const updated = await authAPI.getCustomer(state.customerId);
      state.authenticatedCustomer = updated;
      closeProfileInlineEditor(field);
      refreshLoginPageUI();
      showToast('Gemt.', 'success');
    } catch (err) {
      showToast(getErrorMessage(err, 'Profil'), 'error');
    }
  }

  /**
   * Delegated clicks on #pageProfile so Profil pencils always work (single bind, survives tab visibility).
   */
  function bindProfileInlineEditors() {
    const root = document.getElementById('pageProfile');
    if (!root || root.dataset.profileInlineDelegation === '1') return;
    root.dataset.profileInlineDelegation = '1';

    root.addEventListener('click', async (e) => {
      const trigger = e.target.closest('.profile-profil-card button.fedit[data-field]');
      if (trigger && root.contains(trigger)) {
        e.preventDefault();
        const field = trigger.getAttribute('data-field');
        if (!field) return;
        populateProfileEditForm();
        openProfileInlineEditor(field);
        return;
      }

      const cancel = e.target.closest('[data-profile-inline-cancel]');
      if (cancel && root.contains(cancel)) {
        e.preventDefault();
        const field = cancel.getAttribute('data-profile-inline-cancel');
        if (!field) return;
        closeProfileInlineEditor(field);
        populateProfileEditForm();
        refreshLoginPageUI();
        return;
      }

      const save = e.target.closest('[data-profile-inline-save]');
      if (save && root.contains(save)) {
        e.preventDefault();
        const field = save.getAttribute('data-profile-inline-save');
        if (!field) return;
        save.disabled = true;
        try {
          await saveProfileInlineField(field);
        } finally {
          save.disabled = false;
        }
      }
    });
  }

  function isProfilePlaceholderValue(value) {
    const text = value == null ? '' : String(value).trim();
    return text === '' || text === '-' || text.toUpperCase() === 'N/A';
  }

  function normalizeProfileDisplayValue(value) {
    return isProfilePlaceholderValue(value) ? 'N/A' : String(value);
  }

  function applyProfilePlaceholderClass(el, value) {
    if (!el || !el.classList) return;
    el.classList.toggle('profile-placeholder-value', isProfilePlaceholderValue(value));
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const normalized = normalizeProfileDisplayValue(value);
    el.textContent = normalized;
    applyProfilePlaceholderClass(el, normalized);
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

  function hasStudentMembership(customer, membership) {
    const values = [
      membership?.type,
      customer?.membershipType,
      customer?.membershipName,
      customer?.membership,
      customer?.plan,
      customer?.subscriptionName,
    ]
      .filter((v) => v !== null && v !== undefined)
      .map((v) => String(v).trim())
      .filter(Boolean);

    return values.some((v) => /student|studie/i.test(v));
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
    setText('profileGender', customer?.gender || 'N/A');
    setText('profileStudentId', customer?.studentId || '-');
    const studentIdRow = document.querySelector('#pageProfile [data-profile-inline="studentId"]');
    if (studentIdRow) {
      studentIdRow.style.display = hasStudentMembership(customer || {}, membership) ? '' : 'none';
    }
    const addrObj = customer?.address && typeof customer.address === 'object' ? customer.address : null;
    let postalDisp =
      addrObj?.postalCode != null && String(addrObj.postalCode).trim() !== ''
        ? String(addrObj.postalCode).trim()
        : customer?.postalCode || customer?.zip || '';
    let cityOnly =
      addrObj?.city != null && String(addrObj.city).trim() !== '' ? String(addrObj.city).trim() : '';
    if (!postalDisp && address.city && address.city !== '-') {
      const m = String(address.city).trim().match(/^(\d{3,6})\s+(.+)$/);
      if (m) {
        postalDisp = m[1];
        if (!cityOnly) cityOnly = m[2];
      }
    }
    setText('profileStreet', address.street);
    setText('profilePostalCode', postalDisp || '-');
    setText('profileCity', formatProfileCityDisplay(cityOnly || address.city));
    setText('profileCountry', address.country);

    setText('settingsEmail', email);
    setText('settingsPhone', phone);

    // Account settings action controls should stay icon-only in compact layouts.
    const forceIconOnlySettingsAction = (id, ariaLabel) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.setAttribute('aria-label', ariaLabel);
      Array.from(btn.childNodes).forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent && node.textContent.trim()) {
            node.textContent = '';
          }
          return;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = /** @type {HTMLElement} */ (node);
          if (el.tagName.toLowerCase() !== 'svg') {
            el.setAttribute('aria-hidden', 'true');
            el.style.display = 'none';
          }
        }
      });
    };
    forceIconOnlySettingsAction('editEmailBtn', 'Edit email address');
    forceIconOnlySettingsAction('editPhoneBtn', 'Edit phone number');
    forceIconOnlySettingsAction('changePasswordBtn', 'Change password');

    const headerFirstName = firstName && firstName !== '-'
      ? firstName
      : (metadata?.username ? String(metadata.username).split(/[\s@._-]+/)[0] : 'User');
    const navUserName = document.getElementById('navUserName');
    if (navUserName) navUserName.textContent = headerFirstName || 'User';
    const navUser = document.getElementById('navUser');
    if (navUser) {
      navUser.setAttribute('aria-label', `Account menu for ${headerFirstName || 'user'}`);
    }
    let navUserAvatar = document.getElementById('navUserAvatar');
    if (!navUserAvatar && navUser) {
      navUserAvatar = document.createElement('div');
      navUserAvatar.id = 'navUserAvatar';
      navUserAvatar.className = 'user-avatar';
      const userDropdown = document.getElementById('userDropdown');
      if (userDropdown && userDropdown.parentElement === navUser) {
        navUser.insertBefore(navUserAvatar, userDropdown);
      } else {
        navUser.appendChild(navUserAvatar);
      }
    }
    if (navUserAvatar) {
      const firstInitial = firstName && firstName !== '-' ? String(firstName).trim().charAt(0) : '';
      const lastInitial = lastName && lastName !== '-' ? String(lastName).trim().charAt(0) : '';
      const fallbackSeed = headerFirstName && headerFirstName !== '-' ? headerFirstName : 'User';
      const fallbackInitials = String(fallbackSeed).replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
      const initials = `${firstInitial}${lastInitial}`.toUpperCase() || fallbackInitials.toUpperCase() || 'U';
      navUserAvatar.dataset.initials = initials;
      navUserAvatar.textContent = initials;
      navUserAvatar.style.display = 'inline-flex';
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
      if (authenticated && customer) {
        DOM.loginStatusPage.setAttribute('data-auth-ready', 'true');
      }
    }

    if (DOM.loginStatusNamePage) {
      const name = customer?.firstName && customer?.lastName
        ? `${customer.firstName} ${customer.lastName}`
        : (customer?.firstName || customer?.lastName || 'N/A');
      const displayName = normalizeProfileDisplayValue(name);
      DOM.loginStatusNamePage.textContent = displayName;
      applyProfilePlaceholderClass(DOM.loginStatusNamePage, displayName);
    }
    if (DOM.loginStatusEmailPage) {
      const emailValue = normalizeProfileDisplayValue(state?.authenticatedEmail || customer?.email || metadata?.email || 'N/A');
      DOM.loginStatusEmailPage.textContent = emailValue;
      applyProfilePlaceholderClass(DOM.loginStatusEmailPage, emailValue);
    }
    if (DOM.loginStatusDobPage) {
      const dobValueEl = DOM.loginStatusDobPage.querySelector('.profile-detail-value');
      const dobValue = customer?.dateOfBirth || customer?.birthDate || null;
      DOM.loginStatusDobPage.style.display = dobValue ? '' : 'none';
      if (dobValueEl) {
        const dobDisplay = normalizeProfileDisplayValue(dobValue || 'N/A');
        dobValueEl.textContent = dobDisplay;
        applyProfilePlaceholderClass(dobValueEl, dobDisplay);
      }
    }
    if (DOM.loginStatusAddressPage) {
      const addressText = getAddress(customer || {}).full;
      const addressValueEl = DOM.loginStatusAddressPage.querySelector('.profile-detail-value');
      DOM.loginStatusAddressPage.style.display = addressText !== '-' ? '' : 'none';
      if (addressValueEl) {
        const addressDisplay = normalizeProfileDisplayValue(addressText);
        addressValueEl.textContent = addressDisplay;
        applyProfilePlaceholderClass(addressValueEl, addressDisplay);
      }
    }
    if (DOM.loginStatusPhonePage) {
      const phoneValueEl = DOM.loginStatusPhonePage.querySelector('.profile-detail-value');
      const phoneValue = getPhoneDisplay(customer);
      DOM.loginStatusPhonePage.style.display = phoneValue && phoneValue !== '-' ? '' : 'none';
      if (phoneValueEl) {
        const phoneDisplay = normalizeProfileDisplayValue(phoneValue || 'N/A');
        phoneValueEl.textContent = phoneDisplay;
        applyProfilePlaceholderClass(phoneValueEl, phoneDisplay);
      }
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

    document.querySelectorAll('.nav-link[data-route], .mobile-bottom-nav__btn[data-route]').forEach((link) => {
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

    bindProfileInlineEditors();
    bindProfileAccountTabs();

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
    const closeAllInvoicesModal = () => closeModal('allInvoicesModal');

    const freezeSubscriptionSettingsBtn = document.getElementById('freezeSubscriptionSettingsBtn');
    const cancelSubscriptionSettingsBtn = document.getElementById('cancelSubscriptionSettingsBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const allInvoicesBtn = document.getElementById('allInvoicesBtn');
    const closeAllInvoicesModalBtn = document.getElementById('closeAllInvoicesModal');
    const allInvoicesModal = document.getElementById('allInvoicesModal');

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
        updateFreezeSummaryAndButtonState();
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
    bindClickOnce(allInvoicesBtn, openAllInvoicesModal);
    bindClickOnce(closeAllInvoicesModalBtn, closeAllInvoicesModal);
    if (allInvoicesModal && !allInvoicesModal.dataset.boundBackdropClose) {
      allInvoicesModal.dataset.boundBackdropClose = 'true';
      allInvoicesModal.addEventListener('click', (event) => {
        if (event.target === allInvoicesModal) closeAllInvoicesModal();
      });
    }

    const freezeError = document.getElementById('freezeSubscriptionError');
    const freezeErrorStep2 = document.getElementById('freezeSubscriptionErrorStep2');
    const cancelErrorStep2 = document.getElementById('cancelSubscriptionErrorStep2');
    const freezeDatePreview = document.getElementById('freezeDatePreview');
    const freezeStartDateInput = document.getElementById('freezeStartDate');
    const freezeEndDateInput = document.getElementById('freezeEndDate');
    const proceedFreezeBtn = document.getElementById('proceedFreezeBtn');

    const setError = (el, message) => {
      if (!el) return;
      el.textContent = message || '';
      el.style.display = message ? 'block' : 'none';
    };

    const DAY_IN_MS = 24 * 60 * 60 * 1000;
    const parseLocalDate = (value) => {
      if (!value) return null;
      const parts = value.split('-').map((part) => Number(part));
      if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) return null;
      return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0, 0);
    };

    const getFreezeValidationState = () => {
      const startRaw = freezeStartDateInput?.value || '';
      const endRaw = freezeEndDateInput?.value || '';
      if (!startRaw || !endRaw) {
        return { hasBothDates: false, isValid: false, message: '', durationDays: 0 };
      }
      const startDate = parseLocalDate(startRaw);
      const endDate = parseLocalDate(endRaw);
      if (!startDate || !endDate) {
        return { hasBothDates: true, isValid: false, message: 'Ugyldige datoer.', durationDays: 0 };
      }
      if (endDate < startDate) {
        return {
          hasBothDates: true,
          isValid: false,
          message: 'Slutdato skal ligge efter startdato.',
          durationDays: 0
        };
      }
      const maxEndDate = new Date(startDate.getTime());
      maxEndDate.setMonth(maxEndDate.getMonth() + 3);
      if (endDate > maxEndDate) {
        return {
          hasBothDates: true,
          isValid: false,
          message: 'Fryseperioden må maks. være 3 måneder.',
          durationDays: 0
        };
      }
      const durationDays = Math.floor((endDate.getTime() - startDate.getTime()) / DAY_IN_MS) + 1;
      return { hasBothDates: true, isValid: true, message: '', durationDays };
    };

    const updateFreezeSummaryAndButtonState = () => {
      const state = getFreezeValidationState();
      if (!freezeDatePreview || !proceedFreezeBtn) return;

      proceedFreezeBtn.disabled = !state.isValid;
      freezeDatePreview.style.display = state.hasBothDates ? 'block' : 'none';
      freezeDatePreview.classList.toggle('freeze-summary-row--error', state.hasBothDates && !state.isValid);

      if (!state.hasBothDates) {
        freezeDatePreview.textContent = '';
        setError(freezeError, '');
        return;
      }

      if (!state.isValid) {
        freezeDatePreview.textContent = state.message;
        setError(freezeError, state.message);
        return;
      }

      const approximateMonths = (state.durationDays / 30).toFixed(1).replace('.', ',');
      freezeDatePreview.textContent = `Varighed: ${state.durationDays} dage (~${approximateMonths} mdr) · Pris: 49 kr`;
      setError(freezeError, '');
    };

    document.getElementById('closeFreezeSubscriptionModal')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeFreezeSubscriptionModalStep2')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('closeFreezeSubscriptionModalStep3')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('stayMembershipBtn')?.addEventListener('click', closeAllSubscriptionModals);
    document.getElementById('stayMembershipBtnStep2')?.addEventListener('click', closeAllSubscriptionModals);

    document.getElementById('proceedFreezeBtn')?.addEventListener('click', () => {
      const freezeState = getFreezeValidationState();
      if (!freezeState.isValid) {
        setError(freezeError, freezeState.message || 'Vælg en gyldig periode for at fortsætte.');
        updateFreezeSummaryAndButtonState();
        return;
      }
      setError(freezeError, '');
      closeModal('freezeSubscriptionModal');
      openModal('freezeSubscriptionModalStep2');
    });

    if (freezeStartDateInput && freezeEndDateInput) {
      ['input', 'change'].forEach((eventName) => {
        freezeStartDateInput.addEventListener(eventName, updateFreezeSummaryAndButtonState);
        freezeEndDateInput.addEventListener(eventName, updateFreezeSummaryAndButtonState);
      });
      updateFreezeSummaryAndButtonState();
    }

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
      updateFreezeSummaryAndButtonState();
    });
    document.getElementById('proceedCancelBtn')?.addEventListener('click', () => {
      closeAllSubscriptionModals();
      showToast('Cancellation request flow completed.', 'success');
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
