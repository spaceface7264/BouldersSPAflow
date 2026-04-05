export const PAGE_ROUTES = ['dashboard', 'classes', 'activity', 'gyms', 'profile', 'settings'];

export const PAGE_ROUTE_MAP = {
  dashboard: 'pageDashboard',
  classes: 'pageClasses',
  activity: 'pageActivity',
  gyms: 'pageGyms',
  profile: 'pageProfile',
  settings: 'pageSettings',
};

/**
 * Single composition-root object for profile page slices. Prefer passing `ctx`
 * into feature init functions over new window.* globals.
 */
export function buildProfileContext(DOM) {
  return {
    DOM,
    state: window.state,
    authAPI: window.authAPI,
    hostname: typeof window !== 'undefined' ? window.location.hostname : '',
    showToast: window.showToast || ((msg, type) => console.log(`[Toast ${type}]:`, msg)),
    getErrorMessage: window.getErrorMessage || ((error) => error?.message || 'An error occurred'),
    isUserAuthenticated: window.isUserAuthenticated || (() => false),
    getTokenMetadata: window.getTokenMetadata || (() => null),
    syncAuthenticatedCustomerState: window.syncAuthenticatedCustomerState || (async () => {}),
    getUserDisplayName: window.getUserDisplayName || (() => ''),
    refreshLoginUI: window.refreshLoginUI || (() => {}),
    handleLogout: window.handleLogout || (() => {}),
    PAGE_ROUTES,
    PAGE_ROUTE_MAP,
  };
}
