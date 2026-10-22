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
    $$('.env-tab').forEach(button => {
      const selected = button.dataset.env === name;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    $$('.rail-button[data-env]').forEach(button => {
      const selected = button.dataset.env === name;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('.env-tab, .rail-button[data-env]').forEach(button => button.addEventListener('click', () => setEnvironment(button.dataset.env)));

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

  commandForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = commandInput.value.trim();
    if (!value) return;
    appendMessage('user', 'YOU', value);
    commandInput.value = '';
    commandInput.style.height = 'auto';
    if (/\b(plan|break down|steps|task list|make a workflow|organize this|create a mission)\b/i.test(value)) {
      const goal = value.replace(/^\s*(please\s+)?(plan|break down|make a workflow|create a mission|make a task list)\s*/i, '').trim() || value;
      const created = addMissions(buildLocalPlan(goal));
      appendMessage('assistant', 'LOCAL PLANNER', created
        ? 'I created ' + created + ' draft steps and added them to Mission Queue. This is a rule-based local template, not an AI-generated plan. Review each step and advance its status there; nothing was executed.'
        : 'The mission queue has reached its 80-task limit. Remove or clear tasks before adding another plan.');
      notify(created ? 'Draft plan added to Mission Queue.' : 'Mission queue is full.');
    } else {
      appendMessage('assistant', 'NEURAL CORE', 'Command received. Live AI is not connected, so I cannot answer this as an AI yet. Try starting with “Plan …” to create a local draft workflow, or open Intelligence Lab to structure a question.');
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

  $('#analysisForm').addEventListener('submit', event => {
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
    const points = [];
    if (findPoints) points.push(['Key points to extract', 'Identify the central question, main components, constraints, and success criteria.']);
    points.push(['Evidence needed', 'List relevant files, data, references, or observations. Mark what is available and what is missing.']);
    if (assumptions) points.push(['Assumptions to verify', 'Separate known facts from assumptions; record what evidence would confirm or disprove each assumption.']);
    points.push(['Uncertainty and risks', 'Record unknowns, possible failure points, and claims that cannot yet be verified.']);
    if (nextSteps) points.push(['Suggested next steps', 'Prioritize a small next action, define how to check it, and review the result before proceeding.']);
    const result = $('#analysisResult');
    result.innerHTML = '<div class="result-content"><span class="panel-kicker">LOCAL STRUCTURE · NOT AI-GENERATED</span><h3>' + escapeHTML(subject.length > 90 ? subject.slice(0, 87) + '…' : subject) + '</h3><ul>' + points.map(([title, detail]) => '<li><strong>' + escapeHTML(title) + ':</strong> ' + escapeHTML(detail) + '</li>').join('') + '</ul><p class="demo-note">Prototype output: this is a reusable checklist, not a verified analysis of your subject. No external sources or project files were read.</p></div>';
    notify('Created a local analysis outline.');
  });

  const dialog = $('#aboutDialog');
  $('#helpButton').addEventListener('click', () => dialog.showModal());
  $('#closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
})();