import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [myMemberId, setMyMemberId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setMyMemberId(null);
      return;
    }
    setProfileLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Failed to load profile', error);
      setProfile(null);
    } else {
      setProfile(data);
      // Look up the linked member record (if any)
      const { data: m } = await supabase
        .from('members')
        .select('id')
        .eq('profile_id', userId)
        .maybeSingle();
      setMyMemberId(m?.id ?? null);
    }
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      if (!mounted) return;
      setSession(s);
      setLoading(false);
      if (s?.user?.id) loadProfile(s.user.id);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        if (s?.user?.id) loadProfile(s.user.id);
        else setProfile(null);
      }
    );

    return () => {
      mounted = false;
      subscription?.subscription?.unsubscribe();
    };
  }, [loadProfile]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signUp = useCallback(async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const value = useMemo(
    () => {
      const role = profile?.role;
      const approved = profile?.approval_status === 'approved';
      const isAdmin         = approved && role === 'admin';
      const isChairperson   = approved && role === 'chairperson';
      const isTreasurer     = approved && role === 'treasurer';
      const isWelfareChair  = approved && role === 'welfare_chair';
      const isStaff         = approved && ['admin', 'chairperson', 'treasurer', 'welfare_chair'].includes(role);
      const isAdminOrChair  = approved && ['admin', 'chairperson'].includes(role);
      const canManageFinances = approved && ['admin', 'chairperson', 'treasurer'].includes(role);
      const canManageWelfare  = approved && ['admin', 'chairperson', 'treasurer', 'welfare_chair'].includes(role);
      const canVerifyContributions = approved && ['admin', 'treasurer'].includes(role);

      return {
        session,
        user: session?.user ?? null,
        profile,
        loading: loading || profileLoading,
        role,
        isAdmin,
        isChairperson,
        isTreasurer,
        isWelfareChair,
        isStaff,
        isAdminOrChair,
        canManageFinances,
        canManageWelfare,
        canVerifyContributions,
        myMemberId,
        hasLinkedMember: !!myMemberId,
        isApproved: approved,
        isPending: profile?.approval_status === 'pending',
        isRejected: profile?.approval_status === 'rejected',
        signIn,
        signUp,
        signOut,
        refreshProfile,
      };
    },
    [session, profile, myMemberId, loading, profileLoading, signIn, signUp, signOut, refreshProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
