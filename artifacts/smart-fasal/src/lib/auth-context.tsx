import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  phone?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  farmSizeAcres?: number | null;
  primaryCrop?: string | null;
  farmingExperienceYears?: number | null;
  profileComplete: boolean;
  avatarUrl?: string | null;
  createdAt: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/auth/me`, { credentials: "include" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" });
    } catch { /* ignore */ }
    setUser(null);
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setLoading(false));
  }, [refreshUser]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be inside AuthProvider");
  return ctx;
}
