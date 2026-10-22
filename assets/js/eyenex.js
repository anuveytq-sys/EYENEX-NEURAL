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
  
  // Interactive 3D neural core: WebGL ray-sphere shading, animated energy filaments,
  // responsive rendering, and pointer/touch rotation. Falls back to the CSS orb if WebGL is unavailable.
  function initInteractiveNeuralCore() {
    const canvas = $('#neuralCoreCanvas');
    if (!canvas) return;
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'high-performance' }); }
    catch (_) { gl = null; }
    if (!gl) {
      canvas.style.display = 'none';
      const visual = canvas.closest('.core-visual');
      if (visual) visual.classList.add('core-fallback');
      return;
    }

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() { v_uv = a_position * 0.5 + 0.5; gl_Position = vec4(a_position, 0.0, 1.0); }
    `;
    const fragmentSource = `
      precision highp float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform vec2 u_rotation;
      uniform float u_hover;
      uniform float u_zoom;
      float hash(vec3 p) {
        p = fract(p * 0.3183099 + vec3(.1,.2,.3));
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),
                       mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),
                       mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
      }
      float fbm(vec3 p) {
        float v=0.0, a=.52;
        for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec3(7.1,3.4,5.2); a*=.5; }
        return v;
      }
      mat3 rotX(float a) { float c=cos(a),s=sin(a); return mat3(1.,0.,0.,0.,c,s,0.,-s,c); }
      mat3 rotY(float a) { float c=cos(a),s=sin(a); return mat3(c,0.,-s,0.,1.,0.,s,0.,c); }
      void main() {
        vec2 uv=(v_uv-.5)*2.0;
        uv.x *= u_resolution.x/u_resolution.y;
        vec3 ro=vec3(0.0,0.0,2.75);
        vec3 rd=normalize(vec3(uv*(1.12/u_zoom),-1.9));
        float b=dot(ro,rd), c=dot(ro,ro)-.69*.69;
        float disc=b*b-c;
        vec3 color=vec3(0.0);
        float alpha=0.0;
        float radial=length(uv*vec2(.82,1.0));
        float aura=exp(-max(0.0,radial-.25)*5.0)*.16;
        color += vec3(.0,.32,.55)*aura;
        alpha=max(alpha,aura*.75);
        if(disc>0.0) {
          float t=-b-sqrt(disc);
          vec3 p=ro+t*rd;
          vec3 n=normalize(p);
          vec3 q=rotY(u_rotation.x + u_time*.12)*rotX(u_rotation.y + sin(u_time*.17)*.08)*n;
          float clouds=fbm(q*5.7+vec3(u_time*.035,0.0,u_time*.025));
          float fine=fbm(q*15.0+vec3(0.0,u_time*.06,0.0));
          float latitude=abs(sin(acos(clamp(q.y,-1.0,1.0))*31.0));
          float longitude=abs(sin(atan(q.z,q.x)*27.0 + sin(q.y*8.0)*.8));
          float grid=1.0-smoothstep(.0,.095,min(latitude,longitude));
          float filaments=pow(max(0.0,sin((q.x*13.0+q.y*19.0+q.z*11.0)+fbm(q*8.0)*5.0+u_time*.8)),18.0);
          float bands=pow(max(0.0,sin(q.y*24.0 + clouds*5.0 + u_time*.22)),9.0);
          vec3 base=mix(vec3(.008,.035,.095),vec3(.015,.31,.49),smoothstep(.25,.78,clouds));
          base=mix(base,vec3(.015,.68,.77),smoothstep(.53,.82,fine)*.72);
          base += vec3(.01,.23,.32)*grid*.65;
          base += vec3(.05,.66,1.0)*filaments*.95;
          base += vec3(.01,.32,.55)*bands*.36;
          vec3 lightDir=normalize(vec3(-.65,.75,1.25));
          float diffuse=max(dot(n,lightDir),0.0);
          float spec=pow(max(dot(reflect(-lightDir,n),normalize(-rd)),0.0),34.0);
          float rim=pow(1.0-max(dot(n,normalize(-rd)),0.0),2.8);
          color=base*(.3+diffuse*.9)+vec3(.42,.92,1.0)*spec*.9+vec3(.0,.58,1.0)*rim*.9;
          color += vec3(.12,.85,1.0)*grid*(.18+u_hover*.5);
          color += vec3(.04,.55,1.0)*filaments*(.2+u_hover*.5);
          float edge=smoothstep(.69,.665,length(p));
          alpha=max(alpha,edge);
          color=mix(color,vec3(.03,.75,1.0),rim*.24);
        }
        gl_FragColor=vec4(color,clamp(alpha,0.0,1.0));
      }
    `;
    function compile(type, source) {
      const shader=gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){ gl.deleteShader(shader); return null; }
      return shader;
    }
    const vs=compile(gl.VERTEX_SHADER,vertexSource), fs=compile(gl.FRAGMENT_SHADER,fragmentSource);
    if(!vs || !fs) {
      canvas.style.display='none';
      const visual=canvas.closest('.core-visual'); if(visual) visual.classList.add('core-fallback');
      return;
    }
    const program=gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){ canvas.style.display='none'; return; }
    gl.useProgram(program);
    const buffer=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'a_position'); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const resLoc=gl.getUniformLocation(program,'u_resolution'), timeLoc=gl.getUniformLocation(program,'u_time');
    const rotLoc=gl.getUniformLocation(program,'u_rotation'), hoverLoc=gl.getUniformLocation(program,'u_hover');
    const zoomLoc=gl.getUniformLocation(program,'u_zoom');
    let rotXValue=.25, rotYValue=.15, hover=0, dragging=false, lastX=0, lastY=0;
    let zoom=1.0, targetZoom=1.0;
    canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture?.(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      if(dragging){rotXValue+=(e.clientX-lastX)*.008;rotYValue=Math.max(-1.35,Math.min(1.35,rotYValue+(e.clientY-lastY)*.008));lastX=e.clientX;lastY=e.clientY;}
      else {const r=canvas.getBoundingClientRect();hover=Math.max(0,1-Math.hypot((e.clientX-r.left)/r.width-.5,(e.clientY-r.top)/r.height-.5)*1.8);}
    });
    const stopDrag=()=>{dragging=false;}; canvas.addEventListener('pointerup',stopDrag); canvas.addEventListener('pointercancel',stopDrag); canvas.addEventListener('pointerleave',()=>{if(!dragging)hover=0;});
    canvas.addEventListener('wheel',e=>{
      e.preventDefault();
      targetZoom=Math.max(.78,Math.min(1.65,targetZoom*(e.deltaY<0?1.08:.925)));
    },{passive:false});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='ArrowLeft')rotXValue-=.15;
      if(e.key==='ArrowRight')rotXValue+=.15;
      if(e.key==='ArrowUp')rotYValue=Math.max(-1.35,Math.min(1.35,rotYValue-.15));
      if(e.key==='ArrowDown')rotYValue=Math.max(-1.35,Math.min(1.35,rotYValue+.15));
      if(e.key==='+'||e.key==='=')targetZoom=Math.min(1.65,targetZoom*1.08);
      if(e.key==='-'||e.key==='_')targetZoom=Math.max(.78,targetZoom*.925);
      if(e.key==='0')targetZoom=1.0;
    });
    canvas.setAttribute('aria-label','Interactive 3D neural core. Drag to rotate, scroll to zoom, or use arrow keys and plus/minus.');
    canvas.tabIndex=0;
    function resize(){
      const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
      const w=Math.max(1,Math.round(rect.width*dpr)), h=Math.max(1,Math.round(rect.height*dpr));
      if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    }
    function draw(now){
      resize(); const t=now*.001;
      if(!dragging) rotXValue+=.0007;
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(resLoc,canvas.width,canvas.height); gl.uniform1f(timeLoc,t);
      zoom += (targetZoom-zoom)*.14;
      gl.uniform2f(rotLoc,rotXValue,rotYValue); gl.uniform1f(hoverLoc,hover); gl.uniform1f(zoomLoc,zoom);
      gl.drawArrays(gl.TRIANGLES,0,6);
      requestAnimationFrame(draw);
    }
    requestAnimationFrame(draw);
  }
  initInteractiveNeuralCore();


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

  // Permissioned project intelligence: scan only a user-supplied PUBLIC GitHub repository.
  // File contents are not fetched; only repository metadata, README, and the file-name map are read.
  const repoScanForm = $('#repoScanForm');
  if (repoScanForm) {
    const repoUrlInput = $('#repoUrl');
    const repoConsent = $('#repoSendToAI');
    const repoButton = $('#repoScanButton');
    const repoOutput = $('#repoScanResult');

    function decodeBase64Utf8(value) {
      const binary = atob(String(value || '').replace(/\s/g, ''));
      const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }

    async function githubJson(url) {
      const response = await fetch(url, {
        headers: { 'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
      });
      if (!response.ok) {
        if (response.status === 404) throw new Error('Repository not found or not public. Check the URL and repository visibility.');
        if (response.status === 403 || response.status === 429) throw new Error('GitHub API rate limit reached. Wait a little and try again.');
        throw new Error('GitHub returned HTTP ' + response.status + '. Please retry later.');
      }
      return response.json();
    }

    repoScanForm.addEventListener('submit', async event => {
      event.preventDefault();
      let owner, name;
      try {
        const parsed = new URL(repoUrlInput.value.trim());
        if (parsed.hostname.toLowerCase() !== 'github.com') throw new Error('Enter a github.com repository URL.');
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts.length < 2) throw new Error('Use a repository URL in the form github.com/owner/repository.');
        owner = parts[0];
        name = parts[1].replace(/\.git$/i, '');
        if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('That repository URL does not look valid.');
      } catch (error) {
        repoOutput.textContent = error.message || 'Enter a valid public GitHub repository URL.';
        return;
      }

      repoButton.disabled = true;
      repoButton.textContent = 'Scanning public metadata…';
      repoOutput.textContent = 'Connecting to GitHub public API. No repository files are being executed.';
      try {
        const base = 'https://api.github.com/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name);
        const meta = await githubJson(base);
        if (meta.private) throw new Error('Private repositories are not supported by this public-only scanner.');
        const branch = meta.default_branch || 'main';
        const tree = await githubJson(base + '/git/trees/' + encodeURIComponent(branch) + '?recursive=1');
        let readme = '';
        try {
          const readmeData = await githubJson(base + '/readme');
          if (readmeData && readmeData.encoding === 'base64') readme = decodeBase64Utf8(readmeData.content).slice(0, 14000);
        } catch (error) {
          if (!/404|not found/i.test(error.message || '')) throw error;
        }
        const files = (tree.tree || [])
          .filter(item => item.type === 'blob')
          .map(item => item.path)
          .slice(0, 180);
        const folders = [...new Set(files.map(path => path.includes('/') ? path.split('/')[0] : '(root)'))].slice(0, 35);
        const summary = [
          'Repository: ' + (meta.full_name || owner + '/' + name),
          'Description: ' + (meta.description || 'Not provided'),
          'Default branch: ' + branch,
          'Primary language: ' + (meta.language || 'Not detected'),
          'Stars: ' + (meta.stargazers_count || 0) + ' · Forks: ' + (meta.forks_count || 0),
          'Repository files indexed: ' + ((tree.tree || []).length) + (tree.truncated ? ' (GitHub tree was truncated)' : ''),
          'File map sample (up to 180 paths):\n' + (files.length ? files.join('\n') : '(No files listed)'),
          'Top-level folders: ' + (folders.join(', ') || '(none)'),
          'README excerpt:\n' + (readme || '(No readable README found)')
        ].join('\n\n');

        repoOutput.innerHTML = '<div class="repo-result-card"><div class="repo-result-top"><span class="panel-kicker">PUBLIC REPOSITORY · SCAN COMPLETE</span><span class="repo-result-badge">READ-ONLY</span></div><h4></h4><p class="repo-result-meta"></p><div class="repo-result-stats"></div><p class="repo-result-note"></p><details><summary>View scan boundaries</summary><p>Read-only public metadata, README excerpt, and file names only. Source files were not downloaded, executed, or changed. The file list is capped to 180 paths for this scan.</p></details><div class="repo-result-ai"></div></div>';
        $('.repo-result-card h4', repoOutput).textContent = meta.full_name || owner + '/' + name;
        $('.repo-result-meta', repoOutput).textContent = meta.description || 'No repository description provided.';
        $('.repo-result-stats', repoOutput).textContent = 'LANGUAGE ' + (meta.language || 'UNKNOWN') + '  ·  ★ ' + (meta.stargazers_count || 0) + '  ·  ' + files.length + ' FILE PATHS SHOWN';
        $('.repo-result-note', repoOutput).textContent = readme ? 'README detected (' + readme.length + ' characters included in scan context).' : 'No readable README detected. Review is based on public metadata and file names.';
        const aiBox = $('.repo-result-ai', repoOutput);

        if (repoConsent.checked && getActiveKey()) {
          aiBox.textContent = 'Sending the repository summary to your configured AI model, as requested…';
          try {
            const review = await askOpenRouter([
              { role: 'system', content: 'You are EYENEX NEURAL Project Intelligence. Review only the supplied public repository metadata, file paths, and README excerpt. Do not claim to have read source files, run code, checked live deployments, or verified security. Separate direct observations from hypotheses, identify architecture clues and missing information, give prioritized review questions and safe next steps, and explicitly state uncertainty.' },
              { role: 'user', content: 'Review this user-selected public GitHub repository summary. Do not assume file contents beyond the README excerpt and file names provided.\n\n' + summary }
            ]);
            aiBox.textContent = review;
            const label = document.createElement('span');
            label.className = 'panel-kicker';
            label.textContent = 'AI-ASSISTED REVIEW · ' + getModel();
            aiBox.prepend(label);
            notify('Public repository scan and AI review completed.');
          } catch (error) {
            aiBox.textContent = 'AI review unavailable: ' + (error.message || 'request failed') + ' The public metadata scan is still available above.';
            notify('Repository scan complete; AI review failed.');
          }
        } else {
          aiBox.textContent = repoConsent.checked
            ? 'AI review was requested, but no active OpenRouter key is available. Add your own key in Settings to enable it. No repository summary was sent to an AI model.'
            : 'Local scan only. The repository summary was not sent to an AI model. Tick the opt-in box before a scan if you want deeper AI review.';
          notify('Public repository scan completed locally.');
        }
      } catch (error) {
        repoOutput.textContent = error.message || 'Repository scan failed. Check the URL and internet connection.';
        notify('Repository scan failed.');
      } finally {
        repoButton.disabled = false;
        repoButton.innerHTML = 'Scan public repository <span>↗</span>';
      }
    });
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