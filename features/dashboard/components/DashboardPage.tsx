import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCustomerId, clearTokens } from '../../../shared/lib/tokens';
import {
  getCustomerProfile,
  getSubscriptions,
  getValueCards,
  getUpcomingBookings,
  getRecommendedActivities,
} from '../api';
import { WelcomeSection } from './WelcomeSection';
import { AccessStatusCard } from './AccessStatusCard';
import { UpcomingClasses } from './UpcomingClasses';

// ── Skeleton loader ───────────────────────────────────────────────────────────

const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-100 rounded-xl ${className}`} />
);

const DashboardSkeleton: React.FC = () => (
  <div className="space-y-8">
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-64" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-40 w-full" />
    </div>
    <div className="space-y-3">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-32 w-full" />
    </div>
  </div>
);

// ── Error state ───────────────────────────────────────────────────────────────

const DashboardError: React.FC<{ onRetry: () => void }> = ({ onRetry }) => (
  <div className="text-center py-16">
    <p className="text-gray-500 mb-4">Something went wrong loading your dashboard.</p>
    <button
      onClick={onRetry}
      className="text-purple-600 text-sm font-medium hover:underline"
    >
      Try again
    </button>
  </div>
);

// ── Main Dashboard ────────────────────────────────────────────────────────────

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const customerId = getCustomerId();

  // Redirect to login if no customer ID
  React.useEffect(() => {
    if (!customerId) navigate('/login', { replace: true });
  }, [customerId, navigate]);

  const profileQuery = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomerProfile(customerId!),
    enabled: !!customerId,
    staleTime: 5 * 60 * 1000,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ['subscriptions', customerId],
    queryFn: () => getSubscriptions(customerId!),
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000,
  });

  const valueCardsQuery = useQuery({
    queryKey: ['valuecards', customerId],
    queryFn: () => getValueCards(customerId!),
    enabled: !!customerId,
    staleTime: 2 * 60 * 1000,
  });

  const bookingsQuery = useQuery({
    queryKey: ['bookings', customerId],
    queryFn: () => getUpcomingBookings(customerId!),
    enabled: !!customerId,
    staleTime: 1 * 60 * 1000,
  });

  const homeGymId = profileQuery.data?.businessUnit?.id;
  const hasBookings = (bookingsQuery.data?.length ?? 0) > 0;

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', homeGymId],
    queryFn: () => getRecommendedActivities(homeGymId!),
    enabled: !!homeGymId && !hasBookings && !bookingsQuery.isLoading,
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = () => {
    clearTokens();
    localStorage.removeItem('boulders_dashboard_visited');
    window.dispatchEvent(new Event('auth-state-changed'));
    navigate('/login', { replace: true });
  };

  const isLoading = profileQuery.isLoading || subscriptionsQuery.isLoading || valueCardsQuery.isLoading;
  const hasError = profileQuery.isError || subscriptionsQuery.isError;

  const refetchAll = () => {
    profileQuery.refetch();
    subscriptionsQuery.refetch();
    valueCardsQuery.refetch();
    bookingsQuery.refetch();
  };

  if (!customerId) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="bg-gray-900 text-white py-4 px-4 sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <span className="text-gray-900 font-bold text-sm">B</span>
            </div>
            <span className="font-bold text-lg tracking-wide">BOULDERS</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Log out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-lg">
        {isLoading && <DashboardSkeleton />}

        {!isLoading && hasError && <DashboardError onRetry={refetchAll} />}

        {!isLoading && !hasError && profileQuery.data && (
          <div className="space-y-8">
            <WelcomeSection customer={profileQuery.data} />

            <AccessStatusCard
              customer={profileQuery.data}
              subscriptions={subscriptionsQuery.data ?? []}
              valueCards={valueCardsQuery.data ?? []}
            />

            <UpcomingClasses
              bookedClasses={bookingsQuery.data ?? []}
              recommendedActivities={recommendationsQuery.data ?? []}
              homeGym={profileQuery.data.businessUnit}
              isLoadingRecommendations={recommendationsQuery.isLoading}
            />
          </div>
        )}
      </main>
    </div>
  );
};
