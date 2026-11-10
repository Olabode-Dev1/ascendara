import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, LayoutGrid, List, LoaderCircle, Search, X } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import CatalogBrowseCard from "@/components/CatalogBrowseCard";
import GameContextMenu from "@/components/GameContextMenu";
import gameService from "@/services/games/gameService";
import {
  BROWSE_SECTIONS,
  filterBrowseGames,
  selectCatalogGames,
} from "@/lib/catalogBrowse";
import { toast } from "sonner";
import { useSettings } from "@/context/SettingsContext";
import { parseSize } from "@/lib/installSpace";
import {
  catalogGameKey,
  catalogSourceKey,
  isCatalogGameInstalled,
  readBrowseFilters,
  resolveViewedGames,
} from "@/lib/catalogDiscovery";
import useCatalogDiscovery from "@/hooks/useCatalogDiscovery";
import useBrowseInstallations from "@/hooks/useBrowseInstallations";
import useBrowseRestoration from "@/hooks/useBrowseRestoration";
import BrowseFilters from "@/components/BrowseFilters";
import CategoryPinControls from "@/components/CategoryPinControls";
import { removeViewedGame } from "@/services/games/catalogDiscoveryStore";

const sectionLabels = {
  recent: "Recently viewed",
  top: "Top games",
  updated: "Recently updated",
  online: "Online games",
  action: "Action & adventure",
};

export default function Browse() {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const source = catalogSourceKey(settings);
  const discovery = useCatalogDiscovery();
  const installations = useBrowseInstallations();
  const [restoredCount, setRestoredCount] = useState(48);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const category = params.get("category")?.trim();
  const section = params.get("section");
  const query = params.get("q") || "";
  const sort = ["name", "updated"].includes(params.get("sort"))
    ? params.get("sort")
    : "default";
  const filters = useMemo(() => readBrowseFilters(params), [params]);
  const activeFilters =
    filters.installed !== "any" ||
    filters.online ||
    filters.vr ||
    Boolean(filters.maxSize);
  const installationPending =
    filters.installed !== "any" && (installations.loading || installations.error);
  const requestedCount = Number(params.get("count"));
  const count = Math.max(
    restoredCount,
    Number.isSafeInteger(requestedCount) && requestedCount >= 48 ? requestedCount : 48
  );
  const valid =
    Boolean(category) || section === "recent" || BROWSE_SECTIONS.includes(section);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const [menu, setMenu] = useState(null);
  const [later, setLater] = useState([]);
  const root = useRef(null);
  const [view, setView] = useState(() => {
    try {
      return localStorage.getItem("catalog-browse-view") === "list" ? "list" : "grid";
    } catch {
      return "grid";
    }
  });
  const routeKey = params.toString();
  const previousSource = useRef(source);
  useEffect(() => {
    if (previousSource.current !== source) {
      previousSource.current = source;
      setParams(
        previous => {
          const next = new URLSearchParams(previous);
          next.delete("count");
          return next;
        },
        { replace: true }
      );
    }
  }, [source, setParams]);
  useEffect(() => setRestoredCount(48), [source, routeKey]);
  const clearFilters = () => {
    const next = new URLSearchParams(params);
    for (const key of ["installed", "online", "vr", "maxSize", "count"]) next.delete(key);
    setParams(next, { replace: true });
  };
  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "count") next.delete("count");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const refresh = () => {
      setMenu(null);
      setReload(value => value + 1);
      setParams(
        previous => {
          const next = new URLSearchParams(previous);
          next.delete("count");
          return next;
        },
        { replace: true }
      );
    };
    window.addEventListener("index-refreshed", refresh);
    return () => window.removeEventListener("index-refreshed", refresh);
  }, [setParams]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    setGames([]);
    gameService
      .getAllGames()
      .then(response => {
        if (!Array.isArray(response?.games)) throw new Error("Invalid catalog");
        if (active) setGames(response.games);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload, source]);

  useEffect(() => {
    const load = () => {
      try {
        const saved = JSON.parse(localStorage.getItem("play-later-games") || "[]");
        setLater(Array.isArray(saved) ? saved : []);
      } catch {
        setLater([]);
      }
    };
    load();
    window.addEventListener("play-later-updated", load);
    return () => window.removeEventListener("play-later-updated", load);
  }, []);

  const all = useMemo(
    () =>
      section === "recent" && !category
        ? resolveViewedGames(games, discovery.recent[source] || [])
        : selectCatalogGames(games, { category, section }),
    [games, category, section, discovery.recent, source]
  );
  const results = useMemo(
    () =>
      filterBrowseGames(all, query, sort, game => {
        if (filters.online && !game.online) return false;
        if (filters.vr && !game.isVr) return false;
        if (filters.maxSize) {
          const validSize = /^\d+(?:\.\d+)?\s*(B|KB|MB|GB|TB)$/i.test(
            String(game.size || "").trim()
          );
          const bytes = validSize ? parseSize(game.size) : null;
          if (
            !Number.isFinite(bytes) ||
            bytes <= 0 ||
            bytes > filters.maxSize * 1024 ** 3
          )
            return false;
        }
        if (filters.installed !== "any") {
          if (installationPending) return false;
          if (
            isCatalogGameInstalled(game, installations.index) !==
            (filters.installed === "yes")
          )
            return false;
        }
        return true;
      }),
    [all, query, sort, filters, installations.index, installationPending]
  );
  const ensureCount = useCallback(value => setRestoredCount(value), []);
  const savePosition = useBrowseRestoration({
    root,
    source,
    ready: !loading && !error && !installationPending,
    results,
    count,
    ensureCount,
    signature: routeKey,
  });
  const title =
    category ||
    t(`browse.sections.${section}`, {
      defaultValue: sectionLabels[section] || "Browse games",
    });
  const open = (game, autoStart = false) => {
    savePosition(game);
    navigate("/download", {
      state: { gameData: game, ...(autoStart ? { autoStart: true } : {}) },
    });
  };
  const toggleLater = game => {
    try {
      const next = later.some(item => item.game === game.game)
        ? later.filter(item => item.game !== game.game)
        : [...later, { ...game, addedAt: Date.now() }];
      localStorage.setItem("play-later-games", JSON.stringify(next));
      window.dispatchEvent(new CustomEvent("play-later-updated"));
    } catch {
      toast.error(
        t("browse.saveError", {
          defaultValue: "Could not save this preference. Please try again.",
        })
      );
    }
  };

  return (
    <section ref={root} className="mx-auto max-w-7xl px-2 py-8 sm:px-6">
      <Link
        to="/"
        className="mb-5 inline-flex items-center gap-2 rounded text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("browse.backHome", { defaultValue: "Back to Home" })}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        {category && <CategoryPinControls category={category} />}
      </div>
      {section === "recent" && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (!removeViewedGame(source)) toast.error(t("browse.saveError"));
          }}
        >
          {t("discovery.clearHistory", { defaultValue: "Clear viewed history" })}
        </Button>
      )}
      {!loading && !error && !installationPending && valid && (
        <p className="mt-2 text-sm text-muted-foreground" role="status">
          {t("browse.results", {
            defaultValue: "{{shown}} of {{total}} games",
            shown: results.length,
            total: all.length,
          })}
        </p>
      )}
      <div className="my-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label={t("browse.search", { defaultValue: "Search these games" })}
            placeholder={t("browse.search", { defaultValue: "Search these games" })}
            value={query}
            onChange={event => update("q", event.target.value)}
            className="pl-9 pr-10"
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-10 w-10"
              aria-label={t("browse.clear", { defaultValue: "Clear search" })}
              onClick={() => update("q", "")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <select
          value={sort}
          onChange={event => update("sort", event.target.value)}
          aria-label={t("browse.sort", { defaultValue: "Sort games" })}
          className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="default">
            {t("browse.recommended", { defaultValue: "Recommended" })}
          </option>
          <option value="name">{t("browse.name", { defaultValue: "Name A–Z" })}</option>
          <option value="updated">
            {t("browse.updated", { defaultValue: "Recently updated" })}
          </option>
        </select>
        <div
          className="flex gap-1"
          role="group"
          aria-label={t("browse.layout", { defaultValue: "Results layout" })}
        >
          {[
            { value: "grid", Icon: LayoutGrid },
            { value: "list", Icon: List },
          ].map(({ value, Icon }) => (
            <Button
              key={value}
              variant={view === value ? "default" : "outline"}
              size="icon"
              className={view === value ? "h-10 w-10 text-secondary" : "h-10 w-10"}
              aria-label={t(`browse.${value}`, {
                defaultValue: value === "grid" ? "Grid view" : "List view",
              })}
              aria-pressed={view === value}
              onClick={() => {
                setView(value);
                try {
                  localStorage.setItem("catalog-browse-view", value);
                } catch {
                  /* View remains usable without persistence. */
                }
              }}
            >
              <Icon className="h-4 w-4" />
            </Button>
          ))}
        </div>
      </div>
      <BrowseFilters
        filters={filters}
        update={update}
        clear={clearFilters}
        installations={installations}
      />
      {!valid ? (
        <p role="alert">
          {t("browse.invalid", {
            defaultValue: "This collection is unavailable. Choose a category from Home.",
          })}
        </p>
      ) : loading || (installationPending && !installations.error) ? (
        <div className="flex items-center justify-center gap-3 py-20" role="status">
          <LoaderCircle className="h-6 w-6 animate-spin" />
          {t("browse.loading", { defaultValue: "Loading games…" })}
        </div>
      ) : error ? (
        <div role="alert" className="space-y-4 py-12">
          <p>{t("browse.error", { defaultValue: "Could not load the catalog." })}</p>
          <Button onClick={() => setReload(value => value + 1)}>
            {t("browse.retry", { defaultValue: "Try again" })}
          </Button>
        </div>
      ) : installationPending ? null : !results.length ? (
        <div className="space-y-4 py-16 text-center">
          <p>
            {query || activeFilters
              ? t("browse.noMatches", { defaultValue: "No games match your search." })
              : t("browse.empty", {
                  defaultValue:
                    "No games in this collection are available from the current source.",
                })}
          </p>
          {activeFilters && (
            <Button variant="outline" onClick={clearFilters}>
              {t("discovery.clearFilters", { defaultValue: "Clear filters" })}
            </Button>
          )}
          {query && (
            <Button variant="outline" onClick={() => update("q", "")}>
              {t("browse.clear", { defaultValue: "Clear search" })}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div
            className={
              view === "grid"
                ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "flex flex-col gap-3"
            }
          >
            {results.slice(0, count).map((game, index) => (
              <div key={`${catalogGameKey(game)}:${index}`} className="min-w-0">
                <CatalogBrowseCard
                  key={`${catalogGameKey(game)}:${index}`}
                  game={game}
                  view={view}
                  onOpen={open}
                  onContextMenu={(event, selected) => {
                    event.preventDefault();
                    setMenu({
                      game: selected,
                      position: {
                        x: Math.max(0, Math.min(event.clientX, window.innerWidth - 280)),
                        y: Math.max(0, Math.min(event.clientY, window.innerHeight - 350)),
                      },
                    });
                  }}
                />
                {section === "recent" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      if (!removeViewedGame(source, catalogGameKey(game)))
                        toast.error(t("browse.saveError"));
                    }}
                    aria-label={t("discovery.removeViewed", {
                      defaultValue: "Remove {{game}} from viewed history",
                      game: game.game,
                    })}
                  >
                    {t("discovery.remove", { defaultValue: "Remove" })}
                  </Button>
                )}
              </div>
            ))}
          </div>
          {count < results.length && (
            <div className="mt-8 text-center">
              <Button
                variant="outline"
                onClick={() => update("count", String(count + 48))}
              >
                {t("browse.loadMore", { defaultValue: "Load more games" })}
              </Button>
            </div>
          )}
        </>
      )}
      <GameContextMenu
        isOpen={Boolean(menu)}
        game={menu?.game}
        position={menu?.position || { x: 0, y: 0 }}
        onClose={() => setMenu(null)}
        onDownload={game => open(game)}
        onReadMore={game => open(game)}
        onStartDownload={game => open(game, true)}
        onPlayLater={toggleLater}
        isPlayLater={later.some(game => game.game === menu?.game?.game)}
      />
    </section>
  );
}
