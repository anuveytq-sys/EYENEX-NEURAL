# EYENEX NEURAL

**A modular AI command-center concept** for task planning, project intelligence, research, and coordinated workflows.

> Current status: interactive frontend prototype. Local planning, browser-persisted mission tasks, status changes, and structured analysis templates work without a backend. A live AI provider, external project access, autonomous execution, and eye/head tracking are not connected.

## Two environments

### 01 — Neural Core
The central command workspace. Rule-based local prompts can create a draft workflow, and the mission queue lets you advance tasks through Ready → In Progress → Done, remove individual tasks, and clear the queue.

### 02 — Intelligence Lab
A focused analysis desk that creates a local checklist from a question. Options control whether the outline includes key points, assumptions to verify, and next steps.

The two environments intentionally share one compact navigation system. Panels have independent scroll areas and height limits so long content does not take over the full screen. The layout adapts to desktop and mobile viewports.

## Current working features

- Responsive dark interface with a CSS 3D-inspired neural core visualization.
- Exactly two environment views with shared navigation.
- Local command interface with explicit disclosure that live AI is not connected.
- Rule-based draft task plans for planning-style commands.
- Mission queue with task status cycling, individual task removal, clear-queue control, and sample workflow.
- Mission queue persisted in the current browser using localStorage (not synced across devices).
- Analysis outline with user-selectable key points, assumption checks, and next-step sections.
- Independent scrollable panels, compact height limits, and visible scrollbar styling.
- System-status indicators that distinguish working local UI from integrations that are not configured.
- About dialog and reduced-motion support.

## Important limitations

This is not connected to an AI model and does not inspect repositories, files, or external sources. The local planner uses simple rules and templates; its output is not AI-generated or verified. Mission items are planning records only—no commands are executed and no external changes are made. Browser storage can be cleared by the browser and does not synchronize between devices.

## Run locally

This is a static frontend prototype and does not need a build step.

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static server.
3. Internet access is only used for optional Google Fonts; system font fallbacks are included.

## Roadmap

1. **Foundation and compact workspace:** two focused environments, panel scrolling, local mission planning, and structured outline templates. *(Current prototype.)*
2. **Secure AI connection:** add a provider adapter and server-side proxy. Never place private API keys in browser code or commit them to Git.
3. **Project intelligence:** add explicit, permissioned repository/file connections and analysis tools.
4. **Task orchestration:** add reliable execution logs, approval checkpoints, permissions, and safe recovery before any consequential actions.
5. **Multimodal controls:** optional camera-based eye/head tracking with calibration, smoothing, pause control, and deliberate blink confirmation.
6. **Publishing:** configure GitHub Pages once the project is ready. GitHub Pages serves static files; secrets and server-side AI calls must live outside the published frontend.

## Architecture direction

Keep the frontend modular and the number of visible panels low. Treat each environment as a focused workspace, with shared navigation, shared task state, and clearly defined integration boundaries. External actions should be permissioned and consequential changes should require user confirmation.

## Repository

https://github.com/anuveytq-sys/EYENEX-NEURAL
