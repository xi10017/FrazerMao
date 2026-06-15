'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useFirestore } from '@/firebase';
import type { AnswerKeyOverrides } from '@/lib/test-logic';
import { fetchAllAnswerKeyOverrides } from '@/lib/answer-key-reports';

type AnswerKeyOverridesContextValue = {
  overridesByTestId: Record<string, AnswerKeyOverrides>;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const AnswerKeyOverridesContext =
  createContext<AnswerKeyOverridesContextValue>({
    overridesByTestId: {},
    isLoading: true,
    refresh: async () => {},
  });

export function AnswerKeyOverridesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const firestore = useFirestore();
  const [overridesByTestId, setOverridesByTestId] = useState<
    Record<string, AnswerKeyOverrides>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!firestore) {
      setOverridesByTestId({});
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const all = await fetchAllAnswerKeyOverrides(firestore);
      setOverridesByTestId(all);
    } catch (error) {
      const code = (error as { code?: string })?.code;
      if (code !== 'permission-denied') {
        console.error('Failed to load answer key overrides:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [firestore]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AnswerKeyOverridesContext.Provider
      value={{ overridesByTestId, isLoading, refresh }}
    >
      {children}
    </AnswerKeyOverridesContext.Provider>
  );
}

const EMPTY_OVERRIDES: AnswerKeyOverrides = {};

export function useAnswerKeyOverridesForTest(
  testId: string | undefined
): AnswerKeyOverrides {
  const { overridesByTestId } = useContext(AnswerKeyOverridesContext);
  if (!testId) return EMPTY_OVERRIDES;
  return overridesByTestId[testId] ?? EMPTY_OVERRIDES;
}

export function useAnswerKeyOverridesContext() {
  return useContext(AnswerKeyOverridesContext);
}
