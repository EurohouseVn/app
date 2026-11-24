import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  AccessTier,
  AuthUser,
  LoginResponse,
  RegisterFactoryInput,
  RegisterWorkshopInput,
  VerificationConfirmInput,
  WorkshopRegistrationResponse,
} from '@eurohouse/types';
import { api, setAuthToken, setUnauthorizedHandler } from './api';
import { configureLocalProjectsStorage } from './localProjects';
import { getInstallationIdentity } from './installationIdentity';
import {
  guestScopeForInstallation,
  importGuestStoragePayload,
  migrateGuestData,
  readGuestStoragePayload,
  type GuestMigrationResult,
} from './guestDataMigration';
import { loadGuestMode, persistGuestMode, sessionTierFor } from './sessionTier';

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

export interface PhoneRegistrationInput { organizationName: string; address: string; phone: string; password: string }

interface AuthContextValue {
  user: AuthUser | null;
  ready: boolean;
  sessionTier: AccessTier | null;
  login: (identifier: string, password: string) => Promise<void>;
  registerFactory: (input: RegisterFactoryInput) => Promise<void>;
  registerWorkshop: (input: RegisterWorkshopInput) => Promise<WorkshopRegistrationResponse>;
  registerWorkshopByPhone: (input: PhoneRegistrationInput) => Promise<void>;
  confirmVerification: (input: VerificationConfirmInput) => Promise<void>;
  resendVerification: (pendingVerificationId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  leaveGuestMode: () => Promise<void>;
  upgradeGuestData: (userId: string) => Promise<GuestMigrationResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const logout = useCallback(() => {
    setAuthToken(null);
    void configureLocalProjectsStorage(null);
    setUser(null);
    setGuestMode(false);
    void persistGuestMode(AsyncStorage, false);
    void storage.remove(TOKEN_KEY);
  }, []);

  const upgradeGuestData = useCallback(async (userId: string): Promise<GuestMigrationResult> => {
    const installationId = await getInstallationIdentity(AsyncStorage);
    const payload = await readGuestStoragePayload(AsyncStorage, installationId);
    return migrateGuestData({
      installationId,
      targetUserId: userId,
      payload,
      storage: AsyncStorage,
      importData: (guestPayload) => importGuestStoragePayload(AsyncStorage, userId, guestPayload),
    });
  }, []);

  const continueAsGuest = useCallback(async () => {
    setAuthToken(null);
    await storage.remove(TOKEN_KEY);
    const installationId = await getInstallationIdentity(AsyncStorage);
    await persistGuestMode(AsyncStorage, true);
    await configureLocalProjectsStorage(guestScopeForInstallation(installationId));
    setUser(null);
    setGuestMode(true);
  }, []);

  const leaveGuestMode = useCallback(async () => {
    await persistGuestMode(AsyncStorage, false);
    await configureLocalProjectsStorage(null);
    setGuestMode(false);
  }, []);

  // Khôi phục phiên từ token đã lưu khi mở app.
  useEffect(() => {
    setUnauthorizedHandler(logout);
    (async () => {
      try {
        const token = await storage.get(TOKEN_KEY);
        if (token) {
          setAuthToken(token);
          const authenticatedUser = await api.get<AuthUser>('/auth/me');
          await upgradeGuestData(authenticatedUser.id);
          await configureLocalProjectsStorage(authenticatedUser.id);
          setUser(authenticatedUser);
        } else if (await loadGuestMode(AsyncStorage)) {
          const installationId = await getInstallationIdentity(AsyncStorage);
          await configureLocalProjectsStorage(guestScopeForInstallation(installationId));
          setGuestMode(true);
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
  }, [logout, upgradeGuestData]);

  const establishSession = useCallback(async (res: LoginResponse) => {
    setAuthToken(res.user.token);
    await storage.set(TOKEN_KEY, res.user.token);
    const authenticatedUser = await api.get<AuthUser>('/auth/me');
    await upgradeGuestData(authenticatedUser.id);
    await persistGuestMode(AsyncStorage, false);
    await configureLocalProjectsStorage(authenticatedUser.id);
    setGuestMode(false);
    setUser(authenticatedUser);
  }, [upgradeGuestData]);

  const refreshUser = useCallback(async () => {
    const authenticatedUser = await api.get<AuthUser>('/auth/me');
    await configureLocalProjectsStorage(authenticatedUser.id);
    setUser(authenticatedUser);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const res = await api.post<LoginResponse>('/auth/login', { identifier, password });
    await establishSession(res);
  }, [establishSession]);

  const registerWorkshop = useCallback((input: RegisterWorkshopInput) =>
    api.post<WorkshopRegistrationResponse>('/auth/register-workshop', input), []);

  // Đăng ký bằng số điện thoại, không cần xác minh: máy chủ trả phiên đăng nhập ngay.
  const registerWorkshopByPhone = useCallback(async (input: PhoneRegistrationInput) => {
    const res = await api.post<LoginResponse>('/auth/register-workshop-phone', input);
    await establishSession(res);
  }, [establishSession]);

  const registerFactory = useCallback(async (input: RegisterFactoryInput) => {
    const res = await api.post<LoginResponse>('/auth/register-factory', input);
    await establishSession(res);
  }, [establishSession]);

  const confirmVerification = useCallback(async (input: VerificationConfirmInput) => {
    const res = await api.post<LoginResponse>('/auth/verification/confirm', input);
    await establishSession(res);
  }, [establishSession]);

  const resendVerification = useCallback(async (pendingVerificationId: string) => {
    await api.post('/auth/verification/resend', { pendingVerificationId });
  }, []);

  const value = useMemo(() => ({
    user,
    ready,
    sessionTier: sessionTierFor(user, guestMode),
    login,
    registerFactory,
    registerWorkshop,
    registerWorkshopByPhone,
    confirmVerification,
    resendVerification,
    refreshUser,
    continueAsGuest,
    leaveGuestMode,
    upgradeGuestData,
    logout,
  }), [user, ready, guestMode, login, registerFactory, registerWorkshop, registerWorkshopByPhone, confirmVerification, resendVerification, refreshUser, continueAsGuest, leaveGuestMode, upgradeGuestData, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng bên trong AuthProvider.');
  return ctx;
}
