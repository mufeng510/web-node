import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { api, setSuppressAuthRedirect } from '../services/api';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'user';
}

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
      const response = await api.get('/auth/me');
      if (response.success) {
        setUser(response.data.user);
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

  const checkSetup = async () => {
    setSuppressAuthRedirect(true);
    try {
      const statusResponse = await api.get('/auth/setup-status');
      if (statusResponse.data?.needsSetup) {
        setNeedsSetup(true);
        setLoading(false);
        // Don't clear suppressAuthRedirect here — keep suppressing 401 redirects
        // while in setup mode (e.g., LibraryProvider.fetchLibraries() may 401).
        return;
      }
      setSetupComplete(true);
    } catch {
      setSetupComplete(false);
      setLoading(false);
      setSuppressAuthRedirect(false);
    }
  };

  const login = async (email: string, password: string, rememberMe = false) => {
    const response = await api.post('/auth/login', { email, password, rememberMe });
    if (response.success) {
      setUser(response.data.user);
    } else {
      throw new Error(response.error?.message || 'Login failed');
    }
  };

  const logout = async () => {
    await api.post('/auth/logout');
    setUser(null);
  };

  const logoutAll = async () => {
    await api.post('/auth/logout-all');
    setUser(null);
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await api.post('/auth/change-password', { currentPassword, newPassword });
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to change password');
    }
  };

  const setup = async (email: string, password: string) => {
    const response = await api.post('/auth/setup', { email, password, confirmPassword: password });
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
    if (setupComplete) {
      fetchUser();
    }
  }, [setupComplete]);

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
