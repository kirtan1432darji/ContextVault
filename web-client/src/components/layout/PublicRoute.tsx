import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import { LoadingSpinner } from '../common/LoadingSpinner';

export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
        <LoadingSpinner size="lg" text="Loading ContextVault..." />
      </div>
    );
  }

  if (isAuthenticated) {
    const origin = (location.state as { from?: { pathname?: string } })?.from?.pathname || ROUTES.DASHBOARD;
    return <Navigate to={origin} replace />;
  }

  return <>{children}</>;
};
