import React, { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
      // Don’t check onboarding on auth/reset/onboarding routes
      if (
        !user ||
        location.pathname === "/onboarding" ||
        location.pathname === "/auth" ||
        location.pathname === "/reset-password"
      ) {
        setCheckingOnboarding(false);
        return;
      }

      try {
        const { data: preferences } = await supabase
          .from("user_preferences")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!preferences || !preferences.onboarding_completed) {
          setNeedsOnboarding(true);
        }
      } catch (error) {
        console.error("Error checking onboarding status:", error);
      } finally {
        setCheckingOnboarding(false);
      }
    };

    checkOnboardingStatus();
  }, [user, location.pathname]);

  // Overall loading (auth or onboarding)
  if (loading || checkingOnboarding) {
    return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  }

  // Not logged in → go to /auth
  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  // Handle password recovery routing
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, "")
  );
  const type = searchParams.get("type") || hashParams.get("type");
  const hasRecoveryTokens =
    type === "recovery" ||
    !!searchParams.get("access_token") ||
    !!hashParams.get("access_token");

  if (
    (isRecoverySession || hasRecoveryTokens) &&
    location.pathname !== "/reset-password"
  ) {
    return <Navigate to="/reset-password" replace />;
  }

  // Force onboarding if needed
  if (needsOnboarding && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
