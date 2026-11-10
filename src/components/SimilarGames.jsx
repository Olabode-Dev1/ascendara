import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useSettings } from "@/context/SettingsContext";
import CatalogBrowseCard from "@/components/CatalogBrowseCard";
import gameService from "@/services/games/gameService";
import {
  catalogGameKey,
  catalogSourceKey,
  similarCatalogGames,
} from "@/lib/catalogDiscovery";
import { recordViewedGame } from "@/services/games/catalogDiscoveryStore";

export default function SimilarGames({ game }) {
  const { t } = useLanguage();
  const { settings } = useSettings();
  const source = catalogSourceKey(settings);
  const navigate = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [revision, setRevision] = useState(0);
  const identity = catalogGameKey(game);
  const recorded = useRef(null);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener("index-refreshed", refresh);
    return () => window.removeEventListener("index-refreshed", refresh);
  }, []);
  useEffect(() => {
    let active = true;
    setCatalog([]);
    Promise.all([gameService.getAllGames(), window.electron.getSettings()])
      .then(([data, currentSettings]) => {
        if (!active || !Array.isArray(data?.games)) return;
        setCatalog(data.games);
        const current = data.games.find(entry => catalogGameKey(entry) === identity);
        const actualSource = catalogSourceKey(currentSettings || settings);
        const visit = `${actualSource}:${identity}`;
        if (
          current &&
          recorded.current !== visit &&
          recordViewedGame(actualSource, current)
        )
          recorded.current = visit;
      })
      .catch(() => {
        /* Optional recommendations must not block the details page. */
      });
    return () => {
      active = false;
    };
    // Only a new detail identity/source counts as a visit, not metadata enrichment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, source, revision]);
  const recommendations = useMemo(
    () => similarCatalogGames(catalog, game),
    [catalog, game]
  );
  if (!recommendations.length) return null;
  return (
    <section
      aria-label={t("discovery.similar", { defaultValue: "Similar games" })}
      className="space-y-4 rounded-xl border border-border/50 bg-card/50 p-5"
    >
      <h2 className="text-xl font-bold">
        {t("discovery.similar", { defaultValue: "Similar games" })}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recommendations.map(({ game: related, shared }) => (
          <div key={catalogGameKey(related)} className="min-w-0">
            <CatalogBrowseCard
              game={related}
              view="grid"
              onOpen={selected =>
                navigate("/download", { state: { gameData: selected } })
              }
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {t("discovery.sharedTags", {
                defaultValue: "Shared categories: {{tags}}",
                tags: shared.join(", "),
              })}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
