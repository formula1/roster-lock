import { useState, useEffect, useCallback } from 'react';

import { initializeUserDirectories, handleUserChoice as handleUserChoiceAPI } from "./api";

interface UserSettingsState {
  state: "loading" | "expecting-input" | "ready";
  rosterLockDir: string;
}

export const useUserSettings = () => {
  const [state, setState] = useState<UserSettingsState>({
    state: "loading",
    rosterLockDir: '',
  });

  useEffect(() => {
    Promise.resolve().then(async () => {
      try {
        // Initialize user directories and check if dialog should be shown
        const result = await initializeUserDirectories();
        console.log("Initializing User Settings:", result);
        
        if (result.shouldShowDialog) {
          setState({
            state: "expecting-input",
            rosterLockDir: result.rosterLockDir,
          });
        } else {
          setState({
            state: "ready",
            rosterLockDir: result.rosterLockDir,
          });
        }
      } catch (error) {
        console.error('Failed to initialize user settings:', error);
      }
    });
  }, []);

  const handleUserChoice = useCallback(async (choice: 'create' | 'askLater' | 'dontAsk') => {
    try {
      console.log("Handling User Choice:", choice);
      await handleUserChoiceAPI(choice, state.rosterLockDir);
      setState(prev => ({ ...prev, state: "ready" }));
    } catch (error) {
      console.error('Failed to handle user choice:', error);
    }
  }, []);

  return {
    state: state.state,
    rosterLockDir: state.rosterLockDir,
    handleUserChoice,
  };
};
