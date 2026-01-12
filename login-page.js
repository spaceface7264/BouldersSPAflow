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
  const refreshLoginPageUI = window.refreshLoginPageUI || (() => {});
  const populateProfileEditForm = window.populateProfileEditForm || (() => {});
  const handleLogout = window.handleLogout || (() => {});
  const showToast = window.showToast || ((msg, type) => console.log(`[Toast ${type}]:`, msg));
  const getErrorMessage = window.getErrorMessage || ((error) => error?.message || 'An error occurred');
  const isUserAuthenticated = window.isUserAuthenticated || (() => false);
  const getTokenMetadata = window.getTokenMetadata || (() => null);
  const syncAuthenticatedCustomerState = window.syncAuthenticatedCustomerState || (async () => {});
  const getUserDisplayName = window.getUserDisplayName || (() => '');

  // Refresh UI on page load
  if (refreshLoginPageUI) {
    refreshLoginPageUI();
  }

  // Populate profile edit form if logged in
  if (isUserAuthenticated && typeof isUserAuthenticated === 'function' && isUserAuthenticated() && state.authenticatedCustomer) {
    if (populateProfileEditForm && typeof populateProfileEditForm === 'function') {
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
    if (event.target.closest('[data-action="logout"]')) {
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
