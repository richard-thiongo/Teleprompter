import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Script {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export interface TeleprompterSettings {
  speed: number;
  fontSize: number;
  isMirrored: boolean;
}

interface ScriptsContextType {
  scripts: Script[];
  activeScriptId: string | null;
  activeScript: Script | null;
  settings: TeleprompterSettings;
  loading: boolean;
  addScript: (title: string, content: string) => Promise<Script>;
  updateScript: (id: string, title: string, content: string) => Promise<void>;
  deleteScript: (id: string) => Promise<void>;
  setActiveScriptId: (id: string | null) => Promise<void>;
  updateSettings: (settings: Partial<TeleprompterSettings>) => Promise<void>;
}

const DEFAULT_SETTINGS: TeleprompterSettings = {
  speed: 3,
  fontSize: 24,
  isMirrored: false,
};

const ScriptsContext = createContext<ScriptsContextType | undefined>(undefined);

const SCRIPTS_KEY = '@teleprompt/scripts';
const ACTIVE_ID_KEY = '@teleprompt/active_script_id';
const SETTINGS_KEY = '@teleprompt/settings';

const DEFAULT_SCRIPTS: Script[] = [
  {
    id: 'demo-1',
    title: 'Welcome to Teleprompt!',
    content: 'This is your new teleprompter app. You can create custom scripts, edit them, and play them directly over the live camera preview. Adjust scroll speed, font size, and text mirroring from the settings panel. Tap play to start scrolling and hit the record button to capture your video!',
    createdAt: Date.now(),
  },
];

export function ScriptsProvider({ children }: { children: React.ReactNode }) {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [activeScriptId, setActiveScriptIdState] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<TeleprompterSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [storedScripts, storedActiveId, storedSettings] = await Promise.all([
        AsyncStorage.getItem(SCRIPTS_KEY),
        AsyncStorage.getItem(ACTIVE_ID_KEY),
        AsyncStorage.getItem(SETTINGS_KEY),
      ]);

      if (storedScripts) {
        setScripts(JSON.parse(storedScripts));
      } else {
        // Seed initial data
        await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(DEFAULT_SCRIPTS));
        setScripts(DEFAULT_SCRIPTS);
      }

      if (storedActiveId) {
        setActiveScriptIdState(storedActiveId);
      } else if (!storedScripts) {
        // Set demo script as active by default if first launch
        setActiveScriptIdState('demo-1');
        await AsyncStorage.setItem(ACTIVE_ID_KEY, 'demo-1');
      }

      if (storedSettings) {
        setSettingsState(JSON.parse(storedSettings));
      }
    } catch (e) {
      console.error('Failed to load teleprompter data', e);
    } finally {
      setLoading(false);
    }
  };

  const addScript = async (title: string, content: string) => {
    const newScript: Script = {
      id: Math.random().toString(36).substring(7),
      title: title.trim() || 'Untitled Script',
      content: content.trim(),
      createdAt: Date.now(),
    };

    const updated = [newScript, ...scripts];
    setScripts(updated);
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(updated));

    // Auto-select if no script is active
    if (!activeScriptId) {
      await setActiveScriptId(newScript.id);
    }

    return newScript;
  };

  const updateScript = async (id: string, title: string, content: string) => {
    const updated = scripts.map((s) =>
      s.id === id ? { ...s, title: title.trim() || 'Untitled Script', content: content.trim() } : s
    );
    setScripts(updated);
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(updated));
  };

  const deleteScript = async (id: string) => {
    const updated = scripts.filter((s) => s.id !== id);
    setScripts(updated);
    await AsyncStorage.setItem(SCRIPTS_KEY, JSON.stringify(updated));

    if (activeScriptId === id) {
      const nextActive = updated.length > 0 ? updated[0].id : null;
      await setActiveScriptId(nextActive);
    }
  };

  const setActiveScriptId = async (id: string | null) => {
    setActiveScriptIdState(id);
    if (id) {
      await AsyncStorage.setItem(ACTIVE_ID_KEY, id);
    } else {
      await AsyncStorage.removeItem(ACTIVE_ID_KEY);
    }
  };

  const updateSettings = async (newSettings: Partial<TeleprompterSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettingsState(updated);
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  };

  const activeScript = scripts.find((s) => s.id === activeScriptId) || null;

  return (
    <ScriptsContext.Provider
      value={{
        scripts,
        activeScriptId,
        activeScript,
        settings,
        loading,
        addScript,
        updateScript,
        deleteScript,
        setActiveScriptId,
        updateSettings,
      }}>
      {children}
    </ScriptsContext.Provider>
  );
}

export function useScripts() {
  const context = useContext(ScriptsContext);
  if (context === undefined) {
    throw new Error('useScripts must be used within a ScriptsProvider');
  }
  return context;
}
