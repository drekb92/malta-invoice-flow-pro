import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isRecoverySession } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Detect recovery via URL or context and force reset-password
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const type = searchParams.get('type') || hashParams.get('type');
  const hasRecoveryTokens = type === 'recovery' || !!searchParams.get('access_token') || !!hashParams.get('access_token');

  // If user is in recovery flow and trying to access any page other than reset-password,
  // redirect to reset-password page
  if ((isRecoverySession || hasRecoveryTokens) && window.location.pathname !== '/reset-password') {
    return <Navigate to="/reset-password" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;