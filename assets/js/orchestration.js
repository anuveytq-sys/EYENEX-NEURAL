(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const STORAGE = 'eyenex-neural-mission-ops-v1';
  const MISSION_STORAGE = 'eyenex-neural-missions-v1';
  const safeJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || ''); return v ?? fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const esc = v => String(v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const deck = $('#orchestrationDeck');
  const commandPanel = $('.command-panel');
  const coreEnvironment = $('#coreEnvironment');
  if (!deck || !commandPanel || !coreEnvironment) return;

  /* Keep the lower HUD modules out of the command panel's clipped scroll area.
     They become two independent panels beneath Mission Queue and Core Status,
     leaving the central neural core unobstructed. */
  commandPanel.after(deck);
  commandPanel.classList.add('hud-command-panel');
  deck.classList.add('hud-orchestration-panel');

  /* Keep starter actions in a compact, independent panel rather than consuming
     command-composer space or covering the neural core. Existing button listeners remain intact. */
  const starterPrompts = $('.starter-prompts', commandPanel);
  const mainArea = $('.main-area');
  let starterPanel = null;
  if (starterPrompts && mainArea) {
    starterPanel = document.createElement('section');
    starterPanel.className = 'hud-starter-panel';
    starterPanel.setAttribute('aria-label', 'Suggested commands');
    starterPanel.appendChild(starterPrompts);
    mainArea.appendChild(starterPanel);
  }

  const style = document.createElement('style');
  style.textContent = `
    .orchestration-deck{margin:0;padding:10px;border:1px solid rgba(0,220,255,.2);border-radius:4px;background:linear-gradient(145deg,rgba(2,23,43,.72),rgba(0,6,15,.76));min-width:0;}
    .ops-head,.ops-card-title,.ops-head-right{display:flex;align-items:center;justify-content:space-between;gap:8px}.ops-head h3{margin:3px 0 0;color:#e8fbff;font-size:11px}.ops-head-right{font:7px 'DM Mono',monospace;color:#62dced;white-space:nowrap}.ops-pulse{padding:3px 5px;border:1px solid rgba(0,234,255,.25);border-radius:3px}.ops-grid{display:grid;grid-template-columns:1.2fr .8fr;gap:7px;margin-top:8px}.ops-card,.ops-audit-card{border:1px solid rgba(85,184,212,.16);border-radius:4px;background:rgba(0,8,18,.42);padding:8px;min-width:0}.ops-card-title{font:7px 'DM Mono',monospace;letter-spacing:.1em;color:#6daabd}.ops-icon-btn,.ops-text-btn{border:0;background:transparent;color:#59dff3;cursor:pointer;font:8px 'DM Mono',monospace}.ops-lock{color:#8aa5b0;font-size:6px}.ops-timeline{margin-top:6px;display:grid;gap:4px;max-height:96px;overflow:auto}.ops-step{display:grid;grid-template-columns:22px 1fr 18px;align-items:center;gap:6px;padding:5px;border-left:1px solid rgba(0,220,255,.18);background:rgba(0,170,255,.025)}.ops-step-index{font:7px 'DM Mono',monospace;color:#4e91a7}.ops-step-body{min-width:0}.ops-step-body strong,.ops-approval-card strong{display:block;color:#dff8ff;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ops-step-body small,.ops-approval-card small{display:block;margin-top:2px;color:rgba(187,219,230,.62);font-size:6px;line-height:1.35}.ops-node{display:grid;place-items:center;width:16px;height:16px;border-radius:50%;font-size:8px;border:1px solid rgba(115,170,190,.3);color:#668b99}.ops-node.active{color:#5fe9ff;border-color:#36d9ef;box-shadow:0 0 8px rgba(0,220,255,.25)}.ops-node.done,.ops-node.approved{color:#74e7c2;border-color:rgba(116,231,194,.45)}.ops-approval{margin-top:6px}.ops-approval-card{display:grid;gap:7px}.ops-actions{display:flex;flex-wrap:wrap;gap:4px}.ops-btn{border:1px solid rgba(88,179,204,.25);background:rgba(0,120,180,.08);color:#bdebf5;border-radius:3px;padding:5px 6px;font:7px 'DM Mono',monospace;cursor:pointer}.ops-btn.primary{border-color:rgba(0,234,255,.45);color:#62e9fb;background:rgba(0,180,230,.1)}.ops-audit-card{margin-top:7px}.ops-audit{max-height:65px;overflow:auto;margin-top:5px}.ops-audit-row{display:grid;grid-template-columns:45px 55px 1fr;gap:5px;padding:4px 0;border-top:1px solid rgba(90,170,194,.09);font-size:6px}.ops-audit-row time{color:#4d8291;font-family:'DM Mono',monospace}.ops-audit-row span{color:#60dcec;font-family:'DM Mono',monospace}.ops-audit-row p{margin:0;color:rgba(205,228,237,.66)}.ops-empty{padding:8px;color:rgba(130,178,193,.58);font:7px 'DM Mono',monospace;letter-spacing:.05em;text-align:center}.ops-boundary{margin:6px 0 0;color:rgba(117,166,181,.5);font:6px 'DM Mono',monospace;text-align:right}.orchestration-deck button:focus-visible{outline:1px solid #48e6fa;outline-offset:2px}

    /* Command stays at the bottom; orchestration sits above it in its own scrollable HUD. */
    .hud-command-panel{
      position:absolute!important;z-index:14;left:50%!important;right:auto!important;top:auto!important;bottom:12px!important;
      transform:translateX(-50%)!important;width:min(620px,calc(100% - 36px))!important;height:112px!important;max-height:112px!important;min-height:0!important;
      margin:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;box-sizing:border-box;
      border-radius:4px!important;border-color:rgba(0,220,255,.32)!important;
      background:linear-gradient(145deg,rgba(2,25,47,.94),rgba(0,7,17,.94))!important;
      box-shadow:0 0 30px rgba(0,140,255,.09),inset 0 0 25px rgba(0,160,255,.035)!important;
    }
    .hud-command-panel .panel-heading{display:none!important}
    .hud-command-panel .conversation{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;max-height:none!important;overflow-y:auto!important;overscroll-behavior:contain;padding:8px 12px 4px!important}
    .hud-command-panel .starter-prompts{order:-1;flex:0 0 auto;margin:0 0 7px 0!important;gap:6px!important;display:flex!important;flex-wrap:wrap!important}
    .hud-command-panel .prompt-chip{padding:6px 9px!important;font-size:9px!important;min-height:28px}
    .hud-command-panel .message{gap:8px}
    .hud-command-panel .message p{font-size:9px!important;line-height:1.35!important}
    .hud-command-panel .command-composer{flex:0 0 auto!important;margin:4px 8px 8px!important;padding:7px 9px!important}
    .hud-command-panel .command-composer textarea{min-height:22px!important;max-height:34px!important;font-size:9px!important}
    .hud-command-panel .composer-footer{padding-top:5px!important}
    .hud-command-panel .send-button{font-size:8px!important;padding:6px 8px!important}

    /* Compact starter actions live outside the composer in each environment. */
    .hud-starter-panel{
      position:absolute;z-index:11;left:16px;right:auto;top:calc(24vh + min(33vh,252px) + 8px);
      width:clamp(150px,16vw,190px);max-height:76px;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;
      padding:6px;border:1px solid rgba(0,220,255,.22);border-radius:4px;
      background:linear-gradient(145deg,rgba(2,23,43,.92),rgba(0,6,15,.94));
      box-shadow:0 0 16px rgba(0,140,255,.07);scrollbar-width:thin;overscroll-behavior:contain;
    }
    .hud-starter-panel .starter-prompts{display:flex!important;flex-wrap:wrap;gap:4px!important;margin:0!important;padding:0!important;}
    .hud-starter-panel .prompt-chip{min-height:22px!important;padding:4px 6px!important;font-size:7px!important;line-height:1.25!important;white-space:normal;}
    .hud-starter-panel .prompt-chip span{font-size:7px!important;}

    /* Mission orchestration belongs to Neural Core; keep the Intelligence Lab workspace clear. */
    body[data-environment="lab"] .hud-orchestration-panel{display:none!important;}
    body[data-environment="lab"] .hud-starter-panel{left:auto;right:16px;top:auto;bottom:154px;width:clamp(128px,12vw,148px);max-height:48px;}

    .hud-orchestration-panel{
      position:absolute!important;z-index:10;left:auto!important;right:16px!important;top:auto!important;bottom:184px!important;
      width:clamp(142px,13vw,172px)!important;height:clamp(140px,17vh,154px)!important;max-height:154px!important;min-height:0!important;
      margin:0!important;box-sizing:border-box;overflow-y:auto!important;overflow-x:hidden!important;overscroll-behavior:contain;touch-action:pan-y;
      scrollbar-width:thin;scrollbar-color:rgba(0,220,255,.38) rgba(0,0,0,.15);
      padding:9px!important;border:1px solid rgba(0,220,255,.25);border-radius:4px;
      background:linear-gradient(145deg,rgba(2,23,43,.94),rgba(0,6,15,.96));
      box-shadow:0 0 23px rgba(0,140,255,.09),inset 0 0 18px rgba(0,160,255,.025);
    }
    .hud-orchestration-panel::-webkit-scrollbar{width:5px}
    .hud-orchestration-panel::-webkit-scrollbar-thumb{background:rgba(0,220,255,.35);border-radius:8px}
    .hud-orchestration-panel .ops-grid{grid-template-columns:1fr!important;gap:4px!important}
    .hud-orchestration-panel .ops-card-title{font-size:6px!important}
    .hud-orchestration-panel .ops-step{grid-template-columns:16px minmax(0,1fr) 14px;gap:4px;padding:4px}
    .hud-orchestration-panel .ops-step-index{font-size:6px}
    .hud-orchestration-panel .ops-step-body strong,.hud-orchestration-panel .ops-approval-card strong{font-size:7px!important}
    .hud-orchestration-panel .ops-step-body small,.hud-orchestration-panel .ops-approval-card small{font-size:5px!important}
    .hud-orchestration-panel .ops-btn{font-size:6px!important;padding:4px 5px!important}
    .hud-orchestration-panel .ops-audit-row{grid-template-columns:35px 42px minmax(0,1fr);gap:3px;font-size:5px}
    .hud-orchestration-panel .ops-timeline{max-height:70px!important;overflow-y:auto!important;touch-action:pan-y}
    .hud-orchestration-panel .ops-audit-card{margin-top:5px!important}
    .hud-orchestration-panel .ops-audit{max-height:52px!important;overflow-y:auto!important;touch-action:pan-y}
    .hud-orchestration-panel .ops-card{padding:6px!important}
    .hud-orchestration-panel .ops-head{gap:5px!important}
    .hud-orchestration-panel .ops-head h3{font-size:10px!important}
    .hud-orchestration-panel .ops-head-right{font-size:6px}
    .hud-orchestration-panel .ops-boundary{font-size:5px!important}
    .hud-orchestration-panel button{touch-action:manipulation}

    @media(max-width:760px){
      .hud-command-panel{left:50%!important;bottom:7px!important;width:calc(100% - 12px)!important;height:100px!important;max-height:100px!important}
      .hud-command-panel .conversation{padding:7px 8px 3px!important}
      .hud-command-panel .starter-prompts{gap:5px!important;margin-bottom:5px!important}
      .hud-command-panel .prompt-chip{font-size:8px!important;padding:6px 8px!important;min-height:28px}
      .hud-command-panel .message p{font-size:8px!important}
      .hud-command-panel .command-composer{margin:3px 5px 5px!important;padding:6px 7px!important}
      .hud-command-panel .command-composer textarea{font-size:8px!important;min-height:20px!important;max-height:28px!important}
      .hud-command-panel .send-button{font-size:7px!important;padding:5px 7px!important}
      .hud-orchestration-panel{right:4px!important;bottom:178px!important;width:clamp(128px,34vw,150px)!important;height:clamp(118px,15vh,136px)!important;max-height:136px!important;padding:6px!important}
      .hud-starter-panel{left:4px!important;top:calc(3vh + 25vh + 6px)!important;bottom:auto!important;width:clamp(112px,34vw,148px)!important;max-height:58px!important;padding:4px!important}
      body[data-environment="lab"] .hud-starter-panel{left:auto!important;right:4px!important;bottom:154px!important;width:clamp(120px,32vw,142px)!important;max-height:48px!important}
      .hud-starter-panel .prompt-chip{font-size:6px!important;padding:3px 4px!important;min-height:20px!important}
      .hud-orchestration-panel .ops-head h3{font-size:8px!important}
      .hud-orchestration-panel .ops-head-right{font-size:5px!important;gap:3px}
      .hud-orchestration-panel .ops-grid{gap:4px!important}
      .hud-orchestration-panel .ops-card-title{font-size:6px!important}
      .hud-orchestration-panel .ops-timeline{max-height:53px!important}
      .hud-orchestration-panel .ops-audit{max-height:36px!important}
      .hud-orchestration-panel .ops-step{padding:3px!important}
      .hud-orchestration-panel .ops-step-body strong,.hud-orchestration-panel .ops-approval-card strong{font-size:6px!important}
      .hud-orchestration-panel .ops-step-body small,.hud-orchestration-panel .ops-approval-card small{font-size:5px!important}
      .hud-orchestration-panel .ops-btn{font-size:5px!important;padding:4px!important}
      .hud-orchestration-panel .ops-boundary{font-size:4px!important}
    }

  `;
  document.head.appendChild(style);

  const timeline = $('#opsTimeline');
  const audit = $('#opsAudit');
  const approval = $('#opsApproval');
  const progress = $('#opsProgress');
  const pulse = $('#opsPulse');
  const state = safeJSON(STORAGE, { approvals: {}, audit: [], recovered: {} });
  const missions = () => safeJSON(MISSION_STORAGE, []).filter(m => m && typeof m.title === 'string');
  const now = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const writeState = () => save(STORAGE, state);
  function addAudit(type, text, id) { state.audit.unshift({ type, text, id: id || '', time: now() }); state.audit = state.audit.slice(0, 30); writeState(); }
  function render() {
    const list = missions(), done = list.filter(m => m.state === 'DONE').length;
    const active = list.find(m => m.state === 'IN PROGRESS') || list.find(m => m.state === 'READY');
    progress.textContent = list.length ? `${done}/${list.length} COMPLETE · ${active ? active.state : 'STABLE'}` : 'NO ACTIVE MISSION';
    pulse.textContent = active ? 'SYNCED' : 'STANDBY';
    if (!list.length) { timeline.innerHTML = '<div class="ops-empty">MISSION TELEMETRY AWAITS A WORKFLOW</div>'; approval.innerHTML = '<div class="ops-empty">No task is waiting for approval.</div>'; }
    else {
      timeline.innerHTML = list.map((m,i) => { const approved=state.approvals[m.id]===true; const cls=m.state==='DONE'?' is-done':''; return `<div class="ops-step${cls}"><span class="ops-step-index">${String(i+1).padStart(2,'0')}</span><div class="ops-step-body"><strong>${esc(m.title)}</strong><small>${esc(m.detail||'LOCAL PLAN')} · ${esc(m.state||'READY')}</small></div><span class="ops-node ${m.state==='DONE'?'done':m.state==='IN PROGRESS'?'active':approved?'approved':'waiting'}">${m.state==='DONE'?'✓':m.state==='IN PROGRESS'?'◒':approved?'✓':'○'}</span></div>`; }).join('');
      if(active){const approved=state.approvals[active.id]===true; approval.innerHTML=`<div class="ops-approval-card"><div><span class="panel-kicker">NEXT CHECKPOINT</span><strong>${esc(active.title)}</strong><small>${approved?'Approved locally · ready for the next manual step.':'Human approval required before this checkpoint is considered cleared.'}</small></div><div class="ops-actions"><button type="button" class="ops-btn primary" data-ops-approve="${esc(active.id)}">${approved?'Approved ✓':'Approve checkpoint'}</button><button type="button" class="ops-btn" data-ops-hold="${esc(active.id)}">Hold</button><button type="button" class="ops-btn" data-ops-recover="${esc(active.id)}">Recovery note</button></div></div>`;} else approval.innerHTML='<div class="ops-empty">All queued tasks are complete. No checkpoint is awaiting approval.</div>';
    }
    audit.innerHTML=state.audit.length?state.audit.slice(0,8).map(e=>`<div class="ops-audit-row"><time>${esc(e.time)}</time><span>${esc(e.type)}</span><p>${esc(e.text)}</p></div>`).join(''):'<div class="ops-empty">Audit trail is clean. No orchestration events recorded yet.</div>';
  }
  deck.addEventListener('click',event=>{const approve=event.target.closest('[data-ops-approve]'),hold=event.target.closest('[data-ops-hold]'),recover=event.target.closest('[data-ops-recover]');if(approve){const id=approve.dataset.opsApprove;state.approvals[id]=true;addAudit('APPROVED','Human checkpoint approved locally. No external action was executed.',id);render();}if(hold){const id=hold.dataset.opsHold;state.approvals[id]=false;addAudit('HELD','Checkpoint held for review. No external action was executed.',id);render();}if(recover){const id=recover.dataset.opsRecover;state.recovered[id]=now();addAudit('RECOVERY','Recovery marker created. Review the mission queue before continuing.',id);render();}});
  $('#opsClearAudit')?.addEventListener('click',()=>{state.audit=[];writeState();render();});
  $('#opsRefresh')?.addEventListener('click',()=>{addAudit('SYNC','Mission telemetry refreshed from browser-local queue.','');render();});
  render(); setInterval(render,1200);
})();
