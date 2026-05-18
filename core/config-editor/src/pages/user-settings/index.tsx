import React, { useState, useEffect } from 'react';

import { useUserSettings } from "./hooks";
import { useNavigate } from 'react-router-dom';

interface UserSettingsDialogProps {
  onSelect?: ()=>any;
}

export const UserSettingsDialog: React.FC<UserSettingsDialogProps> = (
  { onSelect }
) => {
  console.log('🔧 UserSettingsDialog component loaded - testing console.log output');
  const { state, matchLockDir, handleUserChoice } = useUserSettings();

  useEffect(()=>{
    if(state === "ready" && onSelect){
      onSelect();
    }
  }, [state, onSelect])

  if(state === "loading") return <h1>Loading User Settings...</h1>;

  if(state === "ready") return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center mb-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">First Time Setup</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-700 mb-4">
            Welcome to MatchLock Prep App!
          </p>
          <p className="text-gray-700 mb-4">
            This app would like to create a folder at:
          </p>
          <div className="bg-gray-100 p-3 rounded-md font-mono text-sm text-gray-800 mb-4">
            {matchLockDir}
          </div>
          <p className="text-gray-600 text-sm">
            This folder will be used to store your MatchLock configurations and data. 
            You can change this location later in settings.
          </p>
        </div>

        <div className="flex flex-col space-y-3">
          <button
            onClick={() => handleUserChoice('create')}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
          >
            Create Folder
          </button>
          <button
            onClick={() => handleUserChoice('askLater')}
            className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300 transition-colors"
          >
            Ask Me Later
          </button>
          <button
            onClick={() => handleUserChoice('dontAsk')}
            className="w-full text-gray-600 py-2 px-4 rounded-md hover:bg-gray-100 transition-colors text-sm"
          >
            Don't Ask Again
          </button>
        </div>
      </div>
    </div>
  );
};
