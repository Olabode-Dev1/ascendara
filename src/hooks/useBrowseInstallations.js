import { useEffect, useState } from "react";
import { installedGameIndex } from "@/lib/catalogDiscovery";
import installedGamesService from "@/services/library/installedGamesService";

export default function useBrowseInstallations() {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({
    loading: true,
    error: false,
    index: installedGameIndex([]),
  });
  useEffect(() => {
    let active = true;
    let request = 0;
    const load = async () => {
      const id = ++request;
      setState(previous => ({ ...previous, loading: true, error: false }));
      try {
        const [installed, custom] = await Promise.all([
          window.electron.getGames(),
          window.electron.getCustomGames(),
        ]);
        if (!Array.isArray(installed) || !Array.isArray(custom))
          throw new Error("Invalid library response");
        if (active && request === id)
          setState({
            loading: false,
            error: false,
            index: installedGameIndex([...installed, ...custom]),
          });
      } catch {
        if (active && request === id)
          setState(previous => ({ ...previous, loading: false, error: true }));
      }
    };
    load();
    const unsubscribe = installedGamesService.subscribe(load);
    const unsubscribeComplete = window.electron?.onDownloadComplete?.(load);
    window.addEventListener("focus", load);
    return () => {
      active = false;
      unsubscribe();
      unsubscribeComplete?.();
      window.removeEventListener("focus", load);
    };
  }, [revision]);
  return { ...state, retry: () => setRevision(value => value + 1) };
}
