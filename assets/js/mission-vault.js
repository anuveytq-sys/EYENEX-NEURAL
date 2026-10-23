(() => {
  'use strict';

  const QUEUE_KEY = 'eyenex-neural-missions-v1';
  const SNAPSHOT_KEY = 'eyenex-neural-mission-vault-snapshot-v1';
  const MAX_MISSIONS = 80;
  const states = ['READY', 'IN PROGRESS', 'DONE', 'FAILED'];
  const $ = (selector, root = document) => root.querySelector(selector);
  const missionPanel = $('.mission-panel');
  const missionList = $('#missionList');
  if (!missionPanel || !missionList || $('#missionVault')) return;

  const style = document.createElement('style');
  style.textContent = `
    #missionVault{display:grid;gap:5px;margin:7px 0 2px;padding:7px;border:1px solid rgba(76,181,210,.13);border-radius:3px;background:rgba(0,8,18,.25)}
    .mv-head{display:flex;align-items:center;justify-content:space-between;gap:5px}
    .mv-label{font:6px 'DM Mono',monospace;letter-spacing:.1em;color:#6daabd}
    .mv-count{font:6px 'DM Mono',monospace;color:rgba(180,220,232,.55)}
    .mv-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}
    .mv-search,.mv-filter{min-width:0;width:100%;box-sizing:border-box;border:1px solid rgba(89,183,210,.2);border-radius:3px;background:rgba(0,5,14,.6);color:#ccebf2;padding:5px;font:7px 'DM Mono',monospace}
    .mv-actions{display:flex;flex-wrap:wrap;gap:4px}
    .mv-btn{border:1px solid rgba(0,220,255,.22);background:rgba(0,110,170,.07);color:#aee9f3;border-radius:3px;padding:5px 6px;font:6px 'DM Mono',monospace;cursor:pointer}
    .mv-btn:disabled{opacity:.4;cursor:not-allowed}
    .mv-status{min-height:9px;color:rgba(164,213,225,.6);font:6px 'DM Mono',monospace;line-height:1.4}
    .mv-hidden{display:none!important}
    @media(max-width:760px){#missionVault{padding:5px;gap:4px}.mv-search,.mv-filter{font-size:6px;padding:4px}.mv-btn{font-size:6px;padding:4px}.mv-status{font-size:5px}}
  `;
  document.head.appendChild(style);

  const vault = document.createElement('section');
  vault.id = 'missionVault';
  vault.setAttribute('aria-label', 'Mission backup and search');
  vault.innerHTML = `
    <div class="mv-head"><span class="mv-label">MISSION VAULT / LOCAL RECOVERY</span><span class="mv-count" id="mvCount">0 ITEMS</span></div>
    <div class="mv-tools">
      <input class="mv-search" id="mvSearch" type="search" placeholder="Search queued missions…" aria-label="Search queued missions">
      <select class="mv-filter" id="mvFilter" aria-label="Filter missions by status">
        <option value="ALL">ALL STATUS</option><option>READY</option><option>IN PROGRESS</option><option>DONE</option><option>FAILED</option>
      </select>
    </div>
    <div class="mv-actions">
      <button class="mv-btn" id="mvExport" type="button">Export backup</button>
      <button class="mv-btn" id="mvImport" type="button">Import / merge</button>
      <button class="mv-btn" id="mvRestore" type="button" disabled>Restore snapshot</button>
      <input id="mvFile" type="file" accept="application/json,.json" hidden>
    </div>
    <div class="mv-status" id="mvStatus" role="status" aria-live="polite">Local-only backup. No data is uploaded.</div>
  `;
  const toolbar = $('.mission-toolbar', missionPanel);
  if (toolbar) toolbar.after(vault);
  else missionList.after(vault);

  const status = $('#mvStatus');
  const count = $('#mvCount');
  const search = $('#mvSearch');
  const filter = $('#mvFilter');
  const fileInput = $('#mvFile');
  const restoreButton = $('#mvRestore');

  const readQueue = () => {
    try {
      const value = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(value) ? value.filter(isValidMission).slice(0, MAX_MISSIONS) : [];
    } catch (_) { return []; }
  };
  const isValidMission = item => item && typeof item === 'object' && typeof item.title === 'string';
  const normalize = (item, index) => {
    const now = new Date().toISOString();
    const state = states.includes(item.state) ? item.state : 'READY';
    return {
      id: typeof item.id === 'string' && item.id ? item.id.slice(0, 100) : `import-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: item.title.slice(0, 180),
      detail: typeof item.detail === 'string' ? item.detail.slice(0, 180) : 'IMPORTED BACKUP',
      state,
      createdAt: validDate(item.createdAt) || now,
      updatedAt: validDate(item.updatedAt) || now,
      startedAt: validDate(item.startedAt) || '',
      completedAt: validDate(item.completedAt) || '',
      failedAt: validDate(item.failedAt) || '',
      error: typeof item.error === 'string' ? item.error.slice(0, 240) : ''
    };
  };
  const validDate = value => typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : '';
  const setStatus = message => { status.textContent = message; };
  const readSnapshot = () => {
    try {
      const snapshot = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || 'null');
      return snapshot && Array.isArray(snapshot.missions) ? snapshot : null;
    } catch (_) { return null; }
  };
  const saveSnapshot = (reason, missions = readQueue()) => {
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), reason, missions }));
      refreshCount();
      return true;
    } catch (_) {
      setStatus('Snapshot could not be saved; browser storage may be full.');
      return false;
    }
  };
  function refreshCount() {
    const missions = readQueue();
    count.textContent = `${missions.length} ITEMS`;
    restoreButton.disabled = !readSnapshot();
  }
  function applyFilters() {
    const term = search.value.trim().toLowerCase();
    const selectedState = filter.value;
    let visible = 0;
    missionList.querySelectorAll('.mission-item').forEach(row => {
      const text = row.textContent.toLowerCase();
      const stateMatch = selectedState === 'ALL' || text.includes(selectedState.toLowerCase());
      const show = text.includes(term) && stateMatch;
      row.classList.toggle('mv-hidden', !show);
      if (show) visible++;
    });
    const total = missionList.querySelectorAll('.mission-item').length;
    if (term || selectedState !== 'ALL') setStatus(`Showing ${visible} of ${total} visible queue items. Filters do not change task state.`);
    else if (!status.dataset.persistent) setStatus('Local-only backup. No data is uploaded.');
  }
  search.addEventListener('input', applyFilters);
  filter.addEventListener('change', applyFilters);
  new MutationObserver(() => { refreshCount(); applyFilters(); }).observe(missionList, { childList: true, subtree: true });

  // Capture the queue before the existing Clear queue handler changes it.
  document.addEventListener('click', event => {
    const clear = event.target.closest('#clearMissions');
    if (clear) {
      const current = readQueue();
      if (current.length) {
        saveSnapshot('Automatic snapshot before Clear queue', current);
        setStatus('Safety snapshot saved before the queue was cleared.');
        status.dataset.persistent = 'true';
      }
    }
  }, true);

  $('#mvExport').addEventListener('click', () => {
    const missions = readQueue();
    const payload = { format: 'eyenex-mission-backup', version: 1, exportedAt: new Date().toISOString(), missions };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eyenex-missions-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus(`Exported ${missions.length} missions to a local JSON backup.`);
    status.dataset.persistent = 'true';
  });

  $('#mvImport').addEventListener('click', () => { fileInput.value = ''; fileInput.click(); });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    if (file.size > 500000) { setStatus('Import stopped: backup file exceeds 500 KB.'); return; }
    try {
      const data = JSON.parse(await file.text());
      const imported = Array.isArray(data) ? data : data && data.format === 'eyenex-mission-backup' && Array.isArray(data.missions) ? data.missions : null;
      if (!imported) throw new Error('This is not a supported EYENEX mission backup.');
      const existing = readQueue();
      const signatures = new Set(existing.map(m => `${m.title.toLowerCase()}|${m.detail.toLowerCase()}|${m.createdAt}`));
      let additions = 0;
      const merged = existing.slice();
      for (const raw of imported) {
        if (!isValidMission(raw) || !raw.title.trim() || merged.length >= MAX_MISSIONS) continue;
        const item = normalize(raw, additions);
        const signature = `${item.title.toLowerCase()}|${item.detail.toLowerCase()}|${item.createdAt}`;
        if (signatures.has(signature)) continue;
        if (merged.some(m => m.id === item.id)) item.id = `import-${Date.now()}-${additions}-${Math.random().toString(36).slice(2, 7)}`;
        merged.push(item);
        signatures.add(signature);
        additions++;
      }
      if (!additions) { setStatus('No new missions imported (duplicates, invalid entries, or queue limit reached).'); return; }
      saveSnapshot('Automatic snapshot before mission import', existing);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(merged));
      setStatus(`Merged ${additions} mission(s). Existing missions were preserved. Reload the page to refresh the mission queue display.`);
      status.dataset.persistent = 'true';
      refreshCount();
    } catch (error) {
      setStatus(error.message || 'Could not read this backup file.');
      status.dataset.persistent = 'true';
    }
  });

  restoreButton.addEventListener('click', () => {
    const snapshot = readSnapshot();
    if (!snapshot) { setStatus('No recovery snapshot is available.'); refreshCount(); return; }
    if (!window.confirm('Restore the saved mission snapshot? This replaces the current mission queue. A backup of the current queue will be exported first.')) return;
    const current = readQueue();
    try {
      const blob = new Blob([JSON.stringify({ format: 'eyenex-mission-backup', version: 1, exportedAt: new Date().toISOString(), missions: current }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `eyenex-before-restore-${Date.now()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      localStorage.setItem(QUEUE_KEY, JSON.stringify(snapshot.missions.filter(isValidMission).slice(0, MAX_MISSIONS).map(normalize)));
      setStatus('Snapshot restored. Current queue backup was exported. Reload the page to refresh the queue display.');
      status.dataset.persistent = 'true';
      refreshCount();
    } catch (_) { setStatus('Restore failed; browser storage may be unavailable.'); }
  });

  refreshCount();
  applyFilters();
})();