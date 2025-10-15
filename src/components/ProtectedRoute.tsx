import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { user, loading, isRecoverySession } = useAuth();
  const location = useLocation();
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      if (!user || location.pathname === '/onboarding' || location.pathname === '/auth' || location.pathname === '/reset-password') {
        setCheckingOnboarding(false);
        return;
      }

      try {
        // Check if user has completed onboarding
        const { data: preferences } = await supabase
          .from('user_preferences')
          .select('onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        // If no preferences record exists or onboarding is not completed, redirect to onboarding
        if (!preferences || !preferences.onboarding_completed) {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user, location.pathname]);

  if (loading || checkingOnboarding) {
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

  // If user needs onboarding and is not already on the onboarding page, redirect
  if (needsOnboarding && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;