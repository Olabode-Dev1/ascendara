import { Pin, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import useCatalogDiscovery from "@/hooks/useCatalogDiscovery";
import {
  toggleCategoryPin,
  moveCategoryPin,
} from "@/services/games/catalogDiscoveryStore";
import { POPULAR_CATEGORIES } from "@/lib/catalogBrowse";
import { toast } from "sonner";

export default function CategoryPinControls({ category, reorder = false }) {
  const { t } = useLanguage();
  const { pins } = useCatalogDiscovery();
  const index = pins.indexOf(category);
  if (!POPULAR_CATEGORIES.includes(category)) return null;
  const save = result => {
    if (!result)
      toast.error(
        t("browse.saveError", {
          defaultValue: "Could not save this preference. Please try again.",
        })
      );
  };
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-9 w-9 p-0"
        aria-pressed={index >= 0}
        aria-label={t(index >= 0 ? "discovery.unpin" : "discovery.pin", {
          defaultValue: index >= 0 ? "Unpin {{category}}" : "Pin {{category}}",
          category,
        })}
        onClick={() => save(toggleCategoryPin(category))}
      >
        <Pin className={index >= 0 ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"} />
      </Button>
      {reorder && index >= 0 && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            disabled={index === 0}
            aria-label={t("discovery.earlier", {
              defaultValue: "Move {{category}} earlier",
              category,
            })}
            onClick={() => save(moveCategoryPin(category, -1))}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            disabled={index === pins.length - 1}
            aria-label={t("discovery.later", {
              defaultValue: "Move {{category}} later",
              category,
            })}
            onClick={() => save(moveCategoryPin(category, 1))}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  );
}
