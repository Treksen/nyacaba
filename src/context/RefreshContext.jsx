import { createContext, useCallback, useContext, useRef, useState } from 'react';

/**
 * RefreshContext — lets any page register its data-reload function so the
 * global Topbar refresh button can silently re-fetch without a hard reload.
 *
 * Usage in a page:
 *   const { setRefresher } = useRefresh();
 *   useEffect(() => {
 *     setRefresher(() => load);          // register on mount
 *     return () => setRefresher(null);   // unregister on unmount
 *   }, [load]);                          // re-register if load changes
 *
 * The `load` function is the page's existing async function that fetches
 * data and calls its setState setters. Nothing else needs to change.
 */

const RefreshContext = createContext(null);

export function RefreshProvider({ children }) {
  // Store the current page's refresh function in a ref (not state) so
  // updating it doesn't cause unnecessary re-renders of every consumer.
  const refresherRef = useRef(null);
  const [refreshing, setRefreshing] = useState(false);

  const setRefresher = useCallback((fn) => {
    // fn is either a function or null (on page unmount)
    refresherRef.current = fn ?? null;
  }, []);

  const triggerRefresh = useCallback(async () => {
    if (!refresherRef.current || refreshing) return;
    setRefreshing(true);
    try {
      await refresherRef.current();
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  return (
    <RefreshContext.Provider value={{ setRefresher, triggerRefresh, refreshing }}>
      {children}
    </RefreshContext.Provider>
  );
}

export function useRefresh() {
  const ctx = useContext(RefreshContext);
  if (!ctx) throw new Error('useRefresh must be used within a RefreshProvider');
  return ctx;
}
