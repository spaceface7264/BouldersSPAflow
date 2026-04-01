import React from 'react';
import { Navigate } from 'react-router-dom';
import { hasTokens, isTokenExpired } from '../lib/tokens';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

/**
 * Redirects to /login if the user is not authenticated or their token has expired.
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  redirectTo = '/login',
}) => {
  const authenticated = hasTokens() && !isTokenExpired();

  if (!authenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
