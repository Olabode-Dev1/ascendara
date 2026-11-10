import { memo, useEffect, useRef, useState } from "react";
import { Gamepad2 } from "lucide-react";
import { useImageLoader } from "@/hooks/useImageLoader";
import { cn, sanitizeText } from "@/lib/utils";
import { catalogGameKey } from "@/lib/catalogDiscovery";

const CatalogBrowseCard = memo(({ game, view, onOpen, onContextMenu }) => {
  const element = useRef(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!window.IntersectionObserver) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  const { cachedImage } = useImageLoader(game.imgID, {
    enabled: visible,
    fallbackGameName: !game.imgID ? game.game : null,
    fallbackSlot: "card",
  });
  useEffect(() => setFailed(false), [cachedImage]);
  return (
    <button
      ref={element}
      type="button"
      data-catalog-key={catalogGameKey(game)}
      onClick={() => onOpen(game)}
      onContextMenu={event => onContextMenu?.(event, game)}
      className={cn(
        "group w-full min-w-0 overflow-hidden rounded-xl border border-border bg-card text-start shadow-sm transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        view === "list" ? "flex items-center gap-4" : "flex flex-col items-stretch"
      )}
    >
      <div
        className={cn(
          "relative aspect-video overflow-hidden bg-muted",
          view === "list" ? "w-28 shrink-0 sm:w-40" : "w-full"
        )}
      >
        {cachedImage && !failed ? (
          <img
            src={cachedImage}
            alt=""
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Gamepad2 className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-3">
        <p className="line-clamp-2 font-semibold text-foreground group-hover:text-primary">
          {sanitizeText(game.game)}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {Array.isArray(game.category)
            ? game.category.filter(tag => typeof tag === "string").join(" · ")
            : ""}
        </p>
        {view === "list" && game.size && (
          <p className="mt-1 text-xs text-muted-foreground">{game.size}</p>
        )}
      </div>
    </button>
  );
});
CatalogBrowseCard.displayName = "CatalogBrowseCard";
export default CatalogBrowseCard;
