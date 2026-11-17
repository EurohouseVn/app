import { useCallback } from 'react';
import type { RefObject } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

type BrowserGlobal = typeof globalThis & {
  scrollTo?: (x: number, y: number) => void;
};

// ScrollView exposes scrollTo; FlatList/SectionList expose scrollToOffset.
type Scrollable = {
  scrollTo?: (options: { x: number; y: number; animated: boolean }) => void;
  scrollToOffset?: (options: { offset: number; animated: boolean }) => void;
};

export function resetScrollToTop(ref: RefObject<unknown>) {
  const node = ref.current as Scrollable | null;
  if (node?.scrollTo) node.scrollTo({ x: 0, y: 0, animated: false });
  else node?.scrollToOffset?.({ offset: 0, animated: false });
  if (Platform.OS === 'web') (globalThis as BrowserGlobal).scrollTo?.(0, 0);
}

export function useResetScrollOnFocus(ref: RefObject<unknown>) {
  useFocusEffect(
    useCallback(() => {
      resetScrollToTop(ref);
      const timer = setTimeout(() => resetScrollToTop(ref), 0);
      return () => clearTimeout(timer);
    }, [ref]),
  );
}
