import { createContext, useContext, useState, ReactNode } from 'react';

interface UserKeys {
  publicKey: string;
  privateKey: string;
}

interface MatchInfo {
  roomId: string;
  url: string;
}

interface GameContextType {
  userId: string;
  displayName: string;
  userKeys: UserKeys | null;
  matchInfo: MatchInfo | null;
  selectedCharacter: string | null;
  selectedStage: string | null;
  setUserId: (id: string) => void;
  setDisplayName: (name: string) => void;
  setUserKeys: (keys: UserKeys) => void;
  setMatchInfo: (info: MatchInfo) => void;
  setSelectedCharacter: (character: string) => void;
  setSelectedStage: (stage: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [userKeys, setUserKeys] = useState<UserKeys | null>(null);
  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);

  return (
    <GameContext.Provider
      value={{
        userId,
        displayName,
        userKeys,
        matchInfo,
        selectedCharacter,
        selectedStage,
        setUserId,
        setDisplayName,
        setUserKeys,
        setMatchInfo,
        setSelectedCharacter,
        setSelectedStage,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}

