const test = require("node:test");
const assert = require("node:assert/strict");
const { loadModule } = require("./helpers/loadModule.cjs");
const load = () => loadModule("src/lib/catalogDiscovery.js");

test("source fingerprints are stable and do not persist private URLs", async () => {
  const { catalogSourceKey } = await load();
  const source = {
    customSourcesMode: true,
    customSource: { url: "https://private.invalid/list?token=secret" },
  };
  assert.equal(catalogSourceKey(source), catalogSourceKey(structuredClone(source)));
  assert.match(catalogSourceKey(source), /^source:[a-f0-9]+$/);
  assert.notEqual(catalogSourceKey(source), catalogSourceKey({}));
  assert.notEqual(
    catalogSourceKey({ localIndex: "a" }),
    catalogSourceKey({ localIndex: "b" })
  );
});

test("installed identity supports custom imports, distinct IDs and completed download metadata", async () => {
  const { installedGameIndex, isCatalogGameInstalled } = await load();
  const index = installedGameIndex([
    { game: "Known", gameID: "one", downloadingData: {} },
    { game: "Imported: Game" },
    { game: "Deleted", _isDeleted: true },
    { game: "Busy", downloadingData: { downloading: true } },
  ]);
  assert.ok(isCatalogGameInstalled({ game: "Known", gameID: "one" }, index));
  assert.ok(!isCatalogGameInstalled({ game: "Known", gameID: "two" }, index));
  assert.ok(isCatalogGameInstalled({ game: " imported game ", gameID: "new" }, index));
  assert.ok(!isCatalogGameInstalled({ game: "Deleted" }, index));
  assert.ok(!isCatalogGameInstalled({ game: "Busy" }, index));
});

test("URL filter values are validated rather than coercing malformed values", async () => {
  const { readBrowseFilters } = await load();
  assert.deepEqual(
    readBrowseFilters(
      new URLSearchParams("installed=banana&online=true&vr=0&maxSize=-1")
    ),
    { installed: "any", online: false, vr: false, maxSize: null }
  );
  assert.deepEqual(
    readBrowseFilters(new URLSearchParams("installed=no&online=1&vr=1&maxSize=25")),
    { installed: "no", online: true, vr: true, maxSize: 25 }
  );
});

test("similar games rank distinct shared tags first, exclude self and duplicate identities", async () => {
  const { similarCatalogGames, resolveViewedGames, catalogGameKey } = await load();
  const current = {
    game: "Current",
    gameID: "self",
    category: [" Action ", "Adventure", "Action"],
  };
  const both = {
    game: "Both",
    gameID: "both",
    category: ["action", "adventure"],
    weight: 1,
  };
  const popular = { game: "Popular", gameID: "pop", category: ["Action"], weight: 100 };
  const tied = { game: "A title", gameID: "tie", category: ["Action"], weight: 100 };
  const catalog = [
    current,
    popular,
    both,
    { ...both },
    tied,
    { game: "No tags", category: "Action" },
    null,
  ];
  assert.deepEqual(
    similarCatalogGames(catalog, current).map(entry => entry.game.game),
    ["Both", "A title", "Popular"]
  );
  assert.deepEqual(similarCatalogGames(catalog, { game: "Unknown" }), []);
  assert.deepEqual(
    resolveViewedGames(catalog, [{ key: catalogGameKey(popular) }, { key: "id:gone" }]),
    [popular]
  );
});

test("discovery storage validates pins, caps source-isolated history, and saves no game links", async () => {
  let raw = null;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => raw,
      setItem: (_, value) => {
        raw = value;
      },
    },
  });
  try {
    const store = await loadModule("src/services/games/catalogDiscoveryStore.js", {
      fresh: true,
    });
    const { catalogSourceKey } = await load();
    const source = catalogSourceKey({}),
      other = catalogSourceKey({ localIndex: "other" });
    assert.ok(store.toggleCategoryPin("Action"));
    assert.ok(store.toggleCategoryPin("Adventure"));
    assert.ok(store.moveCategoryPin("Adventure", -1));
    assert.deepEqual(store.readDiscovery().pins, ["Adventure", "Action"]);
    assert.equal(store.toggleCategoryPin("Unknown"), false);
    for (let i = 0; i < 30; i++)
      store.recordViewedGame(
        source,
        {
          game: `Game ${i}`,
          gameID: `id${i}`,
          download_links: { secret: "do not store" },
        },
        i + 1000
      );
    assert.equal(store.readDiscovery().recent[source].length, 24);
    assert.equal(store.readDiscovery().recent[source][0].key, "id:id29");
    assert.ok(!raw.includes("download_links"));
    store.recordViewedGame(other, { game: "Other", gameID: "other" }, 5000);
    assert.equal(store.readDiscovery().recent[source].length, 24);
    assert.equal(store.readDiscovery().recent[other].length, 1);
    store.removeViewedGame(source, "id:id29");
    assert.equal(store.readDiscovery().recent[source].length, 23);
    store.removeViewedGame(source);
    assert.equal(store.readDiscovery().recent[source].length, 0);
    assert.equal(store.readDiscovery().recent[other].length, 1);
    raw = "malformed";
    assert.deepEqual(store.readDiscovery().pins, []);
    raw = JSON.stringify({
      version: 1,
      pins: ["Action", "Action", false, "Unknown"],
      recent: { bad: [{}] },
    });
    assert.deepEqual(store.readDiscovery().pins, ["Action"]);
    globalThis.localStorage.setItem = () => {
      throw new Error("quota");
    };
    assert.equal(store.toggleCategoryPin("Survival"), false);
    assert.deepEqual(store.readDiscovery().pins, ["Action"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});
