# Improvement Log

## 2026-03-27

### Completed in this iteration

- Added baseline Vitest coverage for projection calculations
- Added jsdom-backed tests for the local storage sync helper
- Removed the stale unused `src/composables/useFilters.ts` file
- Refreshed the Ralph code index after the cleanup
- Preserved this work in a reusable Ralph spec under `specs/continuous-improvement-loop/`
- Added summary cards for total income, total expenses, net result, and ending balance
- Wired currency and locale preferences into the dashboard and input formatting
- Surfaced start month and theme controls from existing UI store state
- Added tests for the UI store and currency preference flow
- Added saveable scenarios so plans can be named, reloaded, and deleted
- Preserved compatibility with older stored projection data while expanding the scenario state shape
- Added insight cards that explain deficits, long horizons, and strong ending balances
- Added a sparkline trend preview for cumulative balance direction
- Added scenario export/import so saved plans can be backed up and restored
- Expanded automated coverage for trend rendering inputs and scenario backup flows
- Added scenario rename and overwrite flows so saved plans are easier to maintain
- Added break-even guidance that tells deficit plans the exact monthly gap to close
- Expanded automated coverage for scenario maintenance and break-even helpers
- Added component-level tests for the projection dashboard surface
- Added action-oriented next-move prompts for saving baselines, balancing plans, and shortening long horizons
- Made scenario imports skip exact duplicates and auto-rename name collisions
- Added milestone cards for the first negative month and peak balance
- Turned the empty scenario shelf into a more guided first-step state
- Added a portable text summary builder for the active projection
- Added copy and download actions so the current plan can be shared outside the app
- Added a visible preview block for the share-ready snapshot
- Split the dashboard into overview, saved plans, and details sections instead of stacking everything into one long page
- Refocused the default view on the current plan, the main signal, and the next action
- Moved dense secondary content like the full insight list and monthly table behind on-demand navigation
- Reframed the app inside a more polished product shell with ambient depth and live status badges
- Added a stronger planning hero that summarizes the current plan before the form takes over
- Upgraded gradients, surfaces, and motion so the interface feels more premium and deliberate

### What improved

- `npm test` now provides a real quality signal instead of failing due to missing tests
- The source tree is slightly cleaner and less misleading for future contributors
- The project now has a written place to capture future improvements intentionally
- The projection page now feels more like a dashboard and less like a bare calculation form
- Previously hidden preferences and state controls are now visible and usable
- The app now supports comparing multiple saved plans instead of forcing a single active scenario
- The dashboard now gives planning guidance instead of only rendering raw values
- Saved scenarios are now portable instead of being trapped in one browser's local storage
- The trend line makes balance direction easier to read at a glance
- The scenario shelf is easier to manage without recreating plans from scratch
- Deficit states now suggest a concrete monthly adjustment instead of only warning that the plan is negative
- The main dashboard surface is now covered by component tests, not only unit-level helpers
- Imported scenario shelves stay cleaner when files contain repeated or colliding plan names
- Key timeline moments now stand out without scanning the whole table
- First-time users get a more obvious path to their first saved scenario
- The app now produces a lightweight summary that can be pasted into chat, email, or notes without screenshots
- The app now feels less overwhelming because secondary information no longer competes with the first decision a user needs to make
- The app now feels more like a professional planning tool and less like a utility page with stacked cards

### Dream About What To Do Next

- Add E2E or higher-level interaction tests for the projection flow
- Add scenario comparison views for saved plans
- Add a more polished printable one-page report layout
- Add a guided first-run flow that helps a new user create one sensible baseline plan quickly
