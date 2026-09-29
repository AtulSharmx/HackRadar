import { createContext, createElement, useContext, useState } from 'react';

import { DEFAULT_PREFS } from './prefs';

// Onboarding answers, held in memory until the last step saves them (App Flow: Finish).
const DraftContext = createContext(null);

export function DraftProvider({ children }) {
  const [draft, setDraft] = useState(DEFAULT_PREFS);
  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));
  return createElement(DraftContext.Provider, { value: { draft, update } }, children);
}

export function useDraft() {
  return useContext(DraftContext);
}
