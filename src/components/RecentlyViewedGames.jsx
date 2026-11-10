import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { Button, buttonVariants } from "@/components/ui/button";
import CatalogBrowseCard from "@/components/CatalogBrowseCard";
import { catalogGameKey } from "@/lib/catalogDiscovery";
import { removeViewedGame } from "@/services/games/catalogDiscoveryStore";
import { toast } from "sonner";

export default function RecentlyViewedGames({ games, source }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  if (!games.length) return null;
  const remove = key => {
    if (!removeViewedGame(source, key))
      toast.error(
        t("browse.saveError", {
          defaultValue: "Could not save this preference. Please try again.",
        })
      );
  };
  return (
    <section className="my-8 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">
          {t("discovery.recent", { defaultValue: "Recently viewed" })}
        </h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => remove()}>
            {t("discovery.clearHistory", { defaultValue: "Clear viewed history" })}
          </Button>
          <Link
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            to="/browse?section=recent"
          >
            {t("browse.viewAll", { defaultValue: "View all" })}
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {games.slice(0, 8).map(game => (
          <div key={catalogGameKey(game)} className="min-w-0">
            <CatalogBrowseCard
              game={game}
              view="grid"
              onOpen={selected =>
                navigate("/download", { state: { gameData: selected } })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              aria-label={t("discovery.removeViewed", {
                defaultValue: "Remove {{game}} from viewed history",
                game: game.game,
              })}
              onClick={() => remove(catalogGameKey(game))}
            >
              {t("discovery.remove", { defaultValue: "Remove" })}
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}
