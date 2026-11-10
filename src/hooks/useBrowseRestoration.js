import { useCallback, useEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { catalogGameKey } from "@/lib/catalogDiscovery";

const positions = new Map();
export default function useBrowseRestoration({
  root,
  source,
  ready,
  results,
  count,
  ensureCount,
  signature,
}) {
  const location = useLocation();
  const navigation = useNavigationType();
  const key = `${source}:${location.key}:${signature}`;
  const interrupted = useRef(false);
  useEffect(() => {
    interrupted.current = false;
    const cancel = () => {
      interrupted.current = true;
    };
    const keyInput = event => {
      if (
        ["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(
          event.key
        )
      )
        cancel();
    };
    window.addEventListener("wheel", cancel, { passive: true });
    window.addEventListener("touchmove", cancel, { passive: true });
    window.addEventListener("keydown", keyInput);
    return () => {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchmove", cancel);
      window.removeEventListener("keydown", keyInput);
    };
  }, [key]);
  const save = useCallback(
    game => {
      const node = root.current;
      if (!node) return;
      const anchor = game
        ? catalogGameKey(game)
        : document.activeElement?.dataset?.catalogKey;
      const element = [...node.querySelectorAll("[data-catalog-key]")].find(
        item => item.dataset.catalogKey === anchor
      );
      positions.delete(key);
      positions.set(key, {
        anchor,
        offset: element?.getBoundingClientRect().top,
        windowTop: window.scrollY,
        mainTop: node.closest("main")?.scrollTop || 0,
      });
      while (positions.size > 30) positions.delete(positions.keys().next().value);
    },
    [root, key]
  );
  useEffect(() => {
    if (!ready || navigation !== "POP" || interrupted.current) return;
    const position = positions.get(key);
    if (!position) return;
    const index = results.findIndex(game => catalogGameKey(game) === position.anchor);
    if (index >= count) {
      ensureCount(Math.ceil((index + 1) / 48) * 48);
      return;
    }
    let cancelled = false,
      frame;
    // Restore after route transition and the result layout have settled.
    const started = performance.now();
    const restore = () => {
      if (cancelled || interrupted.current) return;
      if (performance.now() - started < 400) {
        frame = requestAnimationFrame(restore);
        return;
      }
      const node = root.current;
      if (!node) return;
      const main = node.closest("main");
      const anchor = [...node.querySelectorAll("[data-catalog-key]")].find(
        item => item.dataset.catalogKey === position.anchor
      );
      if (main) main.scrollTop = position.mainTop;
      window.scrollTo(0, position.windowTop);
      if (anchor) {
        anchor.focus({ preventScroll: true });
        const delta = anchor.getBoundingClientRect().top - (position.offset || 0);
        const mainScrolls =
          main && main.scrollHeight > main.clientHeight && main.clientHeight > 0;
        if (mainScrolls) main.scrollTop += delta;
        else window.scrollTo(0, window.scrollY + delta);
      }
    };
    frame = requestAnimationFrame(restore);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [root, key, ready, navigation, results, count, ensureCount]);
  return save;
}
