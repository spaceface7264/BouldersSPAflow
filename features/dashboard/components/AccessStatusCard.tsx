import React from 'react';
import type { CustomerOut, SubscriptionOut, CustomerValueCardOut } from '../types';
import { isTrial } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(day?: string): string {
  if (!day) return '—';
  return new Date(day).toLocaleDateString('en-DK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatPrice(price?: { amount: number; currency: string }): string {
  if (!price) return '—';
  return new Intl.NumberFormat('da-DK', {
    style: 'currency',
    currency: price.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price.amount);
}

function isFrozen(sub: SubscriptionOut): boolean {
  return sub.statuses?.some((s) => s.code === 'FROZEN') ?? false;
}

function isTerminated(sub: SubscriptionOut): boolean {
  return sub.statuses?.some((s) => s.code === 'TERMINATED') ?? false;
}

// ── Badge ─────────────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
    {label}
  </span>
);

const CustomerTypeBadge: React.FC<{ name: string }> = ({ name }) => {
  // Only show non-default customer types — Almindelig/Voksen is the default
  if (!name || name.toLowerCase().includes('almindelig')) return null;

  const colorMap: Record<string, string> = {
    'o.g': 'bg-yellow-100 text-yellow-800',
    legend: 'bg-purple-100 text-purple-800',
    'young g': 'bg-blue-100 text-blue-800',
    studerende: 'bg-green-100 text-green-800',
  };
  const color = colorMap[name.toLowerCase()] ?? 'bg-gray-100 text-gray-800';

  return <StatusBadge label={`Bloc Life: ${name}`} color={color} />;
};

// ── Membership Card ───────────────────────────────────────────────────────────

const MembershipCard: React.FC<{
  subscription: SubscriptionOut;
  customer: CustomerOut;
}> = ({ subscription, customer }) => {
  const frozen = isFrozen(subscription);
  const terminated = isTerminated(subscription);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* Header row */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Membership
          </p>
          <h3 className="text-lg font-bold text-gray-900">
            {subscription.subscriptionProduct?.name ?? 'Membership'}
          </h3>
        </div>
        <div className="flex flex-wrap gap-1.5 justify-end">
          {frozen && <StatusBadge label="Frozen" color="bg-blue-100 text-blue-700" />}
          {terminated && <StatusBadge label="Cancelled" color="bg-red-100 text-red-700" />}
          {!frozen && !terminated && (
            <StatusBadge label="Active" color="bg-green-100 text-green-700" />
          )}
          {customer.customerType?.name && (
            <CustomerTypeBadge name={customer.customerType.name} />
          )}
        </div>
      </div>

      {/* Detail grid */}
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Member since</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatDate(customer.memberJoinDate ?? subscription.start)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Monthly price</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatPrice(subscription.price)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Bound until</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatDate(subscription.boundUntil)}
          </dd>
        </div>
        {frozen && subscription.freeze?.period && (
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Frozen until</dt>
            <dd className="text-sm font-medium text-blue-700">
              {formatDate(subscription.freeze.period.end)}
            </dd>
          </div>
        )}
        {terminated && subscription.expirationDay && (
          <div>
            <dt className="text-xs text-gray-400 mb-0.5">Access until</dt>
            <dd className="text-sm font-medium text-gray-800">
              {formatDate(subscription.expirationDay)}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
};

// ── Trial Card ────────────────────────────────────────────────────────────────

const TrialCard: React.FC<{ subscription: SubscriptionOut }> = ({ subscription }) => {
  const today = new Date();
  const endDate = subscription.boundUntil
    ? new Date(subscription.boundUntil)
    : null;
  const daysLeft = endDate
    ? Math.max(0, Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Trial Pass
          </p>
          <h3 className="text-lg font-bold text-gray-900">15-Day Trial</h3>
        </div>
        <div className="flex gap-1.5">
          {daysLeft !== null && daysLeft > 0 ? (
            <StatusBadge label="Active" color="bg-green-100 text-green-700" />
          ) : (
            <StatusBadge label="Expired" color="bg-gray-100 text-gray-500" />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Start date</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatDate(subscription.start)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">End date</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatDate(subscription.boundUntil)}
          </dd>
        </div>
      </dl>

      {daysLeft !== null && daysLeft > 0 && (
        <div className="mt-4 bg-purple-50 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-purple-700 text-center">
            {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining
          </p>
        </div>
      )}

      {daysLeft !== null && daysLeft <= 3 && daysLeft > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700">
            Your trial ends soon. Ready to become a full member?{' '}
            <a href="/signup/membership" className="font-semibold hover:underline">
              Choose a plan
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

// ── Punch Card ────────────────────────────────────────────────────────────────

const PunchCardCard: React.FC<{ card: CustomerValueCardOut }> = ({ card }) => {
  const units = card.unitsLeft ?? 0;
  const isExpired = card.validUntil
    ? new Date(card.validUntil) < new Date()
    : false;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
            Punch Card
          </p>
          <h3 className="text-lg font-bold text-gray-900">
            {card.validCardProduct?.name ?? 'Punch Card'}
          </h3>
        </div>
        <div>
          {isExpired ? (
            <StatusBadge label="Expired" color="bg-red-100 text-red-700" />
          ) : units > 0 ? (
            <StatusBadge label="Active" color="bg-green-100 text-green-700" />
          ) : (
            <StatusBadge label="Used up" color="bg-gray-100 text-gray-500" />
          )}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Entries left</dt>
          <dd className="text-2xl font-bold text-gray-900">{units}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-400 mb-0.5">Expires</dt>
          <dd className="text-sm font-medium text-gray-800">
            {formatDate(card.validUntil)}
          </dd>
        </div>
      </dl>

      {units <= 2 && units > 0 && !isExpired && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-sm text-amber-700">
            Running low!{' '}
            <a href="/signup/membership" className="font-semibold hover:underline">
              Top up or switch to a membership
            </a>
          </p>
        </div>
      )}
    </div>
  );
};

// ── No Access ─────────────────────────────────────────────────────────────────

const NoAccessCard: React.FC = () => (
  <div className="bg-white rounded-2xl shadow-sm border border-dashed border-gray-200 p-6">
    <p className="text-gray-600 text-sm leading-relaxed mb-2">
      We don’t see an active membership, punch card, or trial on this account yet.
    </p>
    <p className="text-gray-500 text-sm leading-relaxed mb-4">
      Pick your gym and choose a plan to get started—it only takes a few minutes.
    </p>
    <a
      href="/signup/personal"
      className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
    >
      Get access
    </a>
  </div>
);

// ── Main Export ───────────────────────────────────────────────────────────────

interface AccessStatusCardProps {
  customer: CustomerOut;
  subscriptions: SubscriptionOut[];
  valueCards: CustomerValueCardOut[];
}

export const AccessStatusCard: React.FC<AccessStatusCardProps> = ({
  customer,
  subscriptions,
  valueCards,
}) => {
  // Find active trial first
  const trial = subscriptions.find(
    (s) => isTrial(s.subscriptionProduct?.name) && !s.statuses?.some((st) => st.code === 'TERMINATED')
  );

  // Find active non-trial membership
  const membership = subscriptions.find(
    (s) => !isTrial(s.subscriptionProduct?.name) && !s.statuses?.some((st) => st.code === 'TERMINATED')
  );

  // Find valid punch cards
  const activeCards = valueCards.filter(
    (c) => c.isValid && (c.unitsLeft ?? 0) > 0
  );

  // If they have an active terminated one too, show that as well
  const terminatedMembership = !membership
    ? subscriptions.find(
        (s) => !isTrial(s.subscriptionProduct?.name) && s.statuses?.some((st) => st.code === 'TERMINATED')
      )
    : undefined;

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold text-gray-700">My Access</h2>

      {trial && <TrialCard subscription={trial} />}

      {membership && <MembershipCard subscription={membership} customer={customer} />}

      {!membership && terminatedMembership && (
        <MembershipCard subscription={terminatedMembership} customer={customer} />
      )}

      {activeCards.map((card) => (
        <PunchCardCard key={card.id} card={card} />
      ))}

      {!trial && !membership && !terminatedMembership && activeCards.length === 0 && (
        <NoAccessCard />
      )}

      <a
        href="mailto:medlem@boulders.dk"
        className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors w-fit"
      >
        Something wrong? Contact support
      </a>
    </div>
  );
};
