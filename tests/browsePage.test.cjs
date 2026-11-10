const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const Module = require("node:module");
const { JSDOM } = require("jsdom");
const { build } = require("esbuild");

// Exercise the real page, router, selectors and cards with only environment
// boundaries replaced: catalog, translation context, artwork and context menu.
test("category browser reaches every game in both layouts and keeps navigation state", async () => {
  const dom = new JSDOM('<div id="root"></div>', {
    url: "http://localhost/",
    pretendToBeVisual: true,
  });
  const { window } = dom;
  const { document } = window;
  const previous = {};
  for (const key of [
    "window",
    "document",
    "navigator",
    "localStorage",
    "CustomEvent",
    "HTMLElement",
    "requestAnimationFrame",
    "cancelAnimationFrame",
  ]) {
    previous[key] = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value:
        key === "requestAnimationFrame" || key === "cancelAnimationFrame"
          ? dom.window[key].bind(dom.window)
          : dom.window[key],
    });
  }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  dom.window.scrollTo = () => {};
  let libraryFailure = false;
  dom.window.electron = {
    getSettings: async () => ({}),
    getGames: async () => {
      if (libraryFailure) throw new Error("offline library");
      return [{ game: "Game 124", gameID: "id-124" }];
    },
    getCustomGames: async () => [{ game: "Game 122" }],
  };
  const React = require("react");
  const { act } = React;
  const { createRoot } = require("react-dom/client");
  const {
    MemoryRouter,
    Routes,
    Route,
    useLocation,
    useNavigate,
  } = require("react-router-dom");
  let failure = false;
  let catalog = Array.from({ length: 125 }, (_, index) => ({
    game: `Game ${String(index).padStart(3, "0")}`,
    gameID: `id-${index}`,
    category: ["Action"],
    weight: index,
    online: index % 2 === 0,
    isVr: index % 4 === 0,
    size: index % 3 === 0 ? "8 GB" : "40 GB",
  }));
  globalThis.__browseTestCatalog = () =>
    failure ? Promise.reject(new Error("offline")) : Promise.resolve({ games: catalog });
  const stubs = {
    "@/services/app/systemHealthService":
      "export const formatBytes = value => String(value);",
    "@/context/SettingsContext": "export const useSettings = () => ({settings:{}});",
    "@/services/games/gameService":
      "export default { getAllGames: () => globalThis.__browseTestCatalog() };",
    "@/context/LanguageContext":
      "export const useLanguage = () => ({t: (key, options = {}) => (options.defaultValue || key).replace(/{{(\\w+)}}/g, (_, name) => options[name])});",
    "@/hooks/useImageLoader":
      "export const useImageLoader = () => ({ cachedImage: null });",
    "@/components/GameContextMenu": "export default function Menu() { return null; }",
  };
  const result = await build({
    stdin: {
      contents:
        'export { default } from "@/pages/Browse"; export { default as SimilarGames } from "@/components/SimilarGames"; export { default as HomeCategories } from "@/components/HomeCategories";',
      resolveDir: process.cwd(),
      loader: "js",
    },
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    packages: "external",
    plugins: [
      {
        name: "test-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^@\// }, args => {
            if (stubs[args.path]) return { path: args.path, namespace: "stub" };
            const base = path.resolve("src", args.path.slice(2));
            return {
              path: [base, `${base}.jsx`, `${base}.js`].find(file => fs.existsSync(file)),
            };
          });
          builder.onLoad({ filter: /.*/, namespace: "stub" }, args => ({
            contents: stubs[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  const compiled = new Module(path.resolve(".cache/browse-test.cjs"), module);
  compiled.filename = path.resolve(".cache/browse-test.cjs");
  compiled.paths = module.paths;
  compiled._compile(result.outputFiles[0].text, compiled.filename);
  const Browse = compiled.exports.default;
  const SimilarGames = compiled.exports.SimilarGames;
  const HomeCategories = compiled.exports.HomeCategories;
  function Details() {
    const current = useLocation();
    return React.createElement(SimilarGames, { game: current.state.gameData });
  }
  function Pins() {
    return React.createElement(HomeCategories, {
      mode: "pinned",
      categories: {
        Action: { total: 1, preview: [] },
        Adventure: { total: 1, preview: [] },
      },
      renderGame: () => null,
    });
  }
  let location;
  let navigate;
  function Probe() {
    location = useLocation();
    navigate = useNavigate();
    return null;
  }
  const root = createRoot(document.getElementById("root"));
  const settle = async () =>
    act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
  const button = label =>
    [...document.querySelectorAll("button")].find(
      node => node.textContent === label || node.getAttribute("aria-label") === label
    );
  const click = async label => {
    assert.ok(button(label), `Missing button: ${label}`);
    await act(async () => button(label).click());
    await settle();
  };
  const cards = () =>
    [...document.querySelectorAll("button")].filter(node =>
      /^Game \d/.test(node.textContent)
    );
  try {
    await act(async () =>
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ["/browse?category=Action"] },
          React.createElement(Probe),
          React.createElement(
            Routes,
            null,
            React.createElement(Route, {
              path: "/browse",
              element: React.createElement(Browse),
            }),
            React.createElement(Route, {
              path: "/pins",
              element: React.createElement(Pins),
            }),
            React.createElement(Route, {
              path: "/download",
              element: React.createElement(Details),
            })
          )
        )
      )
    );
    await settle();
    assert.match(document.body.textContent, /125 of 125 games/);
    assert.equal(cards().length, 48);
    await click("Load more games");
    assert.equal(cards().length, 96);
    await click("Load more games");
    assert.equal(cards().length, 125);
    assert.equal(button("Load more games"), undefined);
    await click("List view");
    assert.equal(button("List view").getAttribute("aria-pressed"), "true");
    assert.equal(localStorage.getItem("catalog-browse-view"), "list");
    assert.equal(cards().length, 125);
    const selected = cards()[0];
    const title = selected.querySelector("p").textContent;
    await act(async () => selected.click());
    assert.equal(location.pathname, "/download");
    assert.equal(location.state.gameData.game, title);
    assert.equal(location.state.autoStart, undefined);
    await settle();
    assert.match(document.body.textContent, /Similar games/);
    let viewed = Object.values(
      JSON.parse(localStorage.getItem("catalog-discovery-v1")).recent
    )[0];
    assert.equal(viewed[0].key, "id:id-124");
    const firstViewedAt = viewed[0].viewedAt;
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 1050));
    });
    await act(async () => window.dispatchEvent(new CustomEvent("index-refreshed")));
    await settle();
    assert.equal(
      Object.values(JSON.parse(localStorage.getItem("catalog-discovery-v1")).recent)[0][0]
        .viewedAt,
      firstViewedAt
    );
    assert.equal(cards().length, 8);
    await act(async () => cards()[0].click());
    await settle();
    assert.equal(location.state.gameData.gameID, "id-123");
    assert.equal(location.state.autoStart, undefined);
    viewed = Object.values(
      JSON.parse(localStorage.getItem("catalog-discovery-v1")).recent
    )[0];
    assert.equal(viewed[0].key, "id:id-123");
    await act(async () => navigate(-1));
    await settle();
    catalog = structuredClone(catalog);
    await act(async () => navigate(-1));
    await settle();
    assert.equal(cards().length, 125);
    assert.equal(button("List view").getAttribute("aria-pressed"), "true");
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 450));
    });
    assert.equal(document.activeElement.dataset.catalogKey, "id:id-124");
    const input = document.querySelector("input");
    await act(async () => {
      Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value"
      ).set.call(input, "absent");
      input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
    assert.match(document.body.textContent, /No games match/);
    await click("Clear search");
    assert.equal(cards().length, 48);
    await click("Load more games");
    const choose = async (label, value) => {
      const control = [...document.querySelectorAll("select")].find(node =>
        node.closest("label")?.textContent.startsWith(label)
      );
      assert.ok(control, label);
      await act(async () => {
        control.value = value;
        control.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
      });
      await settle();
    };
    await choose("Installation", "yes");
    assert.match(document.body.textContent, /2 of 125 games/);
    assert.equal(cards().length, 2);
    await click("Clear filters");
    await choose("Download size", "10");
    assert.match(document.body.textContent, /42 of 125 games/);
    assert.equal(cards().length, 42);
    await click("Clear filters");
    await click("Pin Action");
    assert.equal(button("Unpin Action").getAttribute("aria-pressed"), "true");
    assert.deepEqual(JSON.parse(localStorage.getItem("catalog-discovery-v1")).pins, [
      "Action",
    ]);
    await act(async () => navigate("/browse?category=Adventure"));
    await settle();
    await click("Pin Adventure");
    await act(async () => navigate("/pins"));
    await settle();
    assert.deepEqual(
      [...document.querySelectorAll("h3")].map(node => node.textContent),
      ["Action", "Adventure"]
    );
    await click("Move Adventure earlier");
    assert.deepEqual(
      [...document.querySelectorAll("h3")].map(node => node.textContent),
      ["Adventure", "Action"]
    );
    await act(async () => navigate("/browse?category=Action"));
    await settle();
    assert.deepEqual(JSON.parse(localStorage.getItem("catalog-discovery-v1")).pins, [
      "Adventure",
      "Action",
    ]);
    libraryFailure = true;
    await act(async () => window.dispatchEvent(new dom.window.Event("focus")));
    await settle();
    await choose("Installation", "no");
    assert.match(document.body.textContent, /Could not read your installed games/);
    assert.equal(cards().length, 0);
    libraryFailure = false;
    await click("Try again");
    assert.match(document.body.textContent, /123 of 125 games/);
    await click("Clear filters");
    catalog = [{ game: "Replacement", category: ["Action"] }];
    await act(async () => window.dispatchEvent(new CustomEvent("index-refreshed")));
    await settle();
    assert.match(document.body.textContent, /1 of 1 games/);
    assert.ok(!document.body.textContent.includes("Game 124"));
    assert.ok(!location.search.includes("count="));
    failure = true;
    await act(async () => window.dispatchEvent(new CustomEvent("index-refreshed")));
    await settle();
    assert.match(document.body.textContent, /Could not load/);
    failure = false;
    await click("Try again");
    assert.match(document.body.textContent, /Replacement/);
    await act(async () => navigate("/browse?section=recent"));
    await settle();
    assert.match(document.body.textContent, /0 of 0 games/);
    await act(async () => navigate("/browse?category=Action"));
    await settle();
    catalog = [
      {
        game: "Unknown",
        category: ["Action"],
        size: "unknown",
        online: true,
        isVr: true,
      },
      {
        game: "Malformed",
        category: ["Action"],
        size: "1..2 GB",
        online: true,
        isVr: true,
      },
      { game: "Small", category: ["Action"], size: "512 MB", online: true, isVr: true },
      { game: "Big", category: ["Action"], size: "50 GB", online: true, isVr: true },
      { game: "Offline", category: ["Action"], size: "1 GB", online: false, isVr: true },
      { game: "Non VR", category: ["Action"], size: "1 GB", online: true, isVr: false },
    ];
    await act(async () => window.dispatchEvent(new CustomEvent("index-refreshed")));
    await settle();
    await choose("Download size", "10");
    assert.match(document.body.textContent, /3 of 6 games/);
    await act(async () => document.querySelectorAll('input[type="checkbox"]')[0].click());
    await settle();
    assert.match(document.body.textContent, /2 of 6 games/);
    await act(async () => document.querySelectorAll('input[type="checkbox"]')[1].click());
    await settle();
    assert.match(document.body.textContent, /1 of 6 games/);
    assert.match(document.querySelector("[data-catalog-key]").textContent, /Small/);
    await click("Clear filters");
    assert.match(document.body.textContent, /6 of 6 games/);
    await act(async () => navigate("/browse?section=invalid"));
    assert.match(document.body.textContent, /collection is unavailable/);
  } finally {
    await act(async () => root.unmount());
    dom.window.close();
    delete globalThis.__browseTestCatalog;
    delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for (const [key, descriptor] of Object.entries(previous)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
