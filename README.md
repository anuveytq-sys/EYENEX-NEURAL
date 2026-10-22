# EYENEX NEURAL

**A modular AI command-center concept** for task planning, project intelligence, research, and coordinated workflows.

> Current status: interactive frontend prototype with optional OpenRouter BYOK (bring your own key) connection. Live AI works after a user enters and tests their own OpenRouter key in Settings. The key is stored in that browser's local storage when the user chooses Save locally.

## Two environments

### 01 — Neural Core
The central command workspace. With OpenRouter configured, messages are sent to the selected model for live responses. Planning-style commands also add draft workflow steps to the local Mission Queue. Without a key, the local rule-based planner remains available.

### 02 — Intelligence Lab
A focused analysis desk. When OpenRouter is configured, the selected model produces an AI-assisted analysis using the user's supplied text and selected options. Without a key or when a request fails, the local checklist template remains available.

The two environments share one compact navigation system. Panels have independent scroll areas and height limits so long content does not take over the full screen. The layout adapts to desktop and mobile viewports.

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
- The browser calls OpenRouter directly. This is suitable for a personal prototype, but before a broad public release, prefer a secure server-side proxy or a user-controlled authorization flow rather than asking all users to store long-lived keys in a web page.
- The UI does not execute external actions, inspect local files, or read GitHub repositories automatically. AI responses are model-generated and should be reviewed.

## Current working features

- Responsive dark interface with a CSS 3D-inspired neural core visualization.
- Exactly two environment views with shared navigation.
- Scrollable Settings drawer with close button, API-key field, model ID field, Test API key, Save locally, show/hide key, and remove saved key controls.
- OpenRouter chat completions for Neural Core and AI-assisted analysis in Intelligence Lab.
- Opt-in public GitHub repository reconnaissance in Intelligence Lab: repository metadata, README excerpt, and a capped file-path map.
- Repository reconnaissance is read-only and user-initiated; it does not download or execute source files, modify a repository, or access private repositories.
- Sending the fetched public repository summary to OpenRouter requires a separate unchecked-by-default consent checkbox. Without consent, the scan remains local to the browser.
- Key verification through OpenRouter's authenticated key-information endpoint.
- Local fallback planner and structured analysis outline.
- Rule-based draft task plans for planning-style commands.
- Mission queue with task status cycling, individual task removal, clear-queue control, and sample workflow.
- Mission queue persisted in the current browser using localStorage (not synced across devices).
- Independent scrollable panels, compact height limits, and visible scrollbar styling.
- System status distinguishes configured/connected AI from a local-only state.
- About dialog and reduced-motion support.

## Run locally

This is a static frontend prototype and does not need a build step.

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static server.
3. Open Settings, enter your own OpenRouter key, test it, and save locally.
4. Do not share the browser profile or device while the key is saved. Remove the key from Settings when finished if you do not want it stored.

## Roadmap

1. **Foundation and compact workspace:** two focused environments, panel scrolling, local mission planning, and structured outline templates. *(Complete in prototype.)*
2. **OpenRouter BYOK connection:** direct browser chat and analysis with a locally saved user key. *(Implemented; requires user-supplied key and real-device testing.)*
3. **Safer public AI architecture:** introduce a secure server-side proxy or a user-controlled authorization flow before a broad public launch. Never place a shared private API key in frontend code or Git.
4. **Project intelligence:** public GitHub repository reconnaissance is now implemented for metadata, README excerpts, and file maps. Deeper source-file review and private-repository access remain future work and require explicit permissioned integration.
5. **Task orchestration:** add reliable execution logs, approval checkpoints, permissions, and safe recovery before any consequential actions.
6. **Multimodal controls:** optional camera-based eye/head tracking with calibration, smoothing, pause control, and deliberate blink confirmation.
7. **Publishing:** GitHub Pages can host the static frontend. Keep server-side AI calls and secrets outside the published frontend.

## Architecture direction

Keep the frontend modular and the number of visible panels low. Treat each environment as a focused workspace, with shared navigation, shared task state, and clearly defined integration boundaries. External actions should be permissioned and consequential changes should require user confirmation.

## Repository

https://github.com/anuveytq-sys/EYENEX-NEURAL
