import React, { useEffect, useRef } from 'react';
import type { CustomerOut } from '../types';

const FIRST_VISIT_KEY = 'boulders_dashboard_visited';

interface WelcomeSectionProps {
  customer: CustomerOut;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({ customer }) => {
  const isFirstVisit = useRef<boolean>(!localStorage.getItem(FIRST_VISIT_KEY));

  useEffect(() => {
    // Mark as visited after first render so the message only changes on next login
    if (isFirstVisit.current) {
      localStorage.setItem(FIRST_VISIT_KEY, 'true');
    }
  }, []);

  const greeting = isFirstVisit.current
    ? `Welcome, ${customer.firstName}!`
    : `Welcome back, ${customer.firstName}!`;

  const subtext = isFirstVisit.current
    ? "Great to have you here. Your climbing journey starts now."
    : "Good to see you again. Here's your overview.";

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="mb-8">
      <p className="text-sm font-medium text-purple-600 mb-1">{timeGreeting}</p>
      <h1 className="text-3xl font-bold text-gray-900">{greeting}</h1>
      <p className="text-gray-500 mt-1">{subtext}</p>
    </div>
  );
};
