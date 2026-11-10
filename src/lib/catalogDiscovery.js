import { normalizeGameName } from "./libraryGames";

export const catalogGameKey = game =>
  game?.gameID
    ? `id:${game.gameID}`
    : `name:${normalizeGameName(game?.game || game?.name)}`;
export const categoryTags = game => [
  ...new Set(
    (Array.isArray(game?.category) ? game.category : [])
      .filter(tag => typeof tag === "string" && tag.trim())
      .map(tag => tag.trim().toLowerCase())
  ),
];

export function catalogSourceKey(settings = {}) {
  const source = settings.customSourcesMode
    ? `custom:${settings.activeCustomList?.id || settings.customSource?.url || "none"}`
    : `official:${settings.localIndex || "default"}`;
  // Persist a fingerprint, never a private source URL or its query credentials.
  let hash = 14695981039346656037n;
  for (const character of source)
    hash = BigInt.asUintN(64, (hash ^ BigInt(character.codePointAt(0))) * 1099511628211n);
  return `source:${hash.toString(16)}`;
}

export function installedGameIndex(games) {
  const ids = new Set(),
    names = new Set(),
    unnamedIds = new Set();
  for (const game of games) {
    if (
      !game ||
      game._isDeleted ||
      game._isDownloading ||
      game._isQueued ||
      game.downloadingData?.downloading ||
      game.downloadingData?.extracting ||
      game.downloadingData?.verifying ||
      game.downloadingData?.stopped
    )
      continue;
    const name = normalizeGameName(game.game || game.name);
    if (name) names.add(name);
    if (game.gameID) ids.add(String(game.gameID));
    else if (name) unnamedIds.add(name);
  }
  return { ids, names, unnamedIds };
}
export function isCatalogGameInstalled(game, index) {
  const name = normalizeGameName(game.game || game.name);
  return game.gameID
    ? index.ids.has(String(game.gameID)) || index.unnamedIds.has(name)
    : index.names.has(name);
}

export function readBrowseFilters(params) {
  return {
    installed: ["yes", "no"].includes(params.get("installed"))
      ? params.get("installed")
      : "any",
    online: params.get("online") === "1",
    vr: params.get("vr") === "1",
    maxSize: [5, 10, 25, 50, 100].includes(Number(params.get("maxSize")))
      ? Number(params.get("maxSize"))
      : null,
  };
}

export function similarCatalogGames(catalog, current, limit = 8) {
  const tags = new Set(categoryTags(current));
  const seen = new Set([catalogGameKey(current)]);
  return (Array.isArray(catalog) ? catalog : [])
    .filter(game => game && typeof game.game === "string")
    .map(game => ({ game, shared: categoryTags(game).filter(tag => tags.has(tag)) }))
    .filter(entry => entry.shared.length)
    .sort(
      (a, b) =>
        b.shared.length - a.shared.length ||
        (Number(b.game.weight) || 0) - (Number(a.game.weight) || 0) ||
        a.game.game.localeCompare(b.game.game)
    )
    .filter(({ game }) => {
      const key = catalogGameKey(game);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export function resolveViewedGames(catalog, entries) {
  const byKey = new Map(
    (Array.isArray(catalog) ? catalog : [])
      .filter(Boolean)
      .map(game => [catalogGameKey(game), game])
  );
  return entries.map(entry => byKey.get(entry.key)).filter(Boolean);
}
