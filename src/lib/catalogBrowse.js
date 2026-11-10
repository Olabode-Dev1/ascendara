export const POPULAR_CATEGORIES = [
  "Action",
  "Adventure",
  "Survival",
  "Simulation",
  "Strategy",
  "Sports",
];
export const BROWSE_SECTIONS = ["top", "updated", "online", "action"];
const normalize = value => (typeof value === "string" ? value.trim().toLowerCase() : "");
const weight = game => Number.parseInt(game.weight, 10) || 0;
const updated = game => Date.parse(game.latest_update) || 0;
const tags = game => (Array.isArray(game.category) ? game.category.map(normalize) : []);

// Full catalog selections deliberately have no preview cap or cross-shelf exclusion.
export function selectCatalogGames(catalog, { category, section } = {}) {
  const games = Array.isArray(catalog)
    ? catalog.filter(game => game && typeof game.game === "string")
    : [];
  const custom = games.some(game => game.customSource);
  let matches;
  if (normalize(category)) {
    matches = games.filter(game => tags(game).includes(normalize(category)));
  } else {
    switch (section) {
      case "top":
        matches = custom ? games.slice() : games.filter(game => weight(game) > 30);
        break;
      case "updated":
        matches = games.filter(game => updated(game) > 0);
        break;
      case "online":
        matches = games.filter(game => game.online);
        break;
      case "action":
        matches = games.filter(game =>
          tags(game).some(tag =>
            ["action", "adventure", "fighting", "shooter"].includes(tag)
          )
        );
        break;
      default:
        return [];
    }
  }
  if (section === "updated" && !category)
    return matches.sort((a, b) => updated(b) - updated(a));
  // Custom sources do not supply popularity: preserve their source ordering.
  return custom ? matches : matches.sort((a, b) => weight(b) - weight(a));
}

export function buildCategoryPreviews(catalog) {
  return Object.fromEntries(
    POPULAR_CATEGORIES.flatMap(category => {
      const games = selectCatalogGames(catalog, { category });
      return games.length
        ? [[category, { total: games.length, preview: games.slice(0, 4) }]]
        : [];
    })
  );
}

export function filterBrowseGames(
  games,
  query = "",
  sort = "default",
  predicate = () => true
) {
  const search = normalize(query);
  const result = games.filter(
    game => normalize(game.game).includes(search) && predicate(game)
  );
  if (sort === "name") result.sort((a, b) => a.game.localeCompare(b.game));
  if (sort === "updated") result.sort((a, b) => updated(b) - updated(a));
  return result;
}
