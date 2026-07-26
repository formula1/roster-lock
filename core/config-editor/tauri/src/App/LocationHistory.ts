
import { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate, useNavigationType, Location } from 'react-router-dom';

type LocationPoint = Pick<Location, "pathname" | "search" | "hash" | "state">;

export function useVirtualHistory() {
  const navigate = useNavigate();
  const location = useLocation();
  const [index, setIndex] = useState(0);
  const usingQuickNav = useRef(false);
  
  // Persistent refs to track the history session
  const historyStack = useRef<Array<LocationPoint>>([locationToPoint(location)]);

  useEffect(() => {
    if(usingQuickNav.current){
      usingQuickNav.current = false;
      return;
    }
    const history = historyStack.current.slice(0, index + 1);
    history.push(locationToPoint(location))
    historyStack.current = history
    setIndex(history.length - 1);
  }, [location]);

  return {
    canGoBack: index > 0,
    canGoForward: index < historyStack.current.length - 1,
    goBack: () =>{
      if(index === 0) return;
      const newIndex = index - 1;
      const location = historyStack.current.at(newIndex);
      if(!location) return;
      usingQuickNav.current = true;
      setIndex(newIndex);
      navigate(location);
    },
    goForward: ()=>{
      if(index === historyStack.current.length - 1) return;
      const newIndex = index + 1;
      const location = historyStack.current.at(newIndex);
      if(!location) return;
      usingQuickNav.current = true;
      setIndex(newIndex);
      navigate(location);
    }
  };
}

function locationToPoint(location: Location): LocationPoint{
  return {
    pathname: location.pathname,
    search: location.search,
    hash: location.hash,
    state: location.state
  };
}

// const navigation = (typeof window.navigation !== "undefined" ? window.navigation : null );
const navigation: null | { canGoBack?: boolean, canGoForward?: boolean } = null;

export function useNativeHistory(){
  const navigate = useNavigate();
  const navtype = useNavigationType();
  const location = useLocation()
  const history = useRef([location.key])
  const indexRef = useRef(0);

  const [index, setIndex] = useState(0);

  useEffect(()=>{
    const currentIndex = indexRef.current
    if(navtype === "PUSH"){
      const newHistory = history.current.slice(0, currentIndex + 1);
      newHistory.push(location.key)
      history.current = newHistory
      indexRef.current = newHistory.length - 1
    } else if(navtype === "REPLACE"){
      history.current[currentIndex] = location.key
    } else if(navtype === "POP"){
      const foundIndex = history.current.indexOf(location.key);
      if(foundIndex !== -1) {
        indexRef.current = foundIndex;
      } else {
        // Edge case: If we don't recognize the key (e.g. initial load 
        // or deep linking), reset stack to this page.
        history.current = [location.key];
        indexRef.current = 0
      }
    }
    setIndex(indexRef.current);
  }, [location.key, navtype])

  const canGoBack = (
    (navigation && navigation?.canGoBack) ?? index > 0
  );
  const canGoForward = (
    (navigation && navigation?.canGoForward) ?? index < history.current.length - 1
  )

  return {
    canGoBack,
    canGoForward,
    goBack: () =>{
      navigate(-1);
    },
    goForward: ()=>{
      navigate(1);
    },
    currentIndex: index,
    stack: history.current
  };
}
