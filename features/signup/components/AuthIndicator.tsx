import React, { useState, useEffect } from 'react';

interface AuthState {
  isAuthenticated: boolean;
  email: string | null;
}

export const AuthIndicator: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    email: null,
  });

  const checkAuthState = () => {
    // Check if user is authenticated by checking for access token
    const hasToken = typeof window !== 'undefined' && 
                     typeof (window as any).getAccessToken === 'function' &&
                     (window as any).getAccessToken() !== null;
    
    if (!hasToken) {
      setAuthState({ isAuthenticated: false, email: null });
      return;
    }

    // Try to get email from various sources
    let email: string | null = null;

    // Check token metadata
    if (typeof (window as any).getTokenMetadata === 'function') {
      const metadata = (window as any).getTokenMetadata();
      if (metadata?.email) {
        email = metadata.email;
      }
    }

    // Check global state if available
    if (!email && typeof (window as any).state !== 'undefined') {
      const state = (window as any).state;
      if (state?.authenticatedEmail) {
        email = state.authenticatedEmail;
      } else if (state?.authenticatedCustomer?.email) {
        email = state.authenticatedCustomer.email;
      }
    }

    setAuthState({
      isAuthenticated: hasToken,
      email: email,
    });
  };

  useEffect(() => {
    // Check auth state on mount
    checkAuthState();

    // Set up polling to check auth state periodically
    const interval = setInterval(checkAuthState, 1000);

    // Listen for storage events (when tokens are saved/cleared)
    const handleStorageChange = () => {
      checkAuthState();
    };

    window.addEventListener('storage', handleStorageChange);

    // Listen for custom auth events if they exist
    const handleAuthChange = () => {
      checkAuthState();
    };

    window.addEventListener('auth-state-changed', handleAuthChange as EventListener);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-state-changed', handleAuthChange as EventListener);
    };
  }, []);

  const handleLogout = () => {
    // Call the logout function if it exists
    if (typeof (window as any).clearTokens === 'function') {
      (window as any).clearTokens();
    }

    // Also try handleLogout if it exists
    if (typeof (window as any).handleLogout === 'function') {
      (window as any).handleLogout();
    }

    // Clear local state
    setAuthState({ isAuthenticated: false, email: null });

    // Dispatch event to notify other components
    window.dispatchEvent(new Event('auth-state-changed'));

    // Reload page to ensure clean state
    window.location.reload();
  };

  if (!authState.isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-300">
        Logged in as: <span className="font-semibold text-white">{authState.email || 'User'}</span>
      </span>
      <button
        onClick={handleLogout}
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
      >
        Log out
      </button>
    </div>
  );
};
