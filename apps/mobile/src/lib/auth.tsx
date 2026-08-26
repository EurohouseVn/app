import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser, LoginResponse, RegisterFactoryInput } from '@eurohouse/types';
import { api, setAuthToken, setUnauthorizedHandler } from './api';

const TOKEN_KEY = 'eurohouse-token';

// SecureStore không hỗ trợ web → fallback localStorage khi chạy Expo web.
const storage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  registerFactory: (input: RegisterFactoryInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
    void storage.remove(TOKEN_KEY);
  }, []);

  // Khôi phục phiên từ token đã lưu khi mở app.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        const token = await storage.get(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          setUser(await api.get<AuthUser>('/auth/me'));
        }
      } catch {
        try {
          setAuthToken(null);
          await storage.remove(TOKEN_KEY);
        } catch {
          // Storage can be unavailable in a restricted webview; the login screen must still load.
        }
      } finally {
        setReady(true);
      }
    })();
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { identifier, password });
    setAuthToken(res.user.token);
    await storage.set(TOKEN_KEY, res.user.token);
    setUser(await api.get<AuthUser>('/auth/me'));
  }, []);

  const registerFactory = useCallback(async (input: RegisterFactoryInput) => {
    const res = await api.post<LoginResponse>('/auth/register-factory', input);
    setAuthToken(res.user.token);
    await storage.set(TOKEN_KEY, res.user.token);
    setUser(await api.get<AuthUser>('/auth/me'));
  }, []);

  const value = useMemo(() => ({ user, ready, login, registerFactory, logout }), [user, ready, login, registerFactory, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider.');
  return ctx;
}
