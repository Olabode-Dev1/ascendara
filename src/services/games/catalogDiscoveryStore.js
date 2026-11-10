import { catalogGameKey } from "../../lib/catalogDiscovery";
import { POPULAR_CATEGORIES } from "../../lib/catalogBrowse";

const KEY = "catalog-discovery-v1";
const EMPTY = { version: 1, pins: [], recent: {} };
let lastRaw,
  snapshot = EMPTY;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());

export function readDiscovery() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return snapshot;
  }
  if (raw === lastRaw) return snapshot;
  lastRaw = raw;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1) throw new Error("Unsupported preferences");
    const pins = [...new Set(Array.isArray(data.pins) ? data.pins : [])].filter(pin =>
      POPULAR_CATEGORIES.includes(pin)
    );
    const recent = {};
    for (const [source, entries] of Object.entries(data.recent || {}).slice(-8)) {
      if (!/^source:[a-f0-9]+$/.test(source) || !Array.isArray(entries)) continue;
      const seen = new Set();
      recent[source] = entries
        .filter(
          entry =>
            entry &&
            typeof entry.key === "string" &&
            typeof entry.title === "string" &&
            Number.isFinite(entry.viewedAt)
        )
        .sort((a, b) => b.viewedAt - a.viewedAt)
        .filter(entry => {
          if (seen.has(entry.key)) return false;
          seen.add(entry.key);
          return true;
        })
        .slice(0, 24)
        .map(({ key, title, viewedAt }) => ({ key, title, viewedAt }));
    }
    snapshot = { version: 1, pins, recent };
  } catch {
    snapshot = EMPTY;
  }
  return snapshot;
}
function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    lastRaw = undefined;
    readDiscovery();
    emit();
    return true;
  } catch {
    return false;
  }
}
export function subscribeDiscovery(listener) {
  listeners.add(listener);
  const changed = event => {
    if (event.key === KEY || event.key === null) {
      lastRaw = undefined;
      emit();
    }
  };
  window.addEventListener("storage", changed);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", changed);
  };
}
export function toggleCategoryPin(category) {
  if (!POPULAR_CATEGORIES.includes(category)) return false;
  const data = readDiscovery();
  return save({
    ...data,
    pins: data.pins.includes(category)
      ? data.pins.filter(pin => pin !== category)
      : [...data.pins, category],
  });
}
export function moveCategoryPin(category, delta) {
  const data = readDiscovery(),
    pins = data.pins.slice(),
    index = pins.indexOf(category),
    target = index + delta;
  if (![-1, 1].includes(delta) || index < 0 || target < 0 || target >= pins.length)
    return false;
  [pins[index], pins[target]] = [pins[target], pins[index]];
  return save({ ...data, pins });
}
export function recordViewedGame(source, game, now = Date.now()) {
  if (
    !/^source:[a-f0-9]+$/.test(source) ||
    !game?.game ||
    game.privateSource ||
    String(game.gameID || "").startsWith("private-")
  )
    return false;
  const data = readDiscovery(),
    key = catalogGameKey(game);
  const existing = data.recent[source] || [];
  // Strict Mode and metadata refreshes must not count a single page entry twice.
  if (existing[0]?.key === key && now - existing[0].viewedAt < 1000) return true;
  const entries = [
    { key, title: game.game, viewedAt: now },
    ...existing.filter(entry => entry.key !== key),
  ].slice(0, 24);
  const recent = Object.fromEntries(
    [
      ...Object.entries(data.recent).filter(([id]) => id !== source),
      [source, entries],
    ].slice(-8)
  );
  return save({ ...data, recent });
}
export function removeViewedGame(source, key) {
  const data = readDiscovery();
  return save({
    ...data,
    recent: {
      ...data.recent,
      [source]: key ? (data.recent[source] || []).filter(entry => entry.key !== key) : [],
    },
  });
}
