(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const MAX_FILES = 14;
  const MAX_SELECTED = 3;
  const MAX_BYTES_PER_FILE = 24000;
  const MAX_TOTAL_BYTES = 60000;

  const repoSection = $('.repo-intel');
  const scanForm = $('#repoScanForm');
  const result = $('#repoScanResult');
  if (!repoSection || !scanForm || !result) return;

  const style = document.createElement('style');
  style.textContent = `
    .deep-intel{margin-top:8px;padding-top:8px;border-top:1px solid rgba(90,170,194,.12)}
    .deep-intel-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .deep-intel-title{font:7px 'DM Mono',monospace;letter-spacing:.09em;color:#6daabd}
    .deep-intel-badge{font:6px 'DM Mono',monospace;color:#75e8f7;border:1px solid rgba(0,220,255,.22);padding:3px 5px;border-radius:3px}
    .deep-intel-copy{margin:4px 0 6px;color:rgba(190,222,232,.62);font-size:7px;line-height:1.45}
    .deep-intel-actions{display:flex;flex-wrap:wrap;gap:5px}
    .deep-intel-btn{border:1px solid rgba(0,220,255,.25);background:rgba(0,110,170,.08);color:#aee9f3;border-radius:3px;padding:5px 7px;font:7px 'DM Mono',monospace;cursor:pointer}
    .deep-intel-btn:disabled{opacity:.45;cursor:not-allowed}
    .deep-file-list{display:grid;gap:3px;margin-top:6px;max-height:88px;overflow:auto;padding-right:2px}
    .deep-file-row{display:grid;grid-template-columns:15px minmax(0,1fr);align-items:center;gap:5px;padding:4px 5px;border:1px solid rgba(90,170,194,.1);background:rgba(0,8,18,.28);border-radius:3px}
    .deep-file-row input{margin:0;accent-color:#43dff2}
    .deep-file-row label{min-width:0;color:#b9dce5;font:6px 'DM Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}
    .deep-report{margin-top:6px;max-height:125px;overflow:auto;padding:7px;border:1px solid rgba(90,170,194,.12);background:rgba(0,6,14,.35);border-radius:3px}
    .deep-report h4{margin:0 0 5px;color:#dff8ff;font-size:8px}
    .deep-report ul{margin:4px 0 0 15px;padding:0;color:rgba(204,229,236,.72);font-size:7px;line-height:1.45}
    .deep-report li+li{margin-top:3px}
    .deep-report .deep-ok{color:#74e7c2}
    .deep-report .deep-warn{color:#f4d27b}
    .deep-report .deep-risk{color:#ff9b9b}
    .deep-report .deep-meta{color:#5f94a3;font:6px 'DM Mono',monospace;margin-bottom:5px}
    .deep-report .deep-note{margin-top:6px;color:rgba(130,178,193,.55);font:6px 'DM Mono',monospace}
    @media(max-width:760px){.deep-file-list{max-height:72px}.deep-report{max-height:105px}.deep-intel-copy{font-size:6px}.deep-intel-btn{font-size:6px;padding:4px 6px}}
  `;
  document.head.appendChild(style);

  const panel = document.createElement('section');
  panel.className = 'deep-intel';
  panel.setAttribute('aria-labelledby', 'deepIntelTitle');
  panel.innerHTML = `
    <div class="deep-intel-head">
      <span class="deep-intel-title" id="deepIntelTitle">SOURCE INTELLIGENCE / DEEP REVIEW</span>
      <span class="deep-intel-badge">READ-ONLY</span>
    </div>
    <p class="deep-intel-copy">After a public scan, inspect a small set of source files for architecture signals, likely bugs, security smells, and performance hotspots. Nothing is executed or modified.</p>
    <div class="deep-intel-actions">
      <button class="deep-intel-btn" id="deepLoadFiles" type="button">Load source map</button>
      <button class="deep-intel-btn" id="deepReview" type="button" disabled>Review selected</button>
    </div>
    <div class="deep-file-list" id="deepFileList" hidden></div>
    <div class="deep-report" id="deepReport" aria-live="polite"><div class="deep-meta">SOURCE REVIEW STANDBY</div><div class="deep-note">Public GitHub files only · capped locally · no execution.</div></div>
  `;
  repoSection.appendChild(panel);

  const loadButton = $('#deepLoadFiles', panel);
  const reviewButton = $('#deepReview', panel);
  const fileList = $('#deepFileList', panel);
  const report = $('#deepReport', panel);
  let currentFiles = [];

  function setReport(title, body) {
    report.innerHTML = `<h4>${escapeHTML(title)}</h4>${body}`;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>\"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;', "'":'&#39;' }[c]));
  }

  function parseRepo() {
    const raw = String($('#repoUrl')?.value || '').trim().replace(/\/+$/, '');
    let url;
    try { url = new URL(raw); } catch (_) { return null; }
    if (url.hostname !== 'github.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  }

  async function githubJSON(path) {
    const response = await fetch(`https://api.github.com${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
    return response.json();
  }

  function candidateFiles(tree) {
    const ignored = /(^|\/)(node_modules|dist|build|coverage|\.git)(\/|$)/i;
    const binary = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|mp4|mp3|woff2?|ttf|otf)$/i;
    return tree.filter(item => item.type === 'blob' && !ignored.test(item.path) && !binary.test(item.path))
      .filter(item => /\.(js|mjs|cjs|ts|tsx|jsx|html?|css|json|md|py|java|kt|go|rs|cpp|c|h|yml|yaml)$/i.test(item.path))
      .sort((a,b) => scoreFile(b.path) - scoreFile(a.path) || a.path.localeCompare(b.path))
      .slice(0, MAX_FILES);
  }

  function scoreFile(path) {
    const lower = path.toLowerCase();
    let score = 0;
    if (/readme|package\.json|vite\.config|next\.config|webpack|tsconfig|manifest|index\./.test(lower)) score += 8;
    if (/src\/|app\/|lib\/|server\/|api\//.test(lower)) score += 5;
    if (/\.(js|ts|tsx|jsx|py|java|go|rs|cpp|c)$/.test(lower)) score += 3;
    return score;
  }

  async function loadSourceMap() {
    const repo = parseRepo();
    if (!repo) {
      setReport('Repository URL needed', '<div class="deep-note">Enter a public github.com/owner/repository URL and run the normal scan first.</div>');
      return;
    }
    loadButton.disabled = true;
    reviewButton.disabled = true;
    fileList.hidden = true;
    fileList.innerHTML = '';
    setReport('Building source map…', '<div class="deep-note">Reading the public repository tree only. No source is executed.</div>');
    try {
      const meta = await githubJSON(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
      const branch = meta.default_branch || 'main';
      const tree = await githubJSON(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
      if (!Array.isArray(tree.tree)) throw new Error('Repository tree unavailable.');
      currentFiles = candidateFiles(tree.tree);
      if (!currentFiles.length) throw new Error('No supported source files were found in the public tree.');
      currentFiles.forEach((file, index) => {
        const id = `deep-file-${index}`;
        const row = document.createElement('div');
        row.className = 'deep-file-row';
        row.innerHTML = `<input id="${id}" type="checkbox" data-path="${escapeHTML(file.path)}"><label for="${id}" title="${escapeHTML(file.path)}">${escapeHTML(file.path)}</label>`;
        fileList.appendChild(row);
      });
      fileList.hidden = false;
      setReport('Source map ready', `<div class="deep-meta">${currentFiles.length} candidate files · select up to ${MAX_SELECTED}</div><div class="deep-note">Priority favors entry points, configuration, application code, and server/API folders.</div>`);
    } catch (error) {
      setReport('Source map unavailable', `<div class="deep-note">${escapeHTML(error.message || 'Unknown error')}</div>`);
    } finally {
      loadButton.disabled = false;
    }
  }

  async function fetchText(path) {
    const response = await fetch(`https://raw.githubusercontent.com/${encodeURIComponent(parseRepo().owner)}/${encodeURIComponent(parseRepo().repo)}/${encodeURIComponent(currentBranch)}/${path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Could not read ${path} (${response.status})`);
    const text = await response.text();
    return text.slice(0, MAX_BYTES_PER_FILE);
  }

  let currentBranch = 'main';

  function inspect(path, text) {
    const findings = [];
    const lines = text.split(/\r?\n/);
    const add = (severity, message) => findings.push({ severity, message });
    if (/\beval\s*\(|new\s+Function\s*\(/.test(text)) add('risk', 'Dynamic code execution pattern detected (eval/new Function). Review whether it is necessary.');
    if (/document\.write\s*\(|innerHTML\s*=|outerHTML\s*=/.test(text)) add('warn', 'Direct HTML injection sinks are present; verify that untrusted input is escaped before insertion.');
    if (/TODO|FIXME|XXX/.test(text)) add('warn', 'TODO/FIXME markers exist and may indicate unfinished or intentionally deferred work.');
    if (/console\.(log|debug|trace)\s*\(/.test(text)) add('warn', 'Console logging is present; remove noisy diagnostics from production paths where appropriate.');
    if (/fetch\s*\(/.test(text) && !/\.catch\s*\(|try\s*\{/.test(text)) add('warn', 'Network requests appear without an obvious local catch/try path; verify failure handling.');
    if (/setInterval\s*\(|setTimeout\s*\(/.test(text) && text.length > 18000) add('warn', 'Large file contains timers; review cleanup and lifecycle behavior to avoid unnecessary background work.');
    if (/querySelectorAll\s*\([^)]*\*|getElementsByTagName\s*\(\s*['\"]\*['\"]/.test(text)) add('warn', 'Broad DOM queries detected; check whether narrower selectors can reduce repeated work.');
    if (lines.length > 900 || text.length > 22000) add('warn', 'Large source unit detected; splitting responsibilities may improve maintainability and reviewability.');
    if (/password|api[_-]?key|secret|token/i.test(text) && /localStorage|sessionStorage|document\.cookie/i.test(text)) add('risk', 'Potential credential-related browser storage/access pattern detected; verify that secrets are not exposed unnecessarily.');
    if (!findings.length) add('ok', 'No high-signal heuristic issues detected in this capped source sample. This is not a formal security audit.');
    return findings;
  }

  async function reviewSelected() {
    const selected = [...fileList.querySelectorAll('input[type="checkbox"]:checked')];
    if (!selected.length) {
      setReport('Select source files', '<div class="deep-note">Choose one to three files from the source map first.</div>');
      return;
    }
    if (selected.length > MAX_SELECTED) {
      setReport('Too many files selected', `<div class="deep-note">Select at most ${MAX_SELECTED} files so the review stays fast and bounded.</div>`);
      return;
    }
    reviewButton.disabled = true;
    setReport('Reviewing source…', '<div class="deep-note">Fetching selected public files only. Source is inspected as text and never executed.</div>');
    let total = 0;
    const all = [];
    try {
      const repo = parseRepo();
      const meta = await githubJSON(`/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`);
      currentBranch = meta.default_branch || 'main';
      for (const box of selected) {
        const path = box.dataset.path;
        const response = await fetch(`https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/${encodeURIComponent(currentBranch)}/${path.split('/').map(encodeURIComponent).join('/')}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Could not read ${path} (${response.status})`);
        const text = (await response.text()).slice(0, MAX_BYTES_PER_FILE);
        total += text.length;
        if (total > MAX_TOTAL_BYTES) break;
        all.push({ path, findings: inspect(path, text), bytes: text.length });
      }
      const counts = all.flatMap(x => x.findings).reduce((acc, f) => { acc[f.severity] = (acc[f.severity] || 0) + 1; return acc; }, {});
      const list = all.map(file => `<li><strong>${escapeHTML(file.path)}</strong> <span class="deep-meta">${file.bytes} chars</span><ul>${file.findings.map(f => `<li class="deep-${f.severity}">${escapeHTML(f.message)}</li>`).join('')}</ul></li>`).join('');
      setReport('Source intelligence report', `<div class="deep-meta">${all.length} files · ${total} chars · ${counts.risk || 0} risk · ${counts.warn || 0} review signals</div><ul>${list}</ul><div class="deep-note">Heuristic review only. It does not prove a vulnerability or replace tests, code review, or a full security audit.</div>`);
    } catch (error) {
      setReport('Source review stopped', `<div class="deep-note">${escapeHTML(error.message || 'Unknown error')}</div>`);
    } finally {
      reviewButton.disabled = false;
    }
  }

  fileList.addEventListener('change', () => {
    const selected = fileList.querySelectorAll('input[type="checkbox"]:checked').length;
    if (selected > MAX_SELECTED) {
      const boxes = [...fileList.querySelectorAll('input[type="checkbox"]:checked')];
      boxes[boxes.length - 1].checked = false;
    }
    reviewButton.disabled = fileList.querySelectorAll('input[type="checkbox"]:checked').length === 0;
  });
  loadButton.addEventListener('click', loadSourceMap);
  reviewButton.addEventListener('click', reviewSelected);
})();
