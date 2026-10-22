(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const STORAGE = 'eyenex-neural-mission-ops-v1';
  const MISSION_STORAGE = 'eyenex-neural-missions-v1';
  const safeJSON = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key) || ''); return v ?? fallback; } catch (_) { return fallback; } };
  const save = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {} };
  const esc = v => String(v).replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
  const deck = $('#orchestrationDeck');
  if (!deck) return;
  const timeline = $('#opsTimeline');
  const audit = $('#opsAudit');
  const approval = $('#opsApproval');
  const progress = $('#opsProgress');
  const pulse = $('#opsPulse');
  const state = safeJSON(STORAGE, { approvals: {}, audit: [], recovered: {} });
  const missions = () => safeJSON(MISSION_STORAGE, []).filter(m => m && typeof m.title === 'string');
  const now = () => new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const writeState = () => save(STORAGE, state);
  function addAudit(type, text, id) {
    state.audit.unshift({ type, text, id: id || '', time: now() });
    state.audit = state.audit.slice(0, 30);
    writeState();
  }
  function render() {
    const list = missions();
    const done = list.filter(m => m.state === 'DONE').length;
    const active = list.find(m => m.state === 'IN PROGRESS') || list.find(m => m.state === 'READY');
    progress.textContent = list.length ? `${done}/${list.length} COMPLETE · ${active ? active.state : 'STABLE'}` : 'NO ACTIVE MISSION';
    pulse.textContent = active ? 'SYNCED' : 'STANDBY';
    if (!list.length) {
      timeline.innerHTML = '<div class="ops-empty">MISSION TELEMETRY AWAITS A WORKFLOW</div>';
      approval.innerHTML = '<div class="ops-empty">No task is waiting for approval.</div>';
    } else {
      timeline.innerHTML = list.map((m, i) => {
        const approved = state.approvals[m.id] === true;
        const doneClass = m.state === 'DONE' ? ' is-done' : '';
        return `<div class="ops-step${doneClass}"><span class="ops-step-index">${String(i + 1).padStart(2, '0')}</span><div class="ops-step-body"><strong>${esc(m.title)}</strong><small>${esc(m.detail || 'LOCAL PLAN')} · ${esc(m.state || 'READY')}</small></div><span class="ops-node ${m.state === 'DONE' ? 'done' : m.state === 'IN PROGRESS' ? 'active' : approved ? 'approved' : 'waiting'}">${m.state === 'DONE' ? '✓' : m.state === 'IN PROGRESS' ? '◒' : approved ? '✓' : '○'}</span></div>`;
      }).join('');
      if (active) {
        const approved = state.approvals[active.id] === true;
        approval.innerHTML = `<div class="ops-approval-card"><div><span class="panel-kicker">NEXT CHECKPOINT</span><strong>${esc(active.title)}</strong><small>${approved ? 'Approved locally · ready for the next manual step.' : 'Human approval required before this checkpoint is considered cleared.'}</small></div><div class="ops-actions"><button type="button" class="ops-btn primary" data-ops-approve="${esc(active.id)}">${approved ? 'Approved ✓' : 'Approve checkpoint'}</button><button type="button" class="ops-btn" data-ops-hold="${esc(active.id)}">Hold</button><button type="button" class="ops-btn" data-ops-recover="${esc(active.id)}">Recovery note</button></div></div>`;
      } else approval.innerHTML = '<div class="ops-empty">All queued tasks are complete. No checkpoint is awaiting approval.</div>';
    }
    audit.innerHTML = state.audit.length ? state.audit.slice(0, 8).map(e => `<div class="ops-audit-row"><time>${esc(e.time)}</time><span>${esc(e.type)}</span><p>${esc(e.text)}</p></div>`).join('') : '<div class="ops-empty">Audit trail is clean. No orchestration events recorded yet.</div>';
  }
  deck.addEventListener('click', event => {
    const approve = event.target.closest('[data-ops-approve]');
    const hold = event.target.closest('[data-ops-hold]');
    const recover = event.target.closest('[data-ops-recover]');
    if (approve) {
      const id = approve.dataset.opsApprove;
      state.approvals[id] = true;
      addAudit('APPROVED', 'Human checkpoint approved locally. No external action was executed.', id);
      render();
    }
    if (hold) {
      const id = hold.dataset.opsHold;
      state.approvals[id] = false;
      addAudit('HELD', 'Checkpoint held for review. No external action was executed.', id);
      render();
    }
    if (recover) {
      const id = recover.dataset.opsRecover;
      state.recovered[id] = now();
      addAudit('RECOVERY', 'Recovery marker created. Review the mission queue before continuing.', id);
      render();
    }
  });
  $('#opsClearAudit')?.addEventListener('click', () => { state.audit = []; writeState(); render(); });
  $('#opsRefresh')?.addEventListener('click', () => { addAudit('SYNC', 'Mission telemetry refreshed from browser-local queue.', ''); render(); });
  render();
  setInterval(render, 1200);
})();
