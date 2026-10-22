(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = $('#toast');
  let toastTimer;
  const STORAGE_KEY = 'eyenex-neural-missions-v1';
  const states = ['READY', 'IN PROGRESS', 'DONE'];

  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function updateClock() {
    $('#clock').textContent = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  updateClock();
  setInterval(updateClock, 1000);

  function setEnvironment(name) {
    const isCore = name === 'core';
    $('#coreEnvironment').classList.toggle('active', isCore);
    $('#labEnvironment').classList.toggle('active', !isCore);
    document.body.dataset.environment = isCore ? 'core' : 'lab';
  }
  document.body.dataset.environment = 'core';

  const conversation = $('#conversation');
  const commandInput = $('#commandInput');
  const commandForm = $('#commandForm');
  function appendMessage(kind, label, text) {
    const row = document.createElement('div');
    row.className = 'message ' + (kind === 'user' ? 'user-message' : 'system-message');
    if (kind === 'user') {
      row.innerHTML = '<div><p>' + escapeHTML(text) + '</p></div>';
    } else {
      row.style.marginTop = '16px';
      row.innerHTML = '<span class="message-mark">E</span><div><small>' + escapeHTML(label) + ' <time>LOCAL</time></small><p>' + escapeHTML(text) + '</p></div>';
    }
    conversation.appendChild(row);
    conversation.scrollTop = conversation.scrollHeight;
    return row;
  }

  let missions = [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (Array.isArray(saved)) missions = saved.filter(item => item && typeof item.title === 'string').slice(0, 80).map(item => ({
      id: String(item.id || Date.now() + Math.random()),
      title: item.title.slice(0, 180),
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 180) : 'LOCAL PLAN',
      state: states.includes(item.state) ? item.state : 'READY'
    }));
  } catch (error) {
    missions = [];
  }
  const missionList = $('#missionList');
  function saveMissions() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(missions));
    } catch (error) {
      notify('Browser storage is unavailable; changes will last only until this page closes.');
    }
  }
  function renderMissions() {
    const completed = missions.filter(item => item.state === 'DONE').length;
    $('#missionCount').textContent = String(missions.length).padStart(2, '0');
    $('#missionProgress').textContent = completed + ' of ' + missions.length + ' tasks complete';
    if (!missions.length) {
      missionList.className = 'empty-state';
      missionList.innerHTML = '<div class="empty-symbol">＋</div><strong>No active missions</strong><p>Ask NEURAL to plan a task. Missions are saved in this browser and can be checked off here.</p>';
      return;
    }
    missionList.className = 'mission-items';
    missionList.innerHTML = missions.map((item, index) => {
      const done = item.state === 'DONE';
      return '<div class="mission-item ' + (done ? 'is-done' : '') + '">' +
        '<span class="mission-number">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div><button class="mission-title-button" type="button" data-mission-toggle="' + escapeHTML(item.id) + '" aria-label="Change status for ' + escapeHTML(item.title) + '"><strong>' + escapeHTML(item.title) + '</strong></button><small>' + escapeHTML(item.detail) + ' · ' + escapeHTML(item.state) + '</small></div>' +
        '<button class="mission-state" type="button" data-mission-toggle="' + escapeHTML(item.id) + '" aria-label="Advance task status" title="Advance status">' + (done ? '✓' : item.state === 'IN PROGRESS' ? '◒' : '○') + '</button>' +
        '<button class="mission-remove" type="button" data-mission-remove="' + escapeHTML(item.id) + '" aria-label="Remove task" title="Remove task">×</button>' +
      '</div>';
    }).join('');
  }
  function addMissions(items) {
    const remaining = Math.max(0, 80 - missions.length);
    const additions = items.slice(0, remaining).map((item, index) => ({
      id: String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8) + '-' + index,
      title: item.title,
      detail: item.detail || 'LOCAL PLAN',
      state: 'READY'
    }));
    missions = missions.concat(additions);
    saveMissions();
    renderMissions();
    return additions.length;
  }
  function advanceMission(id) {
    const item = missions.find(mission => mission.id === id);
    if (!item) return;
    item.state = states[(states.indexOf(item.state) + 1) % states.length];
    saveMissions();
    renderMissions();
  }
  missionList.addEventListener('click', event => {
    const toggle = event.target.closest('[data-mission-toggle]');
    const remove = event.target.closest('[data-mission-remove]');
    if (toggle) advanceMission(toggle.dataset.missionToggle);
    if (remove) {
      missions = missions.filter(item => item.id !== remove.dataset.missionRemove);
      saveMissions();
      renderMissions();
      notify('Task removed from the local queue.');
    }
  });
  $('#clearMissions').addEventListener('click', () => {
    if (!missions.length) {
      notify('The mission queue is already empty.');
      return;
    }
    missions = [];
    saveMissions();
    renderMissions();
    notify('Local mission queue cleared.');
  });

  function buildLocalPlan(goal) {
    const normalized = goal.toLowerCase();
    const tasks = [];
    tasks.push({ title: 'Define success for: ' + goal, detail: 'PLANNING' });
    if (/project|website|app|software|code|repository|repo|build|feature|debug|fix/.test(normalized)) {
      tasks.push({ title: 'Inspect current structure and constraints', detail: 'PROJECT REVIEW' });
      tasks.push({ title: 'Break the work into small, testable changes', detail: 'IMPLEMENTATION PLAN' });
      tasks.push({ title: 'Validate behavior and check regressions', detail: 'QUALITY CHECK' });
    } else if (/research|learn|explain|understand|compare|study|investigat/.test(normalized)) {
      tasks.push({ title: 'List the key questions to answer', detail: 'RESEARCH' });
      tasks.push({ title: 'Gather reliable evidence and note uncertainty', detail: 'EVIDENCE REVIEW' });
      tasks.push({ title: 'Summarize findings and unresolved questions', detail: 'SYNTHESIS' });
    } else {
      tasks.push({ title: 'Gather the information and resources needed', detail: 'PREPARATION' });
      tasks.push({ title: 'Identify dependencies, risks, and decisions', detail: 'RISK REVIEW' });
      tasks.push({ title: 'Review the outcome against the goal', detail: 'VALIDATION' });
    }
    tasks.push({ title: 'Review the plan before taking action', detail: 'HUMAN APPROVAL' });
    return tasks;
  }

  const SETTINGS_KEY = 'eyenex-neural-openrouter-settings-v1';
  const API_KEY_KEY = 'eyenex-neural-openrouter-key-v1';
  const MODEL_KEY = 'eyenex-neural-openrouter-model-v1';
  const defaultModel = 'openrouter/auto';
  let aiHistory = [];
  let aiBusy = false;
  let keyVerifiedThisSession = false;

  function getSavedKey() {
    try { return localStorage.getItem(API_KEY_KEY) || ''; } catch (error) { return ''; }
  }
  function getModel() {
    try { return localStorage.getItem(MODEL_KEY) || defaultModel; } catch (error) { return defaultModel; }
  }
  function getActiveKey() {
    const typed = $('#openRouterKey').value.trim();
    return typed || getSavedKey();
  }
  function openRouterHeaders(key) {
    const headers = { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
    if (window.location.protocol === 'https:') headers['HTTP-Referer'] = window.location.href;
    headers['X-OpenRouter-Title'] = 'EYENEX NEURAL';
    return headers;
  }
  async function askOpenRouter(messages) {
    const key = getActiveKey();
    if (!key) throw new Error('Add your OpenRouter API key in Settings, then save it locally.');
    const model = getModel();
    let response;
    try {
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: openRouterHeaders(key),
        body: JSON.stringify({ model, messages, temperature: 0.65, max_tokens: 900, stream: false })
      });
    } catch (error) {
      throw new Error('Could not reach OpenRouter. Check your internet connection and try again.');
    }
    let data = {};
    try { data = await response.json(); } catch (error) { /* response may not contain JSON */ }
    if (!response.ok) {
      const apiMessage = data && data.error && data.error.message;
      if (response.status === 401) throw new Error('OpenRouter rejected this API key. Check the key in Settings.');
      if (response.status === 402) throw new Error('OpenRouter reports insufficient credits or a spending limit. Check your account and key limits.');
      if (response.status === 429) throw new Error('OpenRouter rate limit reached. Wait briefly and retry.');
      throw new Error(apiMessage || ('OpenRouter request failed (HTTP ' + response.status + ').'));
    }
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('The selected model returned an empty response. Try another model ID in Settings.');
    return content.trim();
  }
  function setSettingsFeedback(message, kind) {
    const el = $('#settingsFeedback');
    el.textContent = message;
    el.dataset.kind = kind || 'info';
  }
  function refreshKeyState() {
    const saved = Boolean(getSavedKey());
    const state = $('#keyState');
    state.classList.toggle('is-saved', saved);
    state.innerHTML = '<i></i><span>' + (saved ? 'API key saved in this browser' : 'No API key saved in this browser') + '</span>';
    $('#removeSavedKey').disabled = !saved;
    const status = $('#aiStatus');
    if (status) {
      status.textContent = keyVerifiedThisSession ? 'CONNECTED' : saved ? 'CONFIGURED' : 'NOT CONNECTED';
      status.classList.toggle('status-good', keyVerifiedThisSession || saved);
      status.classList.toggle('status-wait', !keyVerifiedThisSession && !saved);
    }
    const mode = $('#aiModeLabel');
    const hint = $('#aiModeHint');
    if (mode) mode.textContent = saved || $('#openRouterKey').value.trim() ? 'OPENROUTER AI' : 'LOCAL PLANNER';
    if (hint) hint.textContent = saved || $('#openRouterKey').value.trim() ? '· key configured in this browser' : '· live AI not connected';
  }
  function loadSettingsIntoForm() {
    $('#openRouterKey').value = '';
    $('#openRouterKey').placeholder = getSavedKey() ? 'Saved key is stored locally — enter a new key to replace it' : 'sk-or-v1-…';
    $('#openRouterModel').value = getModel();
    refreshKeyState();
  }
  loadSettingsIntoForm();

  commandForm.addEventListener('submit', async event => {
    event.preventDefault();
    const value = commandInput.value.trim();
    if (!value || aiBusy) return;

    // Environment navigation is local and works even without an AI key.
    const environmentCommand = value.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const opensLab = /\b(open|launch|show|switch to|go to|enter|activate)\b.*\b(intelligence lab|lab environment|analysis lab)\b/.test(environmentCommand)
      || /\b(intelligence lab|lab environment|analysis lab)\b.*\b(open|launch|show|switch)\b/.test(environmentCommand);
    const opensCore = /\b(open|launch|show|switch to|go to|enter|activate)\b.*\b(neural core|core environment|command center|command centre)\b/.test(environmentCommand)
      || /\b(neural core|core environment|command center|command centre)\b.*\b(open|launch|show|switch)\b/.test(environmentCommand);
    if (opensLab || opensCore) {
      const destination = opensLab ? 'lab' : 'core';
      setEnvironment(destination);
      appendMessage('user', 'YOU', value);
      commandInput.value = '';
      commandInput.style.height = 'auto';
      appendMessage('assistant', 'EYENEX NAVIGATION', destination === 'lab'
        ? 'Intelligence Lab opened. Type “open Neural Core” here whenever you want to return.'
        : 'Neural Core opened. Type “open Intelligence Lab” here to switch environments.');
      notify(destination === 'lab' ? 'Intelligence Lab opened.' : 'Neural Core opened.');
      return;
    }
    const isPlan = /\b(plan|break down|steps|task list|make a workflow|organize this|create a mission)\b/i.test(value);
    appendMessage('user', 'YOU', value);
    commandInput.value = '';
    commandInput.style.height = 'auto';

    if (isPlan) {
      const goal = value.replace(/^\s*(please\s+)?(plan|break down|make a workflow|create a mission|make a task list)\s*/i, '').trim() || value;
      const created = addMissions(buildLocalPlan(goal));
      if (!getActiveKey()) {
        appendMessage('assistant', 'LOCAL PLANNER', created
          ? 'I added ' + created + ' draft steps to Mission Queue. This is a local template, not an AI-generated plan. Connect OpenRouter in Settings to get a live AI response.'
          : 'The mission queue has reached its 80-task limit. Remove or clear tasks before adding another plan.');
        notify(created ? 'Draft plan added to Mission Queue.' : 'Mission queue is full.');
        return;
      }
      appendMessage('assistant', 'MISSION QUEUE', created
        ? 'Added ' + created + ' draft steps to Mission Queue. I’m also asking your selected OpenRouter model for a live response; nothing will be executed automatically.'
        : 'Mission queue is full. I’ll still ask the selected AI model to respond.');
    } else if (!getActiveKey()) {
      appendMessage('assistant', 'SETUP REQUIRED', 'Connect OpenRouter to enable live AI answers. Open Settings in the top-right corner, enter your API key, test it, then choose Save locally.');
      notify('Open Settings to connect OpenRouter.');
      return;
    }

    aiHistory.push({ role: 'user', content: value });
    aiHistory = aiHistory.slice(-16);
    aiBusy = true;
    const sendButton = $('.send-button', commandForm);
    if (sendButton) { sendButton.disabled = true; sendButton.textContent = 'Thinking…'; }
    const pending = appendMessage('assistant', 'OPENROUTER AI', 'Connecting to ' + getModel() + '…');
    try {
      const reply = await askOpenRouter([
        { role: 'system', content: 'You are EYENEX NEURAL, a helpful, careful AI assistant inside a futuristic command center. Be clear, accurate, and transparent about uncertainty. You cannot inspect local files, repositories, or execute external actions unless explicitly provided through connected tools; do not claim to have done so. Treat user requests as planning and advice unless a real connected tool is available. For potentially consequential actions, recommend human review.' },
        ...aiHistory
      ]);
      pending.remove();
      appendMessage('assistant', 'OPENROUTER AI · ' + getModel(), reply);
      aiHistory.push({ role: 'assistant', content: reply });
      aiHistory = aiHistory.slice(-16);
    } catch (error) {
      pending.remove();
      appendMessage('assistant', 'OPENROUTER CONNECTION', error.message || 'The AI request failed. Check Settings and try again.');
      notify('OpenRouter request failed.');
    } finally {
      aiBusy = false;
      if (sendButton) { sendButton.disabled = false; sendButton.innerHTML = 'Send command <b>↗</b>'; }
    }
  });
  commandInput.addEventListener('input', () => {
    commandInput.style.height = 'auto';
    commandInput.style.height = Math.min(commandInput.scrollHeight, 140) + 'px';
  });
  $$('.prompt-chip').forEach(button => button.addEventListener('click', () => {
    const prompt = button.textContent.replace('↗', '').trim();
    const prompts = {
      'Plan a complex task': 'Plan a complex task: launch a small software project',
      'Explain an idea': 'Explain an idea: how should I break a complicated problem into parts?',
      'Review a project': 'Plan a project review: inspect structure, risks, and possible improvements'
    };
    commandInput.value = prompts[prompt] || prompt;
    commandInput.focus();
    commandInput.dispatchEvent(new Event('input'));
  }));

  $('#sampleMission').addEventListener('click', () => {
    const added = addMissions([
      { title: 'Define the objective and constraints', detail: 'PLANNING' },
      { title: 'Gather the required context', detail: 'PREPARATION' },
      { title: 'Review the result before action', detail: 'HUMAN APPROVAL' }
    ]);
    notify(added ? 'Sample workflow added. No tasks were executed.' : 'Mission queue is full.');
  });
  renderMissions();

  $('#analysisForm').addEventListener('submit', async event => {
    event.preventDefault();
    const subject = $('#analysisInput').value.trim();
    if (!subject) {
      notify('Enter a subject or question to structure an analysis.');
      $('#analysisInput').focus();
      return;
    }
    const findPoints = $('#optKeyPoints').checked;
    const nextSteps = $('#optNextSteps').checked;
    const assumptions = $('#optAssumptions').checked;
    const result = $('#analysisResult');
    if (getActiveKey()) {
      result.innerHTML = '<div class="result-content"><span class="panel-kicker">OPENROUTER AI · ' + escapeHTML(getModel()) + '</span><p class="demo-note">Analyzing your question…</p></div>';
      const instructions = [
        'Analyze the following user-provided subject for EYENEX NEURAL Intelligence Lab.',
        'Be structured, concise, and explicit about uncertainty. Do not claim to have accessed external sources or project files.',
        findPoints ? 'Include key points.' : 'Do not add a separate key-points section.',
        nextSteps ? 'Include actionable next steps.' : 'Do not add a separate next-steps section.',
        assumptions ? 'Include assumptions that need verification.' : 'Do not add a separate assumptions section.',
        'Clearly distinguish facts given by the user from your inferences.',
        'Subject/question:\n' + subject
      ].join('\n');
      try {
        const answer = await askOpenRouter([
          { role: 'system', content: 'You are EYENEX NEURAL Intelligence Lab. Produce a useful, well-organized analysis without inventing evidence. If the prompt lacks details, say what is unknown.' },
          { role: 'user', content: instructions }
        ]);
        result.innerHTML = '<div class="result-content"><span class="panel-kicker">OPENROUTER AI · ' + escapeHTML(getModel()) + '</span><div class="ai-analysis-answer"></div><p class="demo-note">AI-generated response. Review important claims; no external sources or local files were automatically inspected.</p></div>';
        $('.ai-analysis-answer', result).textContent = answer;
        notify('OpenRouter analysis completed.');
      } catch (error) {
        result.innerHTML = '<div class="result-content"><span class="panel-kicker">CONNECTION ISSUE</span><p class="demo-note"></p></div>';
        $('.demo-note', result).textContent = (error.message || 'The AI analysis failed.') + ' You can retry or use the local outline below.';
        renderLocalAnalysis(subject, findPoints, nextSteps, assumptions, result);
      }
      return;
    }
    renderLocalAnalysis(subject, findPoints, nextSteps, assumptions, result);
    notify('Created a local analysis outline. Add an OpenRouter key in Settings for AI analysis.');
  });

  function renderLocalAnalysis(subject, findPoints, nextSteps, assumptions, result) {
    const points = [];
    if (findPoints) points.push(['Key points to extract', 'Identify the central question, main components, constraints, and success criteria.']);
    points.push(['Evidence needed', 'List relevant files, data, references, or observations. Mark what is available and what is missing.']);
    if (assumptions) points.push(['Assumptions to verify', 'Separate known facts from assumptions; record what evidence would confirm or disprove each assumption.']);
    points.push(['Uncertainty and risks', 'Record unknowns, possible failure points, and claims that cannot yet be verified.']);
    if (nextSteps) points.push(['Suggested next steps', 'Prioritize a small next action, define how to check it, and review the result before proceeding.']);
    result.innerHTML = '<div class="result-content"><span class="panel-kicker">LOCAL STRUCTURE · NOT AI-GENERATED</span><h3>' + escapeHTML(subject.length > 90 ? subject.slice(0, 87) + '…' : subject) + '</h3><ul>' + points.map(([title, detail]) => '<li><strong>' + escapeHTML(title) + ':</strong> ' + escapeHTML(detail) + '</li>').join('') + '</ul><p class="demo-note">Local checklist only: this is not a verified analysis of your subject. No external sources or project files were read.</p></div>';
  }

  const settingsDialog = $('#settingsDialog');
  $('#openSettings').addEventListener('click', () => {
    loadSettingsIntoForm();
    setSettingsFeedback('', '');
    settingsDialog.showModal();
  });
  $('#closeSettings').addEventListener('click', () => settingsDialog.close());
  settingsDialog.addEventListener('click', event => {
    if (event.target === settingsDialog) settingsDialog.close();
  });
  $('#toggleKeyVisibility').addEventListener('click', () => {
    const input = $('#openRouterKey');
    const visible = input.type === 'text';
    input.type = visible ? 'password' : 'text';
    $('#toggleKeyVisibility').textContent = visible ? 'Show key' : 'Hide key';
  });
  $('#settingsForm').addEventListener('submit', event => {
    event.preventDefault();
    const typedKey = $('#openRouterKey').value.trim();
    const model = $('#openRouterModel').value.trim() || defaultModel;
    if (typedKey && !/^sk-or-v1-[A-Za-z0-9_-]+$/.test(typedKey)) {
      setSettingsFeedback('This does not look like a standard OpenRouter API key. Check the value and try again.', 'error');
      return;
    }
    try {
      if (typedKey) {
        localStorage.setItem(API_KEY_KEY, typedKey);
        keyVerifiedThisSession = false;
      }
      if (!typedKey && !getSavedKey()) {
        setSettingsFeedback('Enter an API key before saving. The model ID can be changed at any time.', 'error');
        return;
      }
      localStorage.setItem(MODEL_KEY, model);
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ model }));
      $('#openRouterKey').value = '';
      $('#openRouterKey').placeholder = 'Saved key is stored locally — enter a new key to replace it';
      refreshKeyState();
      setSettingsFeedback('Settings saved in this browser. Use Test API key to verify authentication.', 'success');
      notify('OpenRouter settings saved locally.');
    } catch (error) {
      setSettingsFeedback('Browser storage is unavailable. Allow site storage and try again.', 'error');
    }
  });
  $('#testApiKey').addEventListener('click', async () => {
    keyVerifiedThisSession = false;
    refreshKeyState();
    const key = getActiveKey();
    if (!key) {
      setSettingsFeedback('Enter an API key or save one locally first.', 'error');
      $('#openRouterKey').focus();
      return;
    }
    const button = $('#testApiKey');
    button.disabled = true;
    button.textContent = 'Testing…';
    setSettingsFeedback('Checking the key with OpenRouter. This does not generate a model response.', 'info');
    try {
      const response = await fetch('https://openrouter.ai/api/v1/key', { method: 'GET', headers: { 'Authorization': 'Bearer ' + key } });
      let data = {};
      try { data = await response.json(); } catch (error) { /* no JSON response */ }
      if (!response.ok) {
        if (response.status === 401) throw new Error('OpenRouter rejected this key. Verify it in your OpenRouter dashboard.');
        throw new Error((data && data.error && data.error.message) || ('Key test failed (HTTP ' + response.status + ').'));
      }
      const info = data && data.data ? data.data : {};
      const remaining = typeof info.limit_remaining === 'number' ? ' Remaining key limit: $' + info.limit_remaining.toFixed(2) + '.' : '';
      keyVerifiedThisSession = true;
      refreshKeyState();
      setSettingsFeedback('API key accepted by OpenRouter.' + remaining + ' No chat completion was generated.', 'success');
      notify('OpenRouter API key test passed.');
    } catch (error) {
      setSettingsFeedback(error.message || 'Could not test the key. Check internet access and retry.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Test API key';
    }
  });
  $('#removeSavedKey').addEventListener('click', () => {
    try {
      localStorage.removeItem(API_KEY_KEY);
      localStorage.removeItem(MODEL_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      aiHistory = [];
      keyVerifiedThisSession = false;
      loadSettingsIntoForm();
      setSettingsFeedback('Saved API key removed from this browser. Any key typed above was not saved.', 'success');
      notify('Saved OpenRouter key removed.');
    } catch (error) {
      setSettingsFeedback('Could not remove the key from browser storage.', 'error');
    }
  });

  const dialog = $('#aboutDialog');
  $('#helpButton').addEventListener('click', () => dialog.showModal());
  $('#closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
})();