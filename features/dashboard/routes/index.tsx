import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { DashboardPage } from '../components/DashboardPage';

export const DashboardRoutes: React.FC = () => (
  <Routes>
    <Route index element={<DashboardPage />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
);
