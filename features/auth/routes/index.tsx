import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../components/LoginPage';

export const AuthRoutes: React.FC = () => (
  <Routes>
    <Route index element={<LoginPage />} />
    <Route path="*" element={<Navigate to="/login" replace />} />
  </Routes>
);
