// src/hooks/useAuth.tsx
import React, {
  useState,
  useEffect,
  createContext,
  useContext,
  PropsWithChildren,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isRecoverySession: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  const cleanupAuthState = () => {
    // Clear all auth-related keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
        localStorage.removeItem(key);
      }
    });

    // Clear from sessionStorage if in use
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith("supabase.auth.") || key.includes("sb-")) {
        sessionStorage.removeItem(key);
      }
    });
  };

  const signOut = async (): Promise<void> => {
    try {
      // Clean up auth state
      cleanupAuthState();

      try {
        await supabase.auth.signOut({ scope: "global" });
      } catch {
        // ignore errors from signOut
      }

      // Force redirect for a clean state
      window.location.href = "/auth";
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = "/auth";
    }
  };

  useEffect(() => {
    const checkRecoverySession = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const type = searchParams.get("type") || hashParams.get("type");
      const accessToken =
        searchParams.get("access_token") || hashParams.get("access_token");

      return type === "recovery" || accessToken !== null;
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      const isRecoveryEvent = event === "PASSWORD_RECOVERY";
      const isRecovery = isRecoveryEvent || checkRecoverySession();
      setIsRecoverySession(isRecovery);

      if (event === "SIGNED_OUT") {
        setIsRecoverySession(false);
      }

      if (event === "SIGNED_IN" && nextSession?.user && !isRecovery) {
        setTimeout(() => {
          console.log("User signed in:", nextSession.user.email);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsRecoverySession(checkRecoverySession());
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthContextType = {
    user,
    session,
    loading,
    isRecoverySession,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
