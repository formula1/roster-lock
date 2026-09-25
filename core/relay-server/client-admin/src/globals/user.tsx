import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import { RELAY_API } from "./api";

type UserContextType = {
  user: null | { username: string; passwordExpired: boolean; token: string };
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
};

export const UserContext = createContext<UserContextType>({
  user: null,
  login: async () => {},
  logout: () => {},
});

export const useUser = () => {
  return useContext(UserContext);
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = (
  { children }
) => {
  const [user, setUser] = useState<UserContextType['user']>(null);

  const login = useCallback(async (username: string, password: string) => {
    const response = await RELAY_API.auth.login({ username, password });
    setUser({ username, passwordExpired: response.passwordExpired, token: response.token });
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    if(!user){
      localStorage.removeItem('currentUser');
      return;
    }
    localStorage.setItem('currentUser', JSON.stringify(user));
    const to = setTimeout(async ()=>{
      const response = await RELAY_API.auth.refresh({ authToken: user.token });
      setUser({ ...user, token: response.token });
    }, 60 * 60 * 1000)
    return () => clearTimeout(to);
  }, [user]);

  return <UserContext.Provider value={{ user, login, logout }}>{children}</UserContext.Provider>;
};


