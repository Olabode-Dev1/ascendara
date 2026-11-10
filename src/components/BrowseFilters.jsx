import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

export default function BrowseFilters({ filters, update, clear, installations }) {
  const { t } = useLanguage();
  const active =
    filters.installed !== "any" || filters.online || filters.vr || filters.maxSize;
  const labels = {
    installed: t(
      filters.installed === "yes" ? "discovery.installed" : "discovery.notInstalled",
      { defaultValue: filters.installed === "yes" ? "Installed" : "Not installed" }
    ),
    online: t("discovery.online", { defaultValue: "Online only" }),
    vr: t("discovery.vr", { defaultValue: "VR only" }),
    maxSize: t("discovery.sizeChip", {
      defaultValue: "Download up to {{size}} GB",
      size: filters.maxSize,
    }),
  };
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t("discovery.installation", { defaultValue: "Installation" })}
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={filters.installed}
            onChange={event =>
              update("installed", event.target.value === "any" ? "" : event.target.value)
            }
          >
            <option value="any">{t("discovery.any", { defaultValue: "Any" })}</option>
            <option value="yes">
              {t("discovery.installed", { defaultValue: "Installed" })}
            </option>
            <option value="no">
              {t("discovery.notInstalled", { defaultValue: "Not installed" })}
            </option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("discovery.downloadSize", { defaultValue: "Download size" })}
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={filters.maxSize || ""}
            onChange={event => update("maxSize", event.target.value)}
          >
            <option value="">{t("discovery.any", { defaultValue: "Any" })}</option>
            {[5, 10, 25, 50, 100].map(size => (
              <option key={size} value={size}>
                {t("discovery.upTo", { defaultValue: "Up to {{size}} GB", size })}
              </option>
            ))}
          </select>
        </label>
        {["online", "vr"].map(key => (
          <label key={key} className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={filters[key]}
              onChange={event => update(key, event.target.checked ? "1" : "")}
            />
            {labels[key]}
          </label>
        ))}
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(labels)
            .filter(([key]) =>
              key === "installed" ? filters.installed !== "any" : Boolean(filters[key])
            )
            .map(([key, label]) => (
              <Button
                key={key}
                variant="outline"
                size="sm"
                aria-label={t("discovery.removeFilter", {
                  defaultValue: "Remove filter: {{filter}}",
                  filter: label,
                })}
                onClick={() => update(key, "")}
              >
                {label}
                <span aria-hidden="true" className="ms-2">
                  ×
                </span>
              </Button>
            ))}
          <Button variant="ghost" size="sm" onClick={clear}>
            {t("discovery.clearFilters", { defaultValue: "Clear filters" })}
          </Button>
        </div>
      )}
      {filters.installed !== "any" && installations.error && (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm">
          <p>
            {t("discovery.libraryError", {
              defaultValue: "Could not read your installed games.",
            })}
          </p>
          <Button variant="outline" size="sm" onClick={installations.retry}>
            {t("browse.retry", { defaultValue: "Try again" })}
          </Button>
        </div>
      )}
    </div>
  );
}
