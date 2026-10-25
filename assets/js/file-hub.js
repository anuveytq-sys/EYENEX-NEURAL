/* EYENEX NEURAL — local, session-only file selection. No file upload or persistent storage. */
(() => {
  'use strict';
  const input = document.getElementById('fileHubInput');
  const choose = document.getElementById('fileHubChoose');
  const clear = document.getElementById('fileHubClear');
  const list = document.getElementById('fileHubList');
  const feedback = document.getElementById('fileHubFeedback');
  const status = document.getElementById('fileHubStatus');
  if (!input || !choose || !clear || !list || !feedback || !status) return;

  let selected = [];
  const objectUrls = new Set();
  const formatSize = bytes => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };
  const revokeUrls = () => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls.clear();
  };
  const kindOf = file => {
    if (file.type.startsWith('image/')) return 'IMAGE';
    if (file.type.startsWith('video/')) return 'VIDEO';
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'PDF';
    if (file.type.startsWith('text/')) return 'TEXT';
    return (file.name.split('.').pop() || 'FILE').slice(0, 8).toUpperCase();
  };
  function render() {
    revokeUrls();
    list.replaceChildren();
    selected.forEach((file, index) => {
      const item = document.createElement('div');
      item.className = 'file-hub-item';
      const thumb = document.createElement('div');
      thumb.className = 'file-hub-thumb';
      const kind = kindOf(file);
      if ((kind === 'IMAGE' || kind === 'VIDEO') && file.size <= 30 * 1024 * 1024) {
        const url = URL.createObjectURL(file);
        objectUrls.add(url);
        const media = document.createElement(kind === 'IMAGE' ? 'img' : 'video');
        media.src = url;
        media.alt = kind === 'IMAGE' ? 'Selected image preview' : 'Selected video preview';
        if (kind === 'VIDEO') {
          media.muted = true;
          media.playsInline = true;
          media.preload = 'metadata';
        }
        thumb.appendChild(media);
      } else {
        thumb.textContent = kind;
      }
      const meta = document.createElement('div');
      meta.className = 'file-hub-meta';
      const name = document.createElement('span');
      name.className = 'file-hub-name';
      name.textContent = file.name;
      const detail = document.createElement('span');
      detail.className = 'file-hub-detail';
      detail.textContent = kind + ' · ' + formatSize(file.size) +
        (file.size > 30 * 1024 * 1024 && (kind === 'IMAGE' || kind === 'VIDEO') ? ' · preview skipped for large file' : '');
      meta.append(name, detail);
      const remove = document.createElement('button');
      remove.className = 'file-hub-remove';
      remove.type = 'button';
      remove.textContent = 'REMOVE';
      remove.setAttribute('aria-label', 'Remove ' + file.name);
      remove.addEventListener('click', () => {
        selected.splice(index, 1);
        syncInputAndRender();
      });
      item.append(thumb, meta, remove);
      list.appendChild(item);
    });
    clear.disabled = selected.length === 0;
    status.textContent = selected.length ? selected.length + ' SELECTED' : 'READY';
    feedback.textContent = selected.length
      ? selected.length + ' file' + (selected.length === 1 ? '' : 's') + ' selected. Files remain local to this page session; nothing has been uploaded.'
      : 'No files selected.';
  }
  function syncInputAndRender() {
    if (typeof DataTransfer !== 'undefined') {
      const transfer = new DataTransfer();
      selected.forEach(file => transfer.items.add(file));
      input.files = transfer.files;
    }
    render();
  }
  choose.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    const existing = new Set(selected.map(file => [file.name, file.size, file.lastModified].join('|')));
    for (const file of Array.from(input.files || [])) {
      const key = [file.name, file.size, file.lastModified].join('|');
      if (!existing.has(key)) {
        selected.push(file);
        existing.add(key);
      }
    }
    render();
  });
  clear.addEventListener('click', () => {
    selected = [];
    input.value = '';
    render();
  });
  window.addEventListener('beforeunload', revokeUrls);
  render();
})();
