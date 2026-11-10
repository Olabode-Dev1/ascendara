const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule } = require("./helpers/loadModule.cjs");
const load = () => loadModule("src/lib/catalogBrowse.js");

const catalog = () =>
  Array.from({ length: 125 }, (_, index) => ({
    game: `Game ${String(index).padStart(3, "0")}`,
    gameID: `id-${index}`,
    category: ["Action", "Adventure"],
    weight: index,
    online: true,
    latest_update: "2026-01-01",
  }));

test("categories expose all 125 matches, independent counts and four-image previews", async () => {
  const { selectCatalogGames, buildCategoryPreviews } = await load();
  const games = catalog();
  const original = structuredClone(games);
  const previews = buildCategoryPreviews(games);
  assert.equal(previews.Action.total, 125);
  assert.equal(previews.Adventure.total, 125);
  assert.equal(previews.Action.preview.length, 4);
  assert.equal(selectCatalogGames(games, { category: "Action" }).length, 125);
  assert.ok(selectCatalogGames(games, { category: "Action" }).includes(games[0]));
  assert.deepEqual(games, original);
});

test("category normalization tolerates missing and malformed metadata without inventing tags", async () => {
  const { selectCatalogGames, buildCategoryPreviews } = await load();
  const games = [
    null,
    {},
    { game: "Missing" },
    { game: "String", category: "Action" },
    { game: "Match", category: [null, 7, " ACTION "] },
    { game: "Near", category: ["Action RPG"] },
  ];
  assert.deepEqual(
    selectCatalogGames(games, { category: " action " }).map(game => game.game),
    ["Match"]
  );
  assert.equal(buildCategoryPreviews(games).Action.total, 1);
  assert.deepEqual(selectCatalogGames(null, { section: "top" }), []);
  assert.deepEqual(selectCatalogGames(games, { section: "invalid" }), []);
});

test("full shelves have no 100-game cap or exclusions between shelves", async () => {
  const { selectCatalogGames } = await load();
  const games = catalog().map(game => ({ ...game, weight: 40 }));
  for (const section of ["top", "updated", "online", "action"]) {
    assert.equal(selectCatalogGames(games, { section }).length, 125);
  }
  assert.equal(
    selectCatalogGames([{ game: "Shooter", category: ["Shooter"] }], {
      section: "action",
    }).length,
    1
  );
  assert.equal(
    selectCatalogGames([{ game: "Shooter", category: ["Shooter"] }], {
      category: "Action",
    }).length,
    0
  );
});

test("section predicates and ordering preserve popularity and valid update dates", async () => {
  const { selectCatalogGames } = await load();
  const games = [
    { game: "Low", weight: 30, latest_update: "invalid" },
    { game: "Popular", weight: 90, latest_update: "2025-01-01", online: true },
    { game: "New", weight: 40, latest_update: "2026-01-01" },
  ];
  assert.deepEqual(
    selectCatalogGames(games, { section: "top" }).map(game => game.game),
    ["Popular", "New"]
  );
  assert.deepEqual(
    selectCatalogGames(games, { section: "updated" }).map(game => game.game),
    ["New", "Popular"]
  );
  assert.deepEqual(
    selectCatalogGames(games, { section: "online" }).map(game => game.game),
    ["Popular"]
  );
});

test("custom sources retain useful top/update fallbacks without invented categories", async () => {
  const { selectCatalogGames, buildCategoryPreviews } = await load();
  const games = [
    { game: "Undated", customSource: "source" },
    { game: "Dated", customSource: "source", latest_update: "2026-01-01" },
  ];
  assert.deepEqual(selectCatalogGames(games, { section: "top" }), games);
  assert.deepEqual(selectCatalogGames(games, { section: "updated" }), [games[1]]);
  assert.deepEqual(buildCategoryPreviews(games), {});
});

test("query and sort operate on the full selection without mutation", async () => {
  const { filterBrowseGames, selectCatalogGames } = await load();
  const games = selectCatalogGames(catalog(), { category: "Action" });
  const original = games.slice();
  assert.equal(filterBrowseGames(games, " GAME 12 ").length, 5);
  assert.equal(filterBrowseGames(games, "absent").length, 0);
  assert.equal(filterBrowseGames(games, "", "name")[0].game, "Game 000");
  assert.deepEqual(games, original);
});
