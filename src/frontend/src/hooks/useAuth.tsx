import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  type ApiResult,
  api,
  setSuppressAuthRedirect,
  withSuppressedAuthRedirect,
} from '../services/api';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

interface SessionPayload {
  user: User;
  expiresAt: string;
}

/** `GET /auth/me` returns the user flat; older payloads nest it under `user`. */
type MePayload = User & { user?: User };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  needsSetup: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  checkSetup: () => Promise<void>;
  setup: (email: string, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [setupComplete, setSetupComplete] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const fetchUser = async () => {
    try {
      const response = (await api.get('/auth/me')) as unknown as ApiResult<MePayload>;
      if (response.success) {
        setUser(response.data.user ?? response.data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
      setSuppressAuthRedirect(false);
    }
  };

  const checkSetup = useCallback(async () => {
    setSuppressAuthRedirect(true);
    try {
      const statusResponse = (await api.get('/auth/setup-status')) as unknown as ApiResult<{
        needsSetup: boolean;
      }>;
      if (statusResponse.data?.needsSetup) {
        setNeedsSetup(true);
        setLoading(false);
        setSuppressAuthRedirect(false);
        return;
      }
      setSetupComplete(true);
    } catch {
      // If check fails, assume setup is needed (fresh DB without admin)
      // This prevents redirecting to /login when the DB query fails
      setNeedsSetup(true);
      setLoading(false);
      setSuppressAuthRedirect(false);
    }
  }, []);

  const login = async (email: string, password: string, rememberMe = false) => {
    await withSuppressedAuthRedirect(async () => {
      const response = (await api.post('/auth/login', {
        email,
        password,
        rememberMe,
      })) as unknown as ApiResult<SessionPayload>;
      if (response.success) {
        setUser(response.data.user);
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    });
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  };

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all');
    } finally {
      setUser(null);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await withSuppressedAuthRedirect(async () => {
      const response = (await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      })) as unknown as ApiResult<void>;
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to change password');
      }
    });
  };

  const setup = async (email: string, password: string) => {
    const response = (await api.post('/auth/setup', {
      email,
      password,
      confirmPassword: password,
    })) as unknown as ApiResult<SessionPayload>;
    if (response.success) {
      setUser(response.data.user);
      setNeedsSetup(false);
      setSetupComplete(true);
      setSuppressAuthRedirect(false);
    } else {
      throw new Error(response.error?.message || 'Setup failed');
    }
  };

  useEffect(() => {
    checkSetup();
  }, [checkSetup]);

  useEffect(() => {
    if (setupComplete && !user) {
      fetchUser();
    }
  }, [setupComplete, user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsSetup,
        login,
        logout,
        logoutAll,
        changePassword,
        checkSetup,
        setup,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
