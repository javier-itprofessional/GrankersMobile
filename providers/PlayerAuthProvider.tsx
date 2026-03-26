import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';

const PLAYER_SESSION_KEY = 'player_session';

export interface PlayerSession {
  id: string;
  name: string;
  email: string;
  country: string;
  authMethod: 'google' | 'email';
  createdAt: string;
}

export const [PlayerAuthContext, usePlayerAuth] = createContextHook(() => {
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    loadSession();
  }, []);

  const loadSession = async () => {
    try {
      console.log('[PlayerAuth] Loading session from storage...');
      const stored = await AsyncStorage.getItem(PLAYER_SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PlayerSession;
        console.log('[PlayerAuth] Session found:', parsed.name, parsed.email);
        setSession(parsed);
      } else {
        console.log('[PlayerAuth] No session found');
      }
    } catch (error) {
      console.error('[PlayerAuth] Error loading session:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveSession = useCallback(async (newSession: PlayerSession) => {
    try {
      console.log('[PlayerAuth] Saving session:', newSession.name);
      await AsyncStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(newSession));
      setSession(newSession);
    } catch (error) {
      console.error('[PlayerAuth] Error saving session:', error);
      throw error;
    }
  }, []);

  const clearSession = useCallback(async () => {
    try {
      console.log('[PlayerAuth] Clearing session');
      await AsyncStorage.removeItem(PLAYER_SESSION_KEY);
      setSession(null);
    } catch (error) {
      console.error('[PlayerAuth] Error clearing session:', error);
    }
  }, []);

  const isAuthenticated = session !== null;

  return {
    session,
    isLoading,
    isAuthenticated,
    saveSession,
    clearSession,
  };
});
