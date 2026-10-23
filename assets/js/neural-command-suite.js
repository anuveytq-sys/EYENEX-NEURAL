/* EYENEX NEURAL — Command Suite.
   Additive, browser-local operational tools. Preserves existing panel geometry and tracking controls. */
(() => {
  'use strict';
  if (window.__eyenexCommandSuite) return;
  window.__eyenexCommandSuite = true;

  const $ = (s, r = document) => r.querySelector(s);
  const form = $('#commandForm'), input = $('#commandInput'), conversation = $('#conversation');
  if (!form || !input || !conversation) return;

  const QUEUE = 'eyenex-neural-missions-v1';
  const FOCUS = 'eyenex-neural-focus-v1';
  const NOTES = 'eyenex-neural-ops-notes-v1';
  const SNAPSHOT = 'eyenex-neural-mission-vault-snapshot-v1';
  const OPS = 'eyenex-neural-mission-ops-v1';
  let lastAt = 0;

  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; }
  };
  const queue = () => {
    const v = read(QUEUE, []);
    return Array.isArray(v) ? v.filter(m => m && typeof m.title === 'string').slice(0, 80) : [];
  };
  const notes = () => {
    const v = read(NOTES, []);
    return Array.isArray(v) ? v.filter(n => n && typeof n.text === 'string').slice(-60) : [];
  };
  const stamp = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function say(message, label = 'NEURAL COMMAND SUITE') {
    const row = document.createElement('div'); row.className = 'message system-message mi-message ncs-message';
    const mark = document.createElement('span'); mark.className = 'message-mark'; mark.textContent = 'E';
    const body = document.createElement('div');
    const meta = document.createElement('small'); meta.textContent = label + '  ' + stamp();
    const p = document.createElement('p'); p.innerHTML = esc(message).replace(/\n/g, '<br>'); p.style.whiteSpace = 'normal';
    body.append(meta, p); row.append(mark, body); conversation.appendChild(row);
    conversation.scrollTop = conversation.scrollHeight;
  }
  function notify(text) {
    const toast = $('#toast'); if (!toast) return;
    toast.textContent = text; toast.classList.add('show'); clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.remove('show'), 2600);
  }
  function counts(list) {
    return { ready:list.filter(m=>(m.state||'READY')==='READY').length,
      running:list.filter(m=>m.state==='IN PROGRESS').length,
      done:list.filter(m=>m.state==='DONE').length, failed:list.filter(m=>m.state==='FAILED').length };
  }
  function riskFor(m) {
    const text = (m.title + ' ' + (m.detail || '') + ' ' + (m.error || '')).toLowerCase();
    let score = 20, why = [];
    if (/security|auth|token|secret|permission|privacy|credential/.test(text)) { score += 35; why.push('security / access wording'); }
    if (/crash|broken|failure|failed|error|restore|rollback|data loss/.test(text)) { score += 30; why.push('failure / recovery wording'); }
    if (/deploy|production|publish|release|migration/.test(text)) { score += 18; why.push('release / production wording'); }
    if (/camera|microphone|location|personal|upload|external/.test(text)) { score += 12; why.push('device / data boundary wording'); }
    if (m.state === 'FAILED') { score += 25; why.push('currently marked FAILED'); }
    if (m.state === 'DONE') score = 0;
    return { score:Math.max(0,Math.min(100,score)), why:why.length?why:['no high-risk keywords matched'] };
  }
  function briefing() {
    const list=queue(), c=counts(list), focus=read(FOCUS,'');
    const failed=list.filter(m=>m.state==='FAILED').slice(0,4);
    const running=list.filter(m=>m.state==='IN PROGRESS');
    const memory=notes();
    return [
      'EYENEX OPERATIONS BRIEF / LOCAL SNAPSHOT',
      'Missions: '+list.length+'/80 · READY '+c.ready+' · IN PROGRESS '+c.running+' · DONE '+c.done+' · FAILED '+c.failed,
      'Completion: '+(list.length?Math.round(c.done/list.length*100):0)+'% of the current local queue.',
      'Priority signal: '+(c.failed?'RECOVERY FIRST — inspect failed work before starting more tasks.':running.length?'Continue the active checkpoint and verify its outcome.':c.ready?'Choose one ready task and approve it in Mission Control.':'No unfinished mission is currently queued.'),
      'Saved focus: '+(focus||'none'),
      'Local operations notes: '+memory.length,
      'Network: '+(navigator.onLine?'browser reports online':'browser reports offline'),
      'Data boundary: browser-local records only; no external systems are probed.'
    ].concat(failed.map(m=>'FAILED: '+m.title+' — '+(m.error||'review the failure note'))).join('\n');
  }
  function riskReport() {
    const list=queue();
    if(!list.length) return 'RISK REGISTER\nThe mission queue is empty. Add or plan work first; risk scores are heuristic, not a formal security assessment.';
    const ranked=list.map(m=>({m,r:riskFor(m)})).filter(x=>x.r.score>0).sort((a,b)=>b.r.score-a.r.score).slice(0,8);
    return ['RISK REGISTER / TRANSPARENT KEYWORD HEURISTICS',
      ...ranked.map((x,i)=>(i+1)+'. ['+x.r.score+'/100] '+x.m.title+' — '+(x.m.state||'READY')+'\n   Signals: '+x.r.why.join(', ')),
      'Interpretation: a triage aid only. It does not inspect code, dependencies, production systems, or real-world consequences. Verify each result manually.'
    ].join('\n');
  }
  function timeline() {
    const list=queue().slice().sort((a,b)=>Date.parse(a.createdAt||0)-Date.parse(b.createdAt||0));
    if(!list.length) return 'MISSION TIMELINE\nNo queued missions yet.';
    return ['MISSION TIMELINE / LOCAL RECORDS',...list.slice(-16).map((m,i)=>{
      const when=m.createdAt&&Number.isFinite(Date.parse(m.createdAt))?new Date(m.createdAt).toLocaleString():'time unknown';
      return String(i+1).padStart(2,'0')+'. '+when+' · '+(m.state||'READY')+' · '+m.title;
    }), 'Showing the latest '+Math.min(16,list.length)+' records in creation order.'].join('\n');
  }
  function performance() {
    let bytes=0, keys=0;
    try { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';bytes+=(k.length+(localStorage.getItem(k)||'').length)*2;keys++;} } catch(_){}
    const fps=document.documentElement.dataset.eyenexFps||'sampling unavailable';
    return ['RUNTIME TELEMETRY',
      'Viewport: '+innerWidth+' × '+innerHeight+' · device pixel ratio '+(devicePixelRatio||1),
      'Browser: '+(navigator.userAgentData?.platform||navigator.platform||'platform not reported'),
      'Network state: '+(navigator.onLine?'online':'offline')+' · page visibility: '+document.visibilityState,
      'Frame-rate sample: '+fps+(String(fps).match(/^\d+$/)?' FPS':''),
      'Local storage estimate: '+(bytes/1024).toFixed(1)+' KB across '+keys+' keys.',
      'This is a browser-side estimate; memory, CPU, camera, and remote-service health are not fully observable here.'
    ].join('\n');
  }
  function playbook(goal) {
    const g=goal.trim();
    if(!g) return 'Use /simulate <scenario or goal>. Example: /simulate deploy the website without breaking current features';
    const lower=g.toLowerCase();
    const steps=[];
    if(/deploy|publish|release|production/.test(lower)) steps.push('Confirm the target branch, deployment environment, and latest known-good revision.','Run syntax/build checks and inspect the deployment diff.','Deploy with serialized runs; do not cancel an active deployment.','Open the published URL in a fresh session and verify key paths.','Keep a rollback point and record the result.');
    else if(/bug|fix|error|crash|broken/.test(lower)) steps.push('Reproduce the issue and record the exact error.','Identify the smallest responsible component.','Change one isolated behavior while preserving unrelated interfaces.','Run syntax checks and the narrowest available regression test.','Verify both the fix and the original working path.');
    else if(/security|key|token|privacy|auth/.test(lower)) steps.push('Identify sensitive data and the trust boundary.','Keep secrets server-side; never commit keys to source control.','Apply least privilege, input validation, and explicit user consent.','Test allowed and rejected requests without exposing secret values.','Document remaining risks and rotation/recovery steps.');
    else if(/camera|gesture|tracking|microphone|audio/.test(lower)) steps.push('Check browser permission and secure-context requirements.','Confirm the model and device stream initialize only after user action.','Test the existing control mode before enabling new behavior.','Measure stability and provide a clean pause/stop path.','Verify no frames or recordings are saved or uploaded unexpectedly.');
    else steps.push('Define a measurable success condition and what must not change.','Break the goal into small, independently verifiable checkpoints.','Record assumptions, dependencies, and likely failure modes.','Complete the lowest-risk prerequisite first.','Verify each checkpoint before proceeding.','Capture the result and a recovery path.');
    return ['SCENARIO PLAYBOOK / '+g.toUpperCase(),'1. '+steps.join('\n2. '),'No action has been executed; this is a proposed checklist for human review.'].join('\n');
  }
  function snapshot() {
    const missions=queue(), now=new Date().toISOString();
    const payload={savedAt:now,reason:'EYENEX Command Suite snapshot',missions};
    const ok=write(SNAPSHOT,payload);
    const auxiliary=write('eyenex-neural-command-suite-snapshot-v1',{savedAt:now,focus:read(FOCUS,''),notes:notes(),ops:read(OPS,{})});
    const restoreButton = $('#mvRestore'); if (restoreButton && ok) restoreButton.disabled = false;
    if(ok) { notify('Mission recovery snapshot saved.'); return 'RECOVERY SNAPSHOT SAVED\n'+missions.length+' mission(s) captured at '+new Date(now).toLocaleString()+'. The existing Mission Vault Restore snapshot can now use this queue snapshot. '+(auxiliary?'Focus, notes, and orchestration metadata were also snapshotted separately.':'Auxiliary snapshot could not be saved due to browser storage limits.'); }
    return 'Snapshot failed: browser storage may be unavailable or full. No queue changes were made.';
  }
  function exportReport() {
    const payload={product:'EYENEX NEURAL',format:'eyenex-ops-report',version:1,exportedAt:new Date().toISOString(),
      focus:read(FOCUS,''),missions:queue(),notes:notes(),orchestration:read(OPS,{}),runtime:{online:navigator.onLine,viewport:[innerWidth,innerHeight],devicePixelRatio:devicePixelRatio||1}};
    try {
      const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
      const url=URL.createObjectURL(blob), a=document.createElement('a');
      a.href=url; a.download='eyenex-operations-report-'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500);
      return 'Operations report exported as JSON. It contains browser-local mission records, saved notes/focus, and basic runtime metadata; review it before sharing.';
    } catch (_) { return 'Export could not start in this browser. No data was uploaded.'; }
  }
  function memoryCommand(arg) {
    const raw=arg.trim();
    if(/^clear$/i.test(raw)) {
      const ok=window.confirm('Clear EYENEX local operations notes? This does not clear missions, focus, or backups.');
      if(!ok) return 'Notes were left unchanged.';
      write(NOTES,[]); return 'Local operations notes cleared. Mission queue and focus were not changed.';
    }
    if(/^add\s+/i.test(raw)) {
      const text=raw.replace(/^add\s+/i,'').trim().slice(0,500);
      if(!text) return 'Add a note after /memory add.';
      const list=notes(); list.push({text,createdAt:new Date().toISOString()});
      if(!write(NOTES,list.slice(-60))) return 'Could not save note: browser storage may be full.';
      return 'LOCAL NOTE SAVED\n'+text+'\nNotes stay in this browser and are not sent to an AI model automatically.';
    }
    const list=notes();
    if(!list.length) return 'LOCAL OPERATIONS MEMORY\nNo notes saved. Use /memory add <note> to store a local note.';
    return ['LOCAL OPERATIONS MEMORY / '+list.length+' NOTES',...list.slice(-12).map((n,i)=>(i+1)+'. '+n.text+' ('+(n.createdAt?new Date(n.createdAt).toLocaleDateString():'date unknown')+')'),'Showing the latest '+Math.min(12,list.length)+' notes.'].join('\n');
  }
  const help = [
    'ADVANCED COMMAND SUITE',
    '/suite — list available command modules',
    '/brief — mission and focus executive brief',
    '/risk — rank local missions with transparent keyword heuristics',
    '/timeline — view the local mission timeline',
    '/perf — browser and storage telemetry',
    '/simulate <goal> — create a human-reviewed scenario playbook',
    '/snapshot — save a recovery snapshot for Mission Vault',
    '/export — download a local operations JSON report',
    '/memory — show notes · /memory add <note> · /memory clear',
    '/review — combined mission, risk, and focus review',
    '',
    'Also available: /telemetry, /diagnose, /mission-intel, /focus, /core pulse, /core normal, /help.',
    'Boundary: local heuristics and browser data only; no external task is executed.'
  ].join('\n');
  function execute(command) {
    const space=command.indexOf(' ');
    const name=(space<0?command:command.slice(0,space)).toLowerCase();
    const arg=space<0?'':command.slice(space+1);
    if(name==='/suite'||name==='/commands-plus') return help;
    if(name==='/brief') return briefing();
    if(name==='/risk') return riskReport();
    if(name==='/timeline') return timeline();
    if(name==='/perf') return performance();
    if(name==='/simulate'||name==='/playbook') return playbook(arg);
    if(name==='/snapshot') return snapshot();
    if(name==='/export') return exportReport();
    if(name==='/memory') return memoryCommand(arg);
    if(name==='/review') return briefing()+'\n\n'+riskReport();
    return null;
  }
  const suiteChip = $('#advancedSuiteChip');
  if (suiteChip) suiteChip.addEventListener('click', () => {
    input.value = '/suite';
    input.focus();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const supported=/^\/(suite|commands-plus|brief|risk|timeline|perf|simulate|playbook|snapshot|export|memory|review)(?:\s|$)/i;
  form.addEventListener('submit', event => {
    const raw=(input.value||'').trim();
    if(!supported.test(raw)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if(Date.now()-lastAt<220) return;
    lastAt=Date.now();
    const user=document.createElement('div'); user.className='message user-message';
    const body=document.createElement('div'), p=document.createElement('p'); p.textContent=raw; body.appendChild(p); user.appendChild(body); conversation.appendChild(user);
    try { const result=execute(raw); if(result) say(result); }
    catch(error) { say('Command failed safely: '+(error&&error.message?error.message:'unexpected local error')+'. No external action was taken.','LOCAL DIAGNOSTIC'); }
    input.value=''; conversation.scrollTop=conversation.scrollHeight;
  }, true);
  const style=document.createElement('style');
  style.textContent='.ncs-message p{line-height:1.62;overflow-wrap:anywhere}.ncs-message{margin-top:12px}.ncs-message .message-mark{box-shadow:0 0 14px rgba(0,210,255,.12)}';
  document.head.appendChild(style);
})();