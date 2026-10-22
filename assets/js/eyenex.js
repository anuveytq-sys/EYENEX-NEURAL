(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const toast = $('#toast');
  let toastTimer;
  function notify(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  function updateClock() {
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  }
  $$('.env-tab, .rail-button[data-env]').forEach(button => button.addEventListener('click', () => setEnvironment(button.dataset.env)));

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  const conversation = $('#conversation');
  const commandInput = $('#commandInput');
  const commandForm = $('#commandForm');
  function addUserMessage(text) {
    const row = document.createElement('div');
    row.className = 'message user-message';
    row.innerHTML = '<div><p>' + escapeHTML(text) + '</p></div>';
    conversation.appendChild(row);
    return row;
  }
  function addDemoReply() {
    const row = document.createElement('div');
    row.className = 'message system-message';
    row.style.marginTop = '16px';
    row.innerHTML = '<span class="message-mark">E</span><div><small>NEURAL CORE <time>LOCAL DEMO</time></small><p>I’ve received your instruction. This concept build can demonstrate the interface and organize a basic plan locally, but a live AI provider and task-execution tools are not connected yet. Open Intelligence Lab to structure a question, or use Mission Queue to preview a workflow.</p></div>';
    conversation.appendChild(row);
    conversation.scrollTop = conversation.scrollHeight;
  }
  commandForm.addEventListener('submit', event => {
    event.preventDefault();
    const value = commandInput.value.trim();
    if (!value) return;
    addUserMessage(value);
    commandInput.value = '';
    commandInput.style.height = 'auto';
    addDemoReply();
  });
  commandInput.addEventListener('input', () => {
    commandInput.style.height = 'auto';
    commandInput.style.height = Math.min(commandInput.scrollHeight, 140) + 'px';
  });
  $$('.prompt-chip').forEach(button => button.addEventListener('click', () => {
    const prompts = {
      'Plan a complex task': 'Help me break a complex goal into manageable steps, dependencies, and review points.',
      'Explain an idea': 'Explain a complex idea clearly, with key concepts and examples.',
      'Review a project': 'Help me review a software project for architecture, risks, and improvement opportunities.'
    };
    commandInput.value = prompts[button.textContent.trim().replace(' ↗', '')] || button.textContent.trim();
    commandInput.focus();
    commandInput.dispatchEvent(new Event('input'));
  }));

  const missionList = $('#missionList');
  let sampleLoaded = false;
  $('#sampleMission').addEventListener('click', () => {
    if (sampleLoaded) {
      notify('Sample workflow is already loaded.');
      return;
    }
    sampleLoaded = true;
    $('#missionCount').textContent = '03';
    missionList.className = 'mission-items';
    missionList.innerHTML = '<div class="mission-item"><span class="mission-number">01</span><div><strong>Define the objective</strong><small>PLANNING · READY</small></div><span class="mission-state">○</span></div><div class="mission-item"><span class="mission-number">02</span><div><strong>Gather context</strong><small>RESEARCH · QUEUED</small></div><span class="mission-state">○</span></div><div class="mission-item"><span class="mission-number">03</span><div><strong>Review the outcome</strong><small>VALIDATION · QUEUED</small></div><span class="mission-state">○</span></div>';
    $('#sampleMission').textContent = 'Sample workflow loaded ✓';
    notify('Loaded a sample workflow. No tasks were executed.');
  });

  $('#analysisForm').addEventListener('submit', event => {
    event.preventDefault();
    const subject = $('#analysisInput').value.trim();
    if (!subject) {
      notify('Enter a subject or question to structure an analysis.');
      $('#analysisInput').focus();
      return;
    }
    const selected = $$('.analysis-options input:checked').map(input => input.parentElement.textContent.trim());
    const points = [
      ['Scope the question', 'Clarify the objective, boundaries, and what a useful answer should contain.'],
      ['Identify required evidence', 'List the files, data, references, or observations needed before drawing conclusions.'],
      ['Check assumptions', selected.includes('Check assumptions') ? 'Write down assumptions and mark which ones still need verification.' : 'Keep assumptions visible and revisit them if evidence conflicts.'],
      ['Produce next steps', selected.includes('Suggest next steps') ? 'Turn supported findings into a short, prioritized action list.' : 'Record the main finding and the most important unresolved question.']
    ];
    const result = $('#analysisResult');
    result.innerHTML = '<div class="result-content"><span class="panel-kicker">LOCAL STRUCTURE · NOT AI-GENERATED</span><h3>' + escapeHTML(subject.length > 90 ? subject.slice(0, 87) + '…' : subject) + '</h3><ul>' + points.map(([title, detail]) => '<li><strong>' + escapeHTML(title) + ':</strong> ' + escapeHTML(detail) + '</li>').join('') + '</ul><p class="demo-note">Prototype output: this is a local template, not a verified analysis. Connect an AI provider and approved data sources for evidence-based results.</p></div>';
    notify('Created a local analysis outline.');
  });

  const dialog = $('#aboutDialog');
  $('#helpButton').addEventListener('click', () => dialog.showModal());
  $('#closeDialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
})();