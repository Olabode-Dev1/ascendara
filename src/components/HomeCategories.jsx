import { Link } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import CategoryPinControls from "@/components/CategoryPinControls";
import useCatalogDiscovery from "@/hooks/useCatalogDiscovery";

export default function HomeCategories({ categories, mode, renderGame }) {
  const { t } = useLanguage();
  const { pins } = useCatalogDiscovery();
  const names =
    mode === "pinned"
      ? pins
      : Object.keys(categories).filter(category => !pins.includes(category));
  if (!names.length) return null;
  return (
    <section className="my-10 space-y-5">
      <h2 className="text-lg font-bold">
        {mode === "pinned"
          ? t("discovery.pinned", { defaultValue: "Pinned categories" })
          : t("home.popularCategories", { defaultValue: "Popular categories" })}
      </h2>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {names.map(category => {
          const data = categories[category];
          return (
            <Card
              key={category}
              className="min-w-0 overflow-hidden border-border/50 bg-card"
            >
              <CardContent className="p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold">
                      <Link
                        className="rounded hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                        to={`/browse?category=${encodeURIComponent(category)}`}
                      >
                        {category}
                      </Link>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {data
                        ? t("browse.gameCount", {
                            defaultValue: "{{count}} games",
                            count: data.total,
                          })
                        : t("discovery.unavailable", {
                            defaultValue: "Unavailable from this source",
                          })}
                    </p>
                  </div>
                  <CategoryPinControls category={category} reorder={mode === "pinned"} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {data?.preview.map(renderGame)}
                </div>
                <Link
                  className={buttonVariants({
                    variant: "ghost",
                    size: "sm",
                    className: "mt-3 w-full",
                  })}
                  to={`/browse?category=${encodeURIComponent(category)}`}
                  aria-label={t("browse.viewCategory", {
                    defaultValue: "View all {{category}} games",
                    category,
                  })}
                >
                  {t("browse.viewAll", { defaultValue: "View all" })}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
