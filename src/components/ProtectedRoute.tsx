import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  // Development bypass indicator
  const isDev = import.meta.env.DEV;
  const bypassAuth = isDev && localStorage.getItem('bypass-auth') === 'true';

  // Show bypass banner if active
  const content = bypassAuth ? (
    <>
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-500 text-black text-center py-1 text-sm font-medium">
        ⚠️ AUTH BYPASS ACTIVE - Logged in as drekb92@gmail.com (Development Mode)
        <button 
          onClick={() => {
            localStorage.removeItem('bypass-auth');
            window.location.reload();
          }}
          className="ml-2 underline hover:no-underline"
        >
          Disable
        </button>
      </div>
      <div style={{ paddingTop: '32px' }}>
        {children}
      </div>
    </>
  ) : children;

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

  return <>{content}</>;
};

export default ProtectedRoute;