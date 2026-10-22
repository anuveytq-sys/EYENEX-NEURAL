# EYENEX NEURAL

**A modular AI command-center concept** for task planning, project intelligence, research, and coordinated workflows.

> Current status: frontend concept build. The interface is interactive, but no AI provider, external project access, autonomous execution, or eye/head tracking is connected yet.

## Two environments

### 01 — Neural Core
The central command workspace for natural-language instructions, workflow planning, and mission status.

### 02 — Intelligence Lab
A focused analysis desk that structures a question into a local outline, with a conceptual reasoning map and trust principles.

The two environments intentionally share one compact navigation system. The interface avoids a crowded dashboard by keeping only the panels needed for the current task.

## Current prototype features

- Responsive, futuristic dark UI with CSS-based 3D-inspired neural core visualization.
- Two environment views with independent navigation.
- Local command conversation demo with clear disclosure that live AI is not connected.
- Sample mission queue.
- Local analysis outline generator with explicit demo labeling.
- System-status indicators that distinguish operational UI from integrations that are not configured.
- About dialog and responsive layouts for desktop and mobile.

## Run locally

This is a static frontend prototype and does not need a build step.

1. Clone or download this repository.
2. Open `index.html` in a modern browser, or serve the folder with a local static server.
3. Internet access is only used for optional Google Fonts; system font fallbacks are included.

## Roadmap

1. **Foundation:** establish the two-environment interface and interaction patterns. *(Current prototype.)*
2. **AI connection:** add a provider adapter and secure server-side proxy. Never place private API keys in browser code or commit them to Git.
3. **Project intelligence:** add explicit, permissioned repository/file connections and analysis tools.
4. **Task orchestration:** implement plans, task state, execution logs, approval checkpoints, and safe recovery.
5. **Multimodal controls:** add optional camera-based eye/head tracking with calibration, smoothing, pause control, and deliberate blink confirmation.
6. **Publishing:** configure GitHub Pages once the project is ready to publish. GitHub Pages serves static files; secrets and server-side AI calls must live outside the published frontend.

## Architecture direction

Keep the frontend modular and the number of visible panels low. Treat each environment as a focused workspace, with shared navigation, shared task state, and clearly defined integration boundaries. External actions should be permissioned and consequential changes should require user confirmation.

## Repository

https://github.com/anuveytq-sys/EYENEX-NEURAL
