-- Add missing INSERT and DELETE policies for profiles table
-- Currently only has SELECT and UPDATE policies

-- Users can insert their own profile (needed for new user registration)
CREATE POLICY "Users can insert own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile" 
ON public.profiles 
FOR DELETE 
USING (auth.uid() = id);