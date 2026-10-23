/* EYENEX NEURAL — Mission Intelligence & Live Telemetry.
   Additive command layer: uses existing command composer and existing status surfaces.
   Does not alter panel geometry, queue state, camera controls, or external services. */
(() => {
  'use strict';
  if (window.__eyenexMissionIntelligence) return;
  window.__eyenexMissionIntelligence = true;

  const $ = (s, r = document) => r.querySelector(s);
  const commandForm = $('#commandForm');
  const commandInput = $('#commandInput');
  const conversation = $('#conversation');
  const missionKey = 'eyenex-neural-missions-v1';
  const focusKey = 'eyenex-neural-focus-v1';
  const states = ['READY', 'IN PROGRESS', 'DONE', 'FAILED'];
  const started = performance.now();
  let frames = 0, fps = 0, lastFpsAt = performance.now(), frameId = 0;
  let lastCommandAt = 0;

  if (!commandForm || !commandInput || !conversation) return;

  const safeRead = (key, fallback) => {
    try { const value = JSON.parse(localStorage.getItem(key) || ''); return value == null ? fallback : value; }
    catch (_) { return fallback; }
  };
  const missions = () => {
    const value = safeRead(missionKey, []);
    return Array.isArray(value) ? value.filter(m => m && typeof m.title === 'string').slice(0, 80) : [];
  };
  const stamp = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const lineBreaks = value => esc(value).replace(/\n/g, '<br>');
  function say(text, label = 'MISSION INTELLIGENCE') {
    const row = document.createElement('div');
    row.className = 'message system-message mi-message';
    row.style.marginTop = '12px';
    const mark = document.createElement('span');
    mark.className = 'message-mark';
    mark.textContent = 'E';
    const body = document.createElement('div');
    const meta = document.createElement('small');
    meta.textContent = label + '  ' + stamp();
    const p = document.createElement('p');
    p.innerHTML = lineBreaks(text);
    p.style.whiteSpace = 'normal';
    body.append(meta, p);
    row.append(mark, body);
    conversation.appendChild(row);
    conversation.scrollTop = conversation.scrollHeight;
  }
  function notify(text) {
    const toast = $('#toast');
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 2400);
  }
  function getStats() {
    const list = missions();
    const counts = Object.fromEntries(states.map(state => [state, list.filter(m => (m.state || 'READY') === state).length]));
    const storageBytes = (() => {
      try {
        let total = 0;
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i) || '';
          total += (key.length + (localStorage.getItem(key) || '').length) * 2;
        }
        return total;
      } catch (_) { return 0; }
    })();
    const memory = performance.memory && Number.isFinite(performance.memory.usedJSHeapSize)
      ? Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB JS heap'
      : 'JS heap unavailable in this browser';
    return {
      list, counts, storageBytes, memory,
      online: navigator.onLine,
      viewport: Math.round(window.innerWidth) + ' × ' + Math.round(window.innerHeight),
      dpr: window.devicePixelRatio || 1,
      uptime: Math.max(0, Math.round((performance.now() - started) / 1000)),
      focus: safeRead(focusKey, '')
    };
  }
  function priorityFor(mission) {
    const text = (mission.title + ' ' + (mission.detail || '')).toLowerCase();
    let score = 35;
    if (/urgent|critical|blocker|security|broken|failure|fix|error|crash|restore/.test(text)) score += 35;
    if (/deploy|release|publish|production|deadline|submit/.test(text)) score += 20;
    if (/test|verify|validate|review|check/.test(text)) score += 12;
    if (/later|optional|nice.to.have|polish/.test(text)) score -= 15;
    if (mission.state === 'FAILED') score += 35;
    if (mission.state === 'IN PROGRESS') score += 10;
    if (mission.state === 'DONE') score = 0;
    return Math.max(0, Math.min(100, score));
  }
  function telemetry() {
    const s = getStats();
    const pct = s.list.length ? Math.round(s.counts.DONE / s.list.length * 100) : 0;
    return [
      'SYSTEM TELEMETRY / LOCAL READOUT',
      'Connectivity: ' + (s.online ? 'ONLINE' : 'OFFLINE — local features remain available'),
      'Viewport: ' + s.viewport + ' · pixel ratio ' + Number(s.dpr).toFixed(2),
      'Browser storage estimate: ' + (s.storageBytes / 1024).toFixed(1) + ' KB across this site’s local keys',
      'Runtime: ' + Math.floor(s.uptime / 60) + 'm ' + (s.uptime % 60) + 's · ' + s.memory,
      'Mission queue: ' + s.list.length + '/80 · ready ' + s.counts.READY + ' · running ' + s.counts['IN PROGRESS'] + ' · done ' + s.counts.DONE + ' · failed ' + s.counts.FAILED,
      'Completion ratio: ' + pct + '% of currently queued missions',
      'Data boundary: browser-local queue and browser-reported metrics only; no external system is probed.'
    ].join('\n');
  }
  function diagnose() {
    const s = getStats();
    const issues = [];
    if (!s.online) issues.push('Network is offline. Local planning, queue history, and backups can still work.');
    if (s.counts.FAILED) issues.push(s.counts.FAILED + ' failed mission(s) need review before retry.');
    if (s.counts['IN PROGRESS'] > 1) issues.push('More than one task is marked in progress. Confirm the intended active task.');
    if (s.list.length >= 80) issues.push('Queue is at its 80-mission capacity. Export a backup before removing items.');
    if (s.list.some(m => !m.title.trim())) issues.push('A mission has an empty title. Review the queue data before export or restore.');
    if (!$('#settingsDialog') || !$('#openRouterKey')) issues.push('AI settings controls were not found in the current page.');
    if (s.online && !navigator.mediaDevices?.getUserMedia) issues.push('This browser does not expose camera capture. Multimodal controls may be unavailable here.');
    if (!issues.length) issues.push('No obvious local-state warning found. This is a lightweight browser-side check, not a security audit or proof that every feature is working.');
    return 'LOCAL DIAGNOSTIC\n' + issues.map((x, i) => (i + 1) + '. ' + x).join('\n') +
      '\n\nNo files, API keys, camera frames, or external services were inspected by this diagnostic.';
  }
  function missionIntel() {
    const s = getStats();
    if (!s.list.length) return 'MISSION INTELLIGENCE\nThe queue is empty. Describe a goal in the command box to create a local plan, or use “Load sample workflow” to explore the orchestration controls.';
    const ranked = s.list.map((m, i) => ({ ...m, originalIndex: i, priority: priorityFor(m) }))
      .filter(m => m.priority > 0 && m.state !== 'DONE')
      .sort((a, b) => b.priority - a.priority);
    const lines = ['MISSION INTELLIGENCE / HEURISTIC PRIORITY', s.list.length + ' mission(s) · ' + s.counts.DONE + ' complete · ' + s.counts.FAILED + ' failed'];
    if (s.counts.FAILED) lines.push('RECOVERY FIRST: review failed missions and their error notes before starting more work.');
    if (ranked.length) {
      lines.push('Suggested review order (rule-based, not AI certainty):');
      ranked.slice(0, 4).forEach((m, i) => lines.push((i + 1) + '. [' + m.priority + '/100] ' + m.title + ' — ' + (m.state || 'READY')));
    } else lines.push('No unfinished mission currently stands out by the local priority rules.');
    if (s.counts.READY > 0 && !s.counts['IN PROGRESS']) lines.push('Next step: choose one READY task, review its details, then start it through the existing workflow controls.');
    lines.push('Priority is estimated from task wording and status; it does not infer deadlines, dependencies, or real-world impact.');
    return lines.join('\n');
  }
  function help() {
    return [
      'NEURAL COMMANDS / TYPE IN THIS SAME COMMAND BOX',
      '/telemetry — browser and mission-queue status readout',
      '/diagnose — quick local checks and recovery hints',
      '/mission-intel — rank unfinished missions using transparent text rules',
      '/focus <goal> — save a local objective for this browser',
      '/focus — show the saved objective',
      '/focus clear — remove the saved objective',
      '/core pulse — add a subtle temporary glow to the existing core visualization',
      '/core normal — return the core to its normal appearance',
      '/help — show this command list',
      '',
      'Normal questions and task-planning prompts continue through the existing command system. These commands do not run external actions.'
    ].join('\n');
  }
  function setCoreMode(mode) {
    document.body.classList.toggle('mi-core-pulse', mode === 'pulse');
    if (mode === 'pulse') {
      clearTimeout(setCoreMode.timer);
      setCoreMode.timer = setTimeout(() => document.body.classList.remove('mi-core-pulse'), 30000);
      notify('Neural core pulse enabled for 30 seconds.');
    } else {
      clearTimeout(setCoreMode.timer);
      document.body.classList.remove('mi-core-pulse');
      notify('Neural core returned to normal mode.');
    }
  }
  function execute(raw) {
    const command = raw.trim();
    const lower = command.toLowerCase();
    if (lower === '/telemetry' || lower === '/status') { say(telemetry()); return true; }
    if (lower === '/diagnose' || lower === '/diagnostics') { say(diagnose()); return true; }
    if (lower === '/mission-intel' || lower === '/prioritize') { say(missionIntel()); return true; }
    if (lower === '/help' || lower === '/commands') { say(help()); return true; }
    if (lower === '/core pulse') { setCoreMode('pulse'); say('Neural core pulse mode enabled temporarily. Panel dimensions, core controls, and tracking are unchanged.'); return true; }
    if (lower === '/core normal') { setCoreMode('normal'); say('Neural core is back to its default visual state.'); return true; }
    if (lower === '/focus' ) {
      const current = safeRead(focusKey, '');
      say(current ? 'CURRENT FOCUS\n' + current : 'No focus objective is saved. Use /focus followed by your current goal.');
      return true;
    }
    if (lower === '/focus clear' || lower === '/clear-focus') {
      localStorage.removeItem(focusKey);
      say('Saved focus objective cleared.');
      return true;
    }
    if (lower.startsWith('/focus ')) {
      const value = command.slice(7).trim().slice(0, 240);
      if (!value) { say('Add a goal after /focus. Example: /focus finish and verify the current mission queue.'); return true; }
      localStorage.setItem(focusKey, JSON.stringify(value));
      say('FOCUS OBJECTIVE SAVED\n' + value + '\nThis is a local reminder; it does not change mission status or trigger actions.');
      return true;
    }
    return false;
  }

  commandForm.addEventListener('submit', event => {
    const raw = commandInput.value || '';
    if (!raw.trim().startsWith('/')) return;
    const command = raw.trim();
    // Only intercept recognized slash commands; unknown commands continue to the original handler.
    const known = /^\/(telemetry|status|diagnose|diagnostics|mission-intel|prioritize|help|commands|core\s+(pulse|normal)|focus(?:\s|$)|clear-focus)(?:\s|$)/i.test(command);
    if (!known) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (Date.now() - lastCommandAt < 250) return;
    lastCommandAt = Date.now();
    const user = document.createElement('div');
    user.className = 'message user-message';
    const body = document.createElement('div');
    const p = document.createElement('p');
    p.textContent = command;
    body.appendChild(p);
    user.appendChild(body);
    conversation.appendChild(user);
    try { execute(command); }
    catch (error) { say('Command could not complete safely. ' + (error && error.message ? error.message : 'Unexpected local error.'), 'LOCAL DIAGNOSTIC'); }
    commandInput.value = '';
    conversation.scrollTop = conversation.scrollHeight;
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .mi-message p{line-height:1.65;overflow-wrap:anywhere}
    .mi-core-pulse .core-visual{filter:drop-shadow(0 0 12px rgba(38,204,255,.18))}
    .mi-core-pulse #neuralCoreCanvas{filter:brightness(1.12) saturate(1.12)}
    .mi-core-pulse .core-halo{box-shadow:0 0 55px rgba(0,205,255,.23),inset 0 0 28px rgba(0,205,255,.08)}
    @media(prefers-reduced-motion:reduce){.mi-core-pulse .core-visual{filter:none}.mi-core-pulse #neuralCoreCanvas{filter:none}}
  `;
  document.head.appendChild(style);

  // Refresh only existing status text; do not add rows or change panel dimensions.
  function updateExistingStatus() {
    const panel = $('.system-panel');
    if (!panel) return;
    const rows = panel.querySelectorAll('.status-list > div');
    if (rows.length >= 2) {
      const onlineValue = rows[0].querySelector('strong');
      if (onlineValue) {
        onlineValue.textContent = navigator.onLine ? 'OPERATIONAL' : 'OFFLINE / LOCAL';
        onlineValue.classList.toggle('status-good', navigator.onLine);
      }
      const plannerValue = rows[1].querySelector('strong');
      if (plannerValue) {
        const s = getStats();
        plannerValue.textContent = s.counts.FAILED ? 'REVIEW REQUIRED' : 'READY';
        plannerValue.classList.toggle('status-good', !s.counts.FAILED);
      }
    }
    const foot = $('.system-foot');
    const footLabel = foot && foot.querySelector('span:last-child');
    if (footLabel) {
      const s = getStats();
      footLabel.textContent = (navigator.onLine ? 'ONLINE' : 'OFFLINE') + ' · ' + s.list.length + '/80 MISSIONS';
      footLabel.title = 'Local browser telemetry; no external host is monitored.';
    }
  }
  window.addEventListener('online', updateExistingStatus);
  window.addEventListener('offline', updateExistingStatus);
  window.addEventListener('storage', event => { if (!event.key || event.key === missionKey) updateExistingStatus(); });
  updateExistingStatus();
  setInterval(updateExistingStatus, 5000);

  // Low-cost frame-rate sample used only as an optional local telemetry hint.
  function sampleFrames(now) {
    frames++;
    if (now - lastFpsAt >= 1000) {
      fps = Math.round(frames * 1000 / (now - lastFpsAt));
      frames = 0; lastFpsAt = now;
      document.documentElement.dataset.eyenexFps = String(fps);
    }
    frameId = requestAnimationFrame(sampleFrames);
  }
  if (!document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) frameId = requestAnimationFrame(sampleFrames);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && frameId) { cancelAnimationFrame(frameId); frameId = 0; }
    else if (!document.hidden && !frameId && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) frameId = requestAnimationFrame(sampleFrames);
  });
})();
