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

  function setRoute(route) {
    const safeRoute = PAGE_ROUTES.includes(route) ? route : 'profile';

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

  function getAddress(customer) {
    const addr = customer?.address;
    if (typeof addr === 'string') {
      return { full: addr, street: addr, city: customer?.city || '-', country: customer?.country || '-' };
    }
    if (addr && typeof addr === 'object') {
      const street = addr.street || customer?.streetAddress || '-';
      const city = [addr.postalCode || customer?.postalCode || customer?.zip, addr.city || customer?.city].filter(Boolean).join(' ') || '-';
      const country = addr.country || customer?.country || '-';
      const full = [street, city].filter(Boolean).join(', ');
      return { full: full || '-', street, city, country };
    }
    const street = customer?.streetAddress || '-';
    const city = [customer?.postalCode || customer?.zip, customer?.city].filter(Boolean).join(' ') || '-';
    const country = customer?.country || '-';
    const full = [street, city].filter(Boolean).join(', ');
    return { full: full || '-', street, city, country };
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

  function getMembershipData(customer) {
    const sub =
      customer?.activeSubscription ||
      customer?.membership ||
      (Array.isArray(customer?.subscriptions) ? customer.subscriptions[0] : null) ||
      (Array.isArray(customer?.memberships) ? customer.memberships[0] : null) ||
      null;

    return {
      type: sub?.name || sub?.type || customer?.membershipType || '-',
      activeSince: sub?.startDate || sub?.activeSince || customer?.memberSince || '-',
      price: sub?.price || sub?.monthlyPrice || '-',
      gym: sub?.gymName || sub?.businessUnitName || customer?.primaryGym || customer?.gymName || '-',
      memberId: sub?.memberId || sub?.id || customer?.membershipNumber || customer?.memberId || customer?.id || '-',
      contractStatus: sub?.contractStatus || customer?.contractStatus || '-',
      boundUntil: sub?.boundUntil || customer?.boundUntil || null,
      cardConsentStatus: sub?.cardConsentStatus || customer?.cardConsentStatus || null
    };
  }

  function hasActiveMembership(customer) {
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
    const email = state?.authenticatedEmail || customer?.email || metadata?.email || '-';
    const phone = getPhoneDisplay(customer);
    const dob = customer?.dateOfBirth || customer?.birthDate || '-';
    const address = getAddress(customer || {});
    const membership = getMembershipData(customer || {});

    setText('dashboardUserName', fullName);
    setText('dashboardName', fullName);
    setText('dashboardEmail', email);
    setText('dashboardPhone', phone);
    setText('dashboardMembershipType', membership.type);
    setText('dashboardMembershipLocation', membership.gym);

    setText('activityMemberSince', formatDisplayDate(membership.activeSince));
    setText('activityLoyaltyTier', customer?.loyaltyTier || '-');

    setText('profileFirstName', firstName);
    setText('profileLastName', lastName);
    setText('profileCustomerNumber', customer?.customerNumber || customer?.id || metadata?.username || '-');
    setText('profilePrimaryGym', customer?.primaryGym || customer?.gymName || membership.gym);
    setText('profileBirthdate', formatDisplayDate(dob));
    setText('profileGender', customer?.gender || '-');
    setText('profileStudentId', customer?.studentId || '-');
    setText('profileMembershipType', membership.type);
    setText('profileActiveSince', formatDisplayDate(membership.activeSince));
    setText('profileMembershipPrice', membership.price);
    setText('profileMembershipGym', membership.gym);
    setText('profileMemberId', membership.memberId);
    setText('profileContractStatus', membership.contractStatus);
    setText('profilePhone', phone);
    setText('profileEmail', email);
    setText('profileStreet', address.street);
    setText('profileCity', address.city);
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

    const boundUntilRow = document.getElementById('profileBoundUntilRow');
    if (boundUntilRow) boundUntilRow.style.display = membership.boundUntil ? '' : 'none';
    if (membership.boundUntil) setText('profileBoundUntil', formatDisplayDate(membership.boundUntil));

    const cardConsentRow = document.getElementById('profileCardConsentRow');
    if (cardConsentRow) cardConsentRow.style.display = membership.cardConsentStatus ? '' : 'none';
    if (membership.cardConsentStatus) setText('profileCardConsentStatus', membership.cardConsentStatus);

    updateSubscriptionActionVisibility(customer);
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
      const addr = customer?.address;
      let addressText = '-';
      if (typeof addr === 'string') {
        addressText = addr;
      } else if (addr && typeof addr === 'object') {
        addressText = [addr.street, addr.postalCode, addr.city].filter(Boolean).join(', ') || '-';
      } else if (customer?.streetAddress || customer?.city || customer?.postalCode) {
        addressText = [customer.streetAddress, customer.postalCode, customer.city].filter(Boolean).join(', ') || '-';
      }
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
      setRoute(PAGE_ROUTES.includes(hashRoute) ? hashRoute : 'profile');
    } else {
      if (window.location.hash) {
        window.location.hash = '';
      }
    }
  }

  function updateNavigation() {
    const hashRoute = window.location.hash.replace('#', '');
    if (isUserAuthenticated() && PAGE_ROUTES.includes(hashRoute)) {
      setRoute(hashRoute);
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
        setRoute(link.getAttribute('data-route') || 'profile');
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

    const manageMembershipBtn = document.getElementById('manageMembershipBtn');
    if (manageMembershipBtn) {
      manageMembershipBtn.addEventListener('click', () => {
        window.location.href = './index.html';
      });
    }

    const registerCardConsentBtn = document.getElementById('registerCardConsentBtn');
    if (registerCardConsentBtn) {
      registerCardConsentBtn.addEventListener('click', () => {
        window.location.href = './index.html';
      });
    }

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
  }

  window.refreshLoginPageUI = refreshLoginPageUI;
  window.populateProfileEditForm = populateProfileEditForm;
  window.navigateToRoute = setRoute;
  window.updateNavigation = updateNavigation;
  window.initNavigation = initNavigation;

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
}
