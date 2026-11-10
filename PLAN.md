# Catalog discovery improvements

## Objective and workflow

Improve Home catalog discovery and browsing while keeping Ascendara's existing
appearance, game actions, backend, settings, and library contracts.

Implementation is complete. The separately requested Review and Correct phases
have not been performed. This plan consolidates the completed category-browser
and five-feature discovery work.

## Implemented scope

- Home category names and View All links open complete category results.
- Top, Recently Updated, Online, and Action shelves also have View All links.
- Category totals use the full catalog rather than four-image preview counts.
- Browse supports vertical grid/list layouts, title search, sorting, and explicit
  Load More batches of 48. Preview limits do not cap complete browse results.
- Category filters cover installed/not installed status, online support, VR, and
  maximum download size. Active chips can be removed individually or cleared.
- Installed matching includes custom imports and distinguishes unavailable
  library data from an empty library. Failed lookups offer retry.
- Categories can be pinned, unpinned, and reordered with keyboard-accessible
  controls. Unavailable saved pins are retained across source changes.
- Recently Viewed is separate from recently played games. It is recorded on
  detail entry, shown on Home and in Browse, and supports removal and clearing.
- History retains 24 entries per source across at most eight sources. It stores
  identity/title/time, resolves current catalog records, and omits download links
  and raw custom-source URLs.
- Similar Games ranks shared category tags, then popularity and title, excludes
  the current game and duplicate identities, and displays up to eight results.
- Browser return state retains filters, sort, loaded results, scroll anchor and
  focus. Restoration handles replacement catalog arrays and cancels on user
  scroll input rather than overriding it.
- Recommendation navigation uses the existing detail route without automatically
  starting a download. Detail route keys prefer stable game IDs over titles.
- Removed an existing Download exit-cleanup history rewrite that could erase
  the incoming Browse route during an animated transition.

## Implementation resources

- `src/pages/Browse.jsx`: complete results, filters, history view, game actions.
- `src/pages/Home.jsx`: category previews, pinned categories, recent history.
- `src/pages/Download.jsx`: similar games and preserved router history.
- `src/app.jsx`: lazy Browse route and game-detail identity keys.
- `src/lib/catalogBrowse.js`, `src/lib/catalogDiscovery.js`: selection, filtering,
  identity, source fingerprints, installation matching, similarity and recency.
- `src/services/games/catalogDiscoveryStore.js`: versioned local preferences.
- `src/hooks/useCatalogDiscovery.js`, `useBrowseInstallations.js`, and
  `useBrowseRestoration.js`: subscriptions, library lookup, navigation state.
- New category, filter, history, recommendation and card components under
  `src/components/` reuse existing UI controls, artwork loaders and theme tokens.
- `src/translations/en.json`: new English strings with existing English fallback.
- `tests/catalogBrowse.test.cjs`, `catalogDiscovery.test.cjs`, and
  `browsePage.test.cjs`: selector, storage and interaction coverage.

## Dependencies and decisions

- No runtime dependency, API credential, backend schema, or lockfile change.
- Unknown category metadata is not inferred. Unknown or malformed sizes are
  excluded only when a download-size constraint is active.
- Download-size choices are Any and up to 5/10/25/50/100 GB.
- Installed membership refreshes on entry, window focus, download completion and
  existing cache invalidation. No per-card IPC polling was introduced.
- Source-scoped history and bounded session restoration use source fingerprints.
- Pin order starts empty and uses the existing featured category names.
- Existing Button does not implement `asChild` or icon sizing: links use
  `buttonVariants` directly and new icon buttons have explicit dimensions.

## Validation

- Full Node suite: **262 passed, one skipped, zero failed** (263 total).
- Production Vite build passed with existing bundle-size/Browserslist warnings.
- New files, Browse and modified helpers/cards/tests pass ESLint without warnings.
  All changed JS/JSX/test files have zero lint errors; 29 existing warnings remain
  in Home, Download and app.
- Repository-wide lint remains affected by the existing unmatched
  `scripts/*.cjs` glob and the unrelated undefined `app` in
  `electron/modules/library/games.js:1537`.
- Touched JS/JSX/tests pass Prettier checks; `git diff --check` passes.
- Tests cover complete category/shelf results, composed filters, unknown sizes,
  imported installs, lookup failure/retry, pin order/persistence, source-isolated
  bounded history, stale records, recommendations and focus restoration.
- A headless Chrome fixture using the real Layout, route transitions, natural
  scrolling hook and discovery components verified a keyboard-opened game and
  recommendation chain returned to the same filtered list, URL, count, focus and
  exact vertical anchor. User wheel input cancelled delayed restoration.
- Inspected layouts at 1024x768, 1280x720 and 1920x1080, including dark mode and
  missing artwork; checked viewports had no horizontal overflow or page errors.
- Browser tests use synthetic catalog/settings/artwork boundaries. Full native
  interaction with real providers, RTL labels and actual downloads/game launches
  is not claimed by these checks.

## Local desktop verification

The existing desktop installation was updated with the validated production
renderer and reopened. The update retained a rollback archive and verified
16,614 unchanged archive files, 217 renderer assets, preserved backend
configuration/preload/build metadata, matching served HTML/Browse code, and
normal window startup. No executable fuse was changed and no official release
was published. Installation backups and local test tooling are excluded from Git.
