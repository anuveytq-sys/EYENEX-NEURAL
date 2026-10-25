# EYENEX NEURAL

**A modular AI command-center concept** for task planning, project intelligence, research, and coordinated workflows.

> Current status: interactive frontend prototype with optional OpenRouter BYOK (bring your own key) connection. Live AI works after a user enters and tests their own OpenRouter key in Settings. The key is stored in that browser's local storage when the user chooses Save locally.

## Two environments

### 01 — Neural Core
The central command workspace. With OpenRouter configured, messages are sent to the selected model for live responses. Planning-style commands also add draft workflow steps to the local Mission Queue. Without a key, the local rule-based planner remains available.

### 02 — Intelligence Lab
A focused analysis desk. When OpenRouter is configured, the selected model produces an AI-assisted analysis using the user's supplied text and selected options. Without a key or when a request fails, the local checklist template remains available.

The two environments share one compact navigation system. Panels have independent scroll areas and height limits so long content does not take over the full screen. The layout adapts to desktop and mobile viewports.

## Hands-free File Hub

The Settings drawer includes an optional local file-selection panel for choosing multiple files from the Windows file picker. It displays file names and sizes and previews supported images/videos locally. The panel does not upload files or store them persistently; the selection is limited to the current page session.

**Native file-picker limitation:** a browser page cannot move its custom webcam-driven head cursor into the separate Windows file-picker dialog or synthesize system-wide blink clicks. When the picker is open, use keyboard navigation or Windows Eye Control if the PC has a supported eye-tracking device configured. Microsoft's Eye Control can navigate Windows UI with dwell-based selection on supported setups: https://support.microsoft.com/en-us/accessibility/windows/eye-control/eye-control-basics-in-windows

For the existing webcam head-and-blink controls to operate across native Windows dialogs and other desktop apps, EYENEX would need a separately installed, explicitly permissioned Windows desktop companion using supported accessibility/input APIs. This web-only change does not install such a companion and does not claim system-wide control.

## OpenRouter settings

Use the **Settings** button in the top-right corner to open the scrollable settings drawer.

1. Enter an OpenRouter API key.
2. Optionally change the model ID (default: `openrouter/auto`).
3. Click **Test API key** to verify authentication with OpenRouter's key-information endpoint. This test does not generate a model response.
4. Click **Save locally** to store the key and model in this browser.
5. Close the drawer with the × button. Chat and analysis can now use OpenRouter.

The settings panel also supports showing/hiding the currently typed key and removing a saved key. The actual key is never included in this repository's source files.

### Important key-safety notes

- The key is stored in browser `localStorage`; this is convenient but **not encrypted secure storage**. JavaScript running on this site can access it.
- Use only on a device and browser profile you control. Do not paste your key into chats or commit it to GitHub.
- Set a spending limit for the key in OpenRouter. The selected model may charge for requests; availability and pricing depend on the model and account.
- The browser calls OpenRouter directly. This is suitable for a personal prototype, but before a broad public release, prefer the server-side proxy boundary in `api/ai.js` with `OPENROUTER_API_KEY` stored as a server environment variable rather than asking public users to store a long-lived key in a web page.
- The UI does not execute external actions, inspect local files, or read GitHub repositories automatically. AI responses are model-generated and should be reviewed.

## Current working features

- Responsive dark interface with a CSS 3D-inspired neural core visualization.
- **Cinematic HUD Atmosphere:** animated depth-layered starfield, subtle connected intelligence mesh, perspective telemetry grid, volumetric nebula lighting, edge vignette, and pointer-responsive parallax. This is a decorative background layer only: it does not resize, reposition, or intercept interaction with any panel.
- Atmosphere is lightweight canvas/CSS, uses no external image assets or network calls, pauses while the page is hidden, caps pixel ratio/particle count, and respects reduced-motion preferences.
- **Mission Intelligence command layer:** adds `/telemetry`, `/diagnose`, `/mission-intel`, `/focus <goal>`, `/focus clear`, `/core pulse`, `/core normal`, and `/help` to the existing command composer. These commands are additive; ordinary prompts still flow through the original command handler.
- **Live local telemetry:** reports browser connectivity, viewport, pixel ratio, local storage estimate, runtime, and mission-state counts. It updates existing Core Status text without adding rows or changing panel geometry.
- **Mission triage:** transparent rule-based prioritization highlights unfinished/failed tasks for human review. It does not claim to understand deadlines or dependencies that are not in the queue.
- **Quick diagnostics:** checks common local queue and browser availability conditions, explains likely recovery steps, and clearly states its limits.
- **Focus objective:** a short user-defined objective can be stored and retrieved locally in this browser.
- **Neural core pulse:** temporarily adds a restrained glow to the existing visualization; it does not replace the 3D renderer or affect camera/gesture systems.
- Exactly two environment views with shared navigation.
- Scrollable Settings drawer with close button, API-key field, model ID field, Test API key, Save locally, show/hide key, and remove saved key controls.
- OpenRouter chat completions for Neural Core and AI-assisted analysis in Intelligence Lab.
- Opt-in public GitHub repository reconnaissance in Intelligence Lab: repository metadata, README excerpt, and a capped file-path map.
- **Bounded read-only source intelligence:** the published build adds a compact Deep Review module that reads a capped set of public source files, builds an architecture-oriented source map, and flags high-signal security, reliability, and performance smells without executing or modifying source code.
- Repository reconnaissance and source review are user-initiated and public-only; they do not modify repositories, execute fetched code, or access private repositories.
- Sending the fetched public repository summary to OpenRouter requires a separate unchecked-by-default consent checkbox. Without consent, the scan remains local to the browser.
- Key verification through OpenRouter's authenticated key-information endpoint.
- Local fallback planner and structured analysis outline.
- Rule-based draft task plans for planning-style commands.
- Mission queue with task status cycling, individual task removal, clear-queue control, and sample workflow.
- Mission queue persisted in the current browser using localStorage (not synced across devices).
- **Mission Vault:** compact search and status filters, JSON export/import with merge-and-deduplicate behavior, automatic safety snapshots before clearing or importing, and explicit snapshot restore with a pre-restore export. Backups stay in the browser or the file the user chooses; no queue data is uploaded.
- Local task orchestration with execution timeline, human approval checkpoints, recovery state, and audit trail. It does not execute consequential external actions.
- Optional camera-based head-pointer and eye-gaze control using face/iris landmarks, center calibration, smoothing, pause/resume, and opt-in blink confirmation. Tracking can continue after the Settings dialog closes and is stopped only with Stop camera or when the page is refreshed/closed. Camera frames are processed locally in the browser and are not saved or uploaded by this feature.
- Independent scrollable panels, compact height limits, and visible scrollbar styling.
- System status distinguishes configured/connected AI from a local-only state.
- About dialog and reduced-motion support.

## Secure deployment path

`api/ai.js` provides an optional server-side OpenRouter proxy for a Vercel-style serverless deployment. The upstream API key is read only from the server environment (`OPENROUTER_API_KEY`) and is never placed in the published frontend. The proxy accepts bounded chat messages, checks the allowed browser origin, and forwards the request to OpenRouter.

The current GitHub Pages build remains backward-compatible with the existing personal BYOK flow. The proxy file is an architecture boundary for a later secure deployment; GitHub Pages itself does not execute server-side JavaScript.

## Run locally

This is a static frontend prototype and does not need a build step.

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static server.
3. Open Settings, enter your own OpenRouter key, test it, and save locally.
4. Do not share the browser profile or device while the key is saved. Remove the key from Settings when finished if you do not want it stored.

## Roadmap

1. **Foundation and compact workspace:** two focused environments, panel scrolling, local mission planning, and structured outline templates. *(Complete in prototype.)*
2. **OpenRouter BYOK connection:** direct browser chat and analysis with a locally saved user key. *(Implemented; requires user-supplied key and real-device testing.)*
3. **Safer public AI architecture:** server-side proxy boundary added in `api/ai.js`; deploy it on a serverless host and store the provider key as a server environment variable before a broad public launch.
4. **Project intelligence:** public GitHub reconnaissance and bounded source-file review are implemented. Deeper/private repository access still requires explicit permissioned integration.
5. **Task orchestration:** reliable local execution timeline, human approval checkpoint, recovery state, and audit trail are implemented. Consequential external actions remain intentionally gated.
6. **Multimodal controls:** optional camera-based head-pointer and eye-gaze tracking with center calibration, smoothing, pause/resume, persistent tracking across Settings close, and opt-in blink confirmation. *(Implemented as an opt-in browser feature; real-device testing is required.)*
7. **Mission continuity:** Mission Vault adds local search/status filters, portable JSON backups, import/merge, automatic snapshots before destructive queue changes, and user-confirmed recovery. Existing queue and tracking code paths remain separate.
8. **Cinematic HUD atmosphere:** a responsive animated depth field, parallax star points, perspective grid, and ambient lighting layer. It is layered behind the current interface to preserve existing panel geometry and controls.
9. **Mission Intelligence:** local telemetry, quick diagnostics, rule-based queue triage, saved focus objective, and temporary neural-core pulse commands. These work through the existing command composer and status panel without introducing new panels.
10. **Publishing:** GitHub Pages hosts the static frontend. The Pages workflow validates the source-intelligence, Mission Vault, atmosphere, and Mission Intelligence modules, then injects them into the published artifact without editing the source HUD layout.

## Architecture direction

Keep the frontend modular and the number of visible panels low. Treat each environment as a focused workspace, with shared navigation, shared task state, and clearly defined integration boundaries. External actions should be permissioned and consequential changes should require user confirmation.

## Repository

https://github.com/anuveytq-sys/EYENEX-NEURAL
