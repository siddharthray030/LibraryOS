import { createContext, useContext, useEffect, useState } from 'react';
import { subscribeSettings, DEFAULT_SETTINGS } from '../services/settings';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const unsub = subscribeSettings(s => {
      setSettings(s);
      setLoading(false);
    });
    return unsub;
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside <SettingsProvider>');
  return ctx;
}

// Reusable hook alias required by Phase 3 spec
export const useLibrarySettings = useSettings;
