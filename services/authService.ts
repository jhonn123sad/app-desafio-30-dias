
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEVICE_EMAIL_KEY = 'rt_device_email_v2';
const DEVICE_PASS_KEY = 'rt_device_pass_v2';

export const getCurrentUser = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user || null;
};

export const signIn = async (email: string, password: string) => {
  return await supabase.auth.signInWithPassword({
    email,
    password
  });
};

export const signUp = async (email: string, password: string) => {
  return await supabase.auth.signUp({
    email,
    password
  });
};

export const signOut = async () => {
  return await supabase.auth.signOut();
};

/**
 * Attempts to authenticate the user silently without UI interaction.
 */
export const authenticateSilently = async () => {
  // 1. Check if already has session
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user;

  // 2. Try Anonymous Sign In
  try {
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (!anonError && anonData.user) {
      return anonData.user;
    }
  } catch (e) {
    // Anon auth not enabled
  }

  // 3. Retrieve or Generate Device Credentials
  let email = localStorage.getItem(DEVICE_EMAIL_KEY);
  let password = localStorage.getItem(DEVICE_PASS_KEY);

  if (!email || !password) {
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substring(2);
    // Use a domain that might be accepted, though confirmation is out of our control
    email = `device_${uniqueId}@routine-tracker.local`; 
    password = `pass_${uniqueId}_${Math.random().toString(36)}`;
    
    localStorage.setItem(DEVICE_EMAIL_KEY, email);
    localStorage.setItem(DEVICE_PASS_KEY, password);
  }

  // 4. Try Sign In
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (!signInError && signInData.user) {
    return signInData.user;
  }

  // 5. If Sign In failed (invalid credentials), Sign Up
  if (signInError && (signInError.message.includes('Invalid login') || signInError.status === 400)) {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password
    });

    if (signUpError) throw signUpError;
    
    // If user created but no session, email confirmation is likely required.
    // We throw to handle this gracefully in App.tsx
    if (signUpData.user && !signUpData.session) {
      throw new Error("CONFIRMATION_REQUIRED");
    }

    return signUpData.user;
  }

  if (signInError) throw signInError;
  return null;
};
