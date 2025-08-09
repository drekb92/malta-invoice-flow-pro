import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isRecoverySession } = useAuth();

  useEffect(() => {
    // Check if this is a password reset session
    const checkResetSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check if user came from email link with recovery parameters or is in recovery session
      // Check both query string and URL hash (Supabase often uses hash)
      const accessToken = searchParams.get('access_token');
      const type = searchParams.get('type');
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const hashAccessToken = hashParams.get('access_token');
      const hashType = hashParams.get('type');
      
      if (session && (type === 'recovery' || hashType === 'recovery' || accessToken || hashAccessToken || isRecoverySession)) {
        setIsValidSession(true);
      } else if (session && !isRecoverySession) {
        // User is already logged in normally, redirect to dashboard
        navigate('/');
      } else {
        // No valid session, redirect to auth
        navigate('/auth');
      }
    };

    checkResetSession();
  }, [navigate, searchParams, isRecoverySession]);

  // Listen for Supabase auth events to detect recovery reliably
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsValidSession(true);
      }
      // If user signs in normally and not in recovery, redirect to dashboard
      if (event === 'SIGNED_IN' && session && !isRecoverySession) {
        navigate('/');
      }
    });
    return () => subscription?.unsubscribe();
  }, [navigate, isRecoverySession]);
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "Success",
        description: "Password updated successfully! You can now sign in with your new password.",
      });

      // Clear URL parameters and sign out to clear recovery session
      window.history.replaceState({}, document.title, window.location.pathname);
      await supabase.auth.signOut({ scope: 'global' });
      navigate('/auth');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <p>Loading...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm New Password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirm your new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => navigate('/auth')}
              disabled={loading}
            >
              Back to Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;