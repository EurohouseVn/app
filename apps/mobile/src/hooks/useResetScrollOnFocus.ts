import { useCallback } from 'react';
import type { RefObject } from 'react';
import { Platform, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';

type BrowserGlobal = typeof globalThis & {
  scrollTo?: (x: number, y: number) => void;
};

export function resetScrollToTop(ref: RefObject<ScrollView | null>) {
  ref.current?.scrollTo({ x: 0, y: 0, animated: false });
  if (Platform.OS === 'web') (globalThis as BrowserGlobal).scrollTo?.(0, 0);
}

export function useResetScrollOnFocus(ref: RefObject<ScrollView | null>) {
  useFocusEffect(
    useCallback(() => {
      resetScrollToTop(ref);
      const timer = setTimeout(() => resetScrollToTop(ref), 0);
      return () => clearTimeout(timer);
    }, [ref]),
  );
}
