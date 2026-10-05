import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { SessionRecord } from '../types';
import { Language } from '../i18n';

const USERS_KEY = '@poseperfect/users';
const ACTIVE_USER_KEY = '@poseperfect/active-user';
const LANGUAGE_KEY = '@poseperfect/language';
const LEGACY_MIGRATED_KEY = '@poseperfect/legacy-data-migrated';
const legacyFavoritesKey = '@poseperfect/favorites';
const legacySessionsKey = '@poseperfect/sessions';

export type LocalUser = {
  id: string;
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type AuthResult = { ok: true } | { ok: false; error: 'exists' | 'invalid' | 'storage' };
type AppContextValue = {
  hydrated: boolean;
  favoriteIds: string[];
  sessions: SessionRecord[];
  language: Language;
  currentUser: LocalUser | null;
  toggleFavorite: (poseId: string) => void;
  isFavorite: (poseId: string) => boolean;
  addSession: (session: SessionRecord) => void;
  clearSessions: () => void;
  setLanguage: (language: Language) => void;
  register: (username: string, password: string) => Promise<AuthResult>;
  login: (username: string, password: string) => Promise<AuthResult>;
  updateUsername: (username: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | undefined>(undefined);

function userFavoritesKey(id: string) { return `@poseperfect/user/${id}/favorites`; }
function userSessionsKey(id: string) { return `@poseperfect/user/${id}/sessions`; }
async function digestPassword(password: string, salt: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);
}
function makeSalt() { return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }
function makeId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`; }

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [language, setLanguageState] = useState<Language>('en');
  const [currentUser, setCurrentUser] = useState<LocalUser | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const loadUserData = async (userId: string, migrateLegacy = false) => {
    const [favRaw, sessionRaw] = await Promise.all([
      AsyncStorage.getItem(userFavoritesKey(userId)),
      AsyncStorage.getItem(userSessionsKey(userId)),
    ]);
    let fav = favRaw ? JSON.parse(favRaw) : [];
    let sessionsData = sessionRaw ? JSON.parse(sessionRaw) : [];

    if (migrateLegacy && !favRaw && !sessionRaw) {
      const migrated = await AsyncStorage.getItem(LEGACY_MIGRATED_KEY);
      if (!migrated) {
        const [legacyFav, legacySessions] = await Promise.all([
          AsyncStorage.getItem(legacyFavoritesKey),
          AsyncStorage.getItem(legacySessionsKey),
        ]);
        fav = legacyFav ? JSON.parse(legacyFav) : [];
        sessionsData = legacySessions ? JSON.parse(legacySessions) : [];
        await AsyncStorage.setItem(LEGACY_MIGRATED_KEY, '1');
      }
    }
    setFavoriteIds(Array.isArray(fav) ? fav : []);
    setSessions(Array.isArray(sessionsData) ? sessionsData : []);
  };

  useEffect(() => {
    (async () => {
      try {
        const [savedLanguage, usersRaw, activeRaw] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_KEY),
          AsyncStorage.getItem(USERS_KEY),
          AsyncStorage.getItem(ACTIVE_USER_KEY),
        ]);
        if (savedLanguage === 'hi' || savedLanguage === 'en') setLanguageState(savedLanguage);
        if (usersRaw && activeRaw) {
          const users = JSON.parse(usersRaw) as LocalUser[];
          const active = users.find(user => user.id === activeRaw) ?? null;
          if (active) {
            setCurrentUser(active);
            await loadUserData(active.id);
          }
        }
      } catch (error) {
        console.warn('Could not restore local app data', error);
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  const toggleFavorite = (poseId: string) => {
    if (!currentUser) return;
    setFavoriteIds(current => {
      const next = current.includes(poseId) ? current.filter(id => id !== poseId) : [...current, poseId];
      AsyncStorage.setItem(userFavoritesKey(currentUser.id), JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const addSession = (session: SessionRecord) => {
    if (!currentUser) return;
    setSessions(current => {
      const next = [session, ...current].slice(0, 100);
      AsyncStorage.setItem(userSessionsKey(currentUser.id), JSON.stringify(next)).catch(() => {});
      return next;
    });
  };

  const clearSessions = () => {
    if (!currentUser) return;
    setSessions([]);
    AsyncStorage.removeItem(userSessionsKey(currentUser.id)).catch(() => {});
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.removeItem(`poseperfect-realtime-attempts-v6:${currentUser.id}`);
      } catch {}
    }
  };

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(LANGUAGE_KEY, next).catch(() => {});
  };

  const register = async (username: string, password: string): Promise<AuthResult> => {
    try {
      const usersRaw = await AsyncStorage.getItem(USERS_KEY);
      const users = usersRaw ? (JSON.parse(usersRaw) as LocalUser[]) : [];
      const normalized = username.trim().toLowerCase();
      if (users.some(user => user.username === normalized)) return { ok: false, error: 'exists' };
      const salt = makeSalt();
      const passwordHash = await digestPassword(password, salt);
      const user: LocalUser = { id: makeId(), username: normalized, passwordHash, salt, createdAt: new Date().toISOString() };
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify([...users, user]));
      await AsyncStorage.setItem(ACTIVE_USER_KEY, user.id);
      setCurrentUser(user);
      await loadUserData(user.id, true);
      return { ok: true };
    } catch { return { ok: false, error: 'storage' }; }
  };

  const login = async (username: string, password: string): Promise<AuthResult> => {
    try {
      const usersRaw = await AsyncStorage.getItem(USERS_KEY);
      const users = usersRaw ? (JSON.parse(usersRaw) as LocalUser[]) : [];
      const user = users.find(item => item.username === username.trim().toLowerCase());
      if (!user) return { ok: false, error: 'invalid' };
      const passwordHash = await digestPassword(password, user.salt);
      if (passwordHash !== user.passwordHash) return { ok: false, error: 'invalid' };
      await AsyncStorage.setItem(ACTIVE_USER_KEY, user.id);
      setCurrentUser(user);
      await loadUserData(user.id);
      return { ok: true };
    } catch { return { ok: false, error: 'storage' }; }
  };

  const updateUsername = async (username: string): Promise<AuthResult> => {
    if (!currentUser) return { ok: false, error: 'invalid' };
    const normalized = username.trim().toLowerCase();
    if (normalized.length < 3) return { ok: false, error: 'invalid' };
    try {
      const usersRaw = await AsyncStorage.getItem(USERS_KEY);
      const users = usersRaw ? (JSON.parse(usersRaw) as LocalUser[]) : [];
      if (users.some(user => user.id !== currentUser.id && user.username === normalized)) return { ok: false, error: 'exists' };
      const updated = { ...currentUser, username: normalized };
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users.map(user => user.id === updated.id ? updated : user)));
      setCurrentUser(updated);
      return { ok: true };
    } catch { return { ok: false, error: 'storage' }; }
  };

  const logout = async () => {
    await AsyncStorage.removeItem(ACTIVE_USER_KEY).catch(() => {});
    setCurrentUser(null);
    setFavoriteIds([]);
    setSessions([]);
  };

  const value = useMemo(() => ({
    hydrated, favoriteIds, sessions, language, currentUser,
    toggleFavorite, isFavorite: (poseId: string) => favoriteIds.includes(poseId),
    addSession, clearSessions, setLanguage, register, login, updateUsername, logout,
  }), [hydrated, favoriteIds, sessions, language, currentUser]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}
