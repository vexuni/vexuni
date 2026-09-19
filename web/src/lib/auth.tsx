import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type { User } from "./types";

interface Auth {
  user: User | null;
  /** True while the first /api/bootstrap call is in flight. */
  booting: boolean;
  /** True when the instance has never been initialized. */
  setupRequired: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Auth>({
  user: null,
  booting: true,
  setupRequired: false,
  refresh: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const boot = await api.get<{ user: User | null; required: boolean }>(
        "/bootstrap",
      );
      setUser(boot.user);
      setSetupRequired(boot.required);
    } catch {
      try {
        const me = await api.get<{ user: User | null }>("/me");
        setUser(me.user);
      } catch {
        setUser(null);
      }
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await api.post("/logout");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, setupRequired, refresh, logout }),
    [user, booting, setupRequired, refresh, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
