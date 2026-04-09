// Login page specific initialization and functionality

import { initializeLoginPage } from './profile/initialize-login-page.js';

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
    forgotPasswordModal: document.getElementById('forgotPasswordModal'),
    forgotPasswordForm: document.getElementById('forgotPasswordForm'),
    forgotPasswordEmail: document.getElementById('forgotPasswordEmail'),
    forgotPasswordSuccess: document.getElementById('forgotPasswordSuccess'),
  };

  // Wait for app.js to be loaded and state to be available
  let hasInitialized = false;
  const checkAppReady = setInterval(() => {
    if (typeof window.state !== 'undefined' && typeof window.authAPI !== 'undefined') {
      clearInterval(checkAppReady);
      clearTimeout(readinessTimeout);
      hasInitialized = true;
      initializeLoginPage(DOM);
      // Initialize navigation
      if (typeof window.initNavigation === 'function') {
        window.initNavigation();
      }
    }
  }, 100);

  // Timeout after 5 seconds
  const readinessTimeout = setTimeout(() => {
    clearInterval(checkAppReady);
    if (!hasInitialized && (typeof window.state === 'undefined' || typeof window.authAPI === 'undefined')) {
      console.error('[Login Page] App.js not loaded properly');
    }
  }, 5000);
}
