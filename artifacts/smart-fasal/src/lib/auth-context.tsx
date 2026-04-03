import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  email: string | null;
  fullName: string;
  isGuest: boolean;
  profileComplete: boolean;
  avatarUrl?: string | null;
  phone?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  farmSizeAcres?: number | null;
  primaryCrop?: string | null;
  farmingExperienceYears?: number | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  session: Session | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: User): AuthUser {
  const meta = user.user_metadata ?? {};
  return {
    id: user.id,
    email: user.email ?? null,
    fullName: meta.full_name ?? (user.is_anonymous ? "Guest Farmer" : (user.email?.split("@")[0] ?? "Farmer")),
    isGuest: user.is_anonymous ?? false,
    profileComplete: true,
    avatarUrl: meta.avatar_url ?? null,
    phone: meta.phone ?? null,
    village: meta.village ?? null,
    district: meta.district ?? null,
    state: meta.state ?? null,
    farmSizeAcres: meta.farm_size_acres ?? null,
    primaryCrop: meta.primary_crop ?? null,
    farmingExperienceYears: meta.farming_experience_years ?? null,
    createdAt: user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSession(session);
    setUser(session?.user ? mapUser(session.user) : null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ? mapUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be inside AuthProvider");
  return ctx;
}
