import React from 'react';
import type { GroupActivityBookingOut, GroupActivityOut, BusinessUnitOutRef } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatClassTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-DK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return '';
  const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
  return `${mins} min`;
}

// ── Booked class row ──────────────────────────────────────────────────────────

const BookedClassRow: React.FC<{ booking: GroupActivityBookingOut }> = ({ booking }) => (
  <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
    {/* Time column */}
    <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0 mt-0.5" />
    <div className="min-w-0 flex-1">
      <p className="font-medium text-gray-900 text-sm truncate">
        {booking.groupActivity?.name ?? 'Class'}
      </p>
      <p className="text-xs text-gray-400 mt-0.5">
        {formatClassTime(booking.duration?.start)}
        {booking.duration?.end && (
          <span className="ml-1.5 text-gray-300">
            · {formatDuration(booking.duration.start, booking.duration.end)}
          </span>
        )}
      </p>
      {booking.businessUnit && (
        <p className="text-xs text-gray-400">{booking.businessUnit.name}</p>
      )}
    </div>
    <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex-shrink-0">
      Booked
    </span>
  </div>
);

// ── Recommendation row ────────────────────────────────────────────────────────

const RecommendedClassRow: React.FC<{ activity: GroupActivityOut }> = ({ activity }) => (
  <div className="flex items-center gap-4 py-3 border-b border-gray-50 last:border-0">
    <div className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0 mt-0.5" />
    <div className="min-w-0 flex-1">
      <p className="font-medium text-gray-900 text-sm truncate">{activity.name}</p>
      <p className="text-xs text-gray-400 mt-0.5">
        {formatClassTime(activity.duration?.start)}
        {activity.duration?.end && (
          <span className="ml-1.5 text-gray-300">
            · {formatDuration(activity.duration.start, activity.duration.end)}
          </span>
        )}
      </p>
      {activity.slots?.available !== undefined && (
        <p className="text-xs text-gray-400">
          {activity.slots.available} spot{activity.slots.available !== 1 ? 's' : ''} left
        </p>
      )}
    </div>
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyClasses: React.FC<{ homeGym?: BusinessUnitOutRef }> = ({ homeGym }) => (
  <div className="py-6 text-center">
    {homeGym && (
      <p className="text-xs text-gray-300">Looking for classes at {homeGym.name}</p>
    )}
  </div>
);

// ── Main Export ───────────────────────────────────────────────────────────────

interface UpcomingClassesProps {
  bookedClasses: GroupActivityBookingOut[];
  recommendedActivities: GroupActivityOut[];
  homeGym?: BusinessUnitOutRef;
  isLoadingRecommendations?: boolean;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
  bookedClasses,
  recommendedActivities,
  homeGym,
  isLoadingRecommendations = false,
}) => {
  const hasBookings = bookedClasses.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-700">
          {hasBookings ? 'Upcoming Classes' : 'Classes Near You'}
        </h2>
        {homeGym && !hasBookings && (
          <span className="text-xs text-gray-400">{homeGym.name}</span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        {hasBookings ? (
          <>
            {bookedClasses.slice(0, 5).map((b) => (
              <BookedClassRow key={b.groupActivityBooking?.id ?? b.groupActivity?.id} booking={b} />
            ))}
            {bookedClasses.length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-2">
                +{bookedClasses.length - 5} more booked
              </p>
            )}
          </>
        ) : isLoadingRecommendations ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-300 animate-pulse">Finding classes near you…</p>
          </div>
        ) : recommendedActivities.length > 0 ? (
          <>
            <p className="text-xs text-gray-400 mb-3">
              You have no upcoming bookings. Here are some classes at your home gym:
            </p>
            {recommendedActivities.map((a) => (
              <RecommendedClassRow key={a.id} activity={a} />
            ))}
          </>
        ) : (
          <EmptyClasses homeGym={homeGym} />
        )}
      </div>
    </div>
  );
};
