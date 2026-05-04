/* ═══════════════════════════════════════════════════════
   VOO DA MEMÓRIA — Frontend App Logic
   ═══════════════════════════════════════════════════════ */

// ── State ─────────────────────────────────────────────────────────
let selectedFiles = [];
let allFiles      = [];
let activeFilter  = 'all';
let userRole      = null;

// ── Boot ──────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res  = await fetch('/api/me');
    const data = await res.json();
    if (res.ok) {
      loginSuccess(data.name, data.role);
    }
  } catch (_) { /* stay on login */ }
});

// ── Auth ──────────────────────────────────────────────────────────
async function doLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;
  const errEl    = document.getElementById('login-error');
  const btn      = document.getElementById('login-btn');

  if (!username || !password) {
    showError(errEl, 'Preencha usuário e senha.');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Entrando...';
  errEl.classList.add('hidden');

  try {
    const res  = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (res.ok) {
      loginSuccess(data.name, data.role);
    } else {
      showError(errEl, data.error || 'Erro ao fazer login.');
      btn.disabled = false;
      btn.textContent = 'Entrar';
    }
  } catch (_) {
    showError(errEl, 'Erro de conexão com o servidor.');
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
}

function loginSuccess(name, role) {
  userRole = role;
  document.getElementById('sidebar-username').textContent = name;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  showSection('upload');
  loadFiles();
  loadStats();
}

async function doLogout() {
  await fetch('/api/logout', { method: 'POST' });
  userRole = null;
  selectedFiles = [];
  allFiles = [];
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('login-btn').disabled = false;
  document.getElementById('login-btn').textContent = 'Entrar';
}

// Allow Enter key on login
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const ls = document.getElementById('login-screen');
    if (ls.classList.contains('active')) doLogin();
  }
});

// ── Navigation ────────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(`section-${name}`).classList.add('active');
  document.querySelector(`.nav-item[onclick="showSection('${name}')"]`).classList.add('active');

  const titles = { upload: 'Enviar Arquivos', files: 'Arquivos Enviados', about: 'Sobre o Projeto' };
  document.getElementById('section-title').textContent = titles[name] || '';

  if (name === 'files') loadFiles();
  // Close sidebar on mobile
  document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
}

// ── Stats ─────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();
    if (res.ok) {
      document.getElementById('top-stats').textContent =
        `${data.total} arquivo${data.total !== 1 ? 's' : ''} · ${formatSize(data.totalSize)}`;
    }
  } catch (_) {}
}

// ── File selection ────────────────────────────────────────────────
function handleFileSelect(e) {
  addFiles(Array.from(e.target.files));
  e.target.value = ''; // reset so same file can be re-added
}

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.add('drag-over');
}
function handleDragLeave(e) {
  document.getElementById('drop-zone').classList.remove('drag-over');
}
function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
}

function addFiles(files) {
  const MAX = 50 * 1024 * 1024;
  const ALLOWED = ['image/', 'video/', 'audio/', 'application/pdf',
                   'application/msword', 'application/vnd.openxmlformats'];

  files.forEach(f => {
    if (f.size > MAX) { showToast(`"${f.name}" excede 50MB.`, 'error'); return; }
    if (!ALLOWED.some(t => f.type.startsWith(t))) { showToast(`Tipo não permitido: ${f.name}`, 'error'); return; }
    if (selectedFiles.find(s => s.name === f.name && s.size === f.size)) return; // dedupe
    selectedFiles.push(f);
  });
  renderPreview();
}

function removeFile(idx) {
  selectedFiles.splice(idx, 1);
  renderPreview();
}

function clearFiles() {
  selectedFiles = [];
  renderPreview();
  document.getElementById('upload-result').classList.add('hidden');
}

function renderPreview() {
  const list = document.getElementById('file-preview-list');
  const actions = document.getElementById('upload-actions');

  if (selectedFiles.length === 0) {
    list.classList.add('hidden');
    actions.classList.add('hidden');
    return;
  }

  list.classList.remove('hidden');
  actions.classList.remove('hidden');

  list.innerHTML = selectedFiles.map((f, i) => `
    <div class="preview-item">
      <div class="preview-thumb">${fileEmoji(f.type)}</div>
      <div class="preview-info">
        <div class="preview-name">${escHtml(f.name)}</div>
        <div class="preview-size">${formatSize(f.size)}</div>
      </div>
      <span class="preview-remove" onclick="removeFile(${i})" title="Remover">✕</span>
    </div>
  `).join('');
}

// ── Upload ────────────────────────────────────────────────────────
async function doUpload() {
  if (selectedFiles.length === 0) { showToast('Selecione ao menos um arquivo.', 'error'); return; }

  const btn     = document.getElementById('send-btn');
  const progArea = document.getElementById('progress-area');
  const progBar  = document.getElementById('progress-bar');
  const progPct  = document.getElementById('progress-pct');
  const progText = document.getElementById('progress-text');
  const resultEl = document.getElementById('upload-result');

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Enviando...';
  progArea.classList.remove('hidden');
  resultEl.classList.add('hidden');

  const form = new FormData();
  selectedFiles.forEach(f => form.append('files', f));
  form.append('description', document.getElementById('description').value);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progBar.style.width = pct + '%';
        progPct.textContent = pct + '%';
        progText.textContent = pct < 100 ? 'Enviando...' : 'Processando...';
      }
    });

    xhr.addEventListener('load', () => {
      progArea.classList.add('hidden');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Enviar Arquivos';

      const data = JSON.parse(xhr.responseText);
      if (xhr.status === 200) {
        resultEl.className = 'result-msg success';
        resultEl.textContent = `✅ ${data.message}`;
        resultEl.classList.remove('hidden');
        selectedFiles = [];
        renderPreview();
        document.getElementById('description').value = '';
        progBar.style.width = '0%';
        loadStats();
        showToast(data.message);
      } else {
        resultEl.className = 'result-msg error';
        resultEl.textContent = `❌ ${data.error}`;
        resultEl.classList.remove('hidden');
        progBar.style.width = '0%';
      }
      resolve();
    });

    xhr.addEventListener('error', () => {
      progArea.classList.add('hidden');
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Enviar Arquivos';
      resultEl.className = 'result-msg error';
      resultEl.textContent = '❌ Erro de conexão. Tente novamente.';
      resultEl.classList.remove('hidden');
      resolve();
    });

    xhr.send(form);
  });
}

// ── Files list ────────────────────────────────────────────────────
async function loadFiles() {
  const grid = document.getElementById('files-grid');
  grid.innerHTML = '<div class="loading-spinner">Carregando arquivos...</div>';

  try {
    const res  = await fetch('/api/files');
    if (!res.ok) { grid.innerHTML = '<div class="loading-spinner">Erro ao carregar arquivos.</div>'; return; }
    allFiles = await res.json();
    renderFiles();
  } catch (_) {
    grid.innerHTML = '<div class="loading-spinner">Erro de conexão.</div>';
  }
}

function renderFiles() {
  const grid    = document.getElementById('files-grid');
  const search  = document.getElementById('search-input').value.toLowerCase();

  let files = allFiles.filter(f => {
    const matchFilter = activeFilter === 'all' || f.mimetype.startsWith(activeFilter);
    const matchSearch = !search || f.originalName.toLowerCase().includes(search) ||
                        (f.description || '').toLowerCase().includes(search) ||
                        f.uploadedBy.toLowerCase().includes(search);
    return matchFilter && matchSearch;
  });

  if (files.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <h3>Nenhum arquivo encontrado</h3>
        <p>${allFiles.length === 0 ? 'Seja o primeiro a compartilhar uma memória!' : 'Tente outros filtros ou termos de busca.'}</p>
      </div>`;
    return;
  }

  grid.innerHTML = files.map(f => `
    <div class="file-card" data-id="${f.id}">
      <div class="file-thumb">
        ${f.mimetype.startsWith('image/') 
          ? `<img src="/api/files/${f.id}/download" alt="${escHtml(f.originalName)}" loading="lazy" onerror="this.style.display='none'; this.parentElement.innerHTML='🖼️';" />`
          : fileEmoji(f.mimetype)}
        <span class="file-type-badge">${typeLabel(f.mimetype)}</span>
      </div>
      <div class="file-info">
        <div class="file-name">${escHtml(f.originalName)}</div>
        <div class="file-meta">${formatSize(f.size)} · ${formatDate(f.uploadedAt)}</div>
        <div class="file-by">👤 ${escHtml(f.uploadedBy)}</div>
        ${f.description ? `<div class="file-desc">"${escHtml(f.description)}"</div>` : ''}
      </div>
      <div class="file-actions">
        <button class="btn-download" onclick="downloadFile('${f.id}', '${escHtml(f.originalName)}')">⬇ Baixar</button>
        ${userRole === 'admin' ? `<button class="btn-delete" onclick="deleteFile('${f.id}')">🗑</button>` : ''}
      </div>
    </div>
  `).join('');
}

function filterFiles() { renderFiles(); }
function setFilter(type, el) {
  activeFilter = type;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderFiles();
}

async function downloadFile(id, name) {
  const a = document.createElement('a');
  a.href = `/api/files/${id}/download`;
  a.download = name;
  a.click();
}

async function deleteFile(id) {
  if (!confirm('Excluir este arquivo permanentemente?')) return;
  try {
    const res  = await fetch(`/api/files/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      allFiles = allFiles.filter(f => f.id !== id);
      renderFiles();
      loadStats();
      showToast('Arquivo excluído.');
    } else {
      showToast(data.error, 'error');
    }
  } catch (_) { showToast('Erro ao excluir.', 'error'); }
}

// ── Helpers ───────────────────────────────────────────────────────
function formatSize(bytes) {
  if (bytes < 1024)       return bytes + ' B';
  if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fileEmoji(mime) {
  if (!mime) return '📄';
  if (mime.startsWith('image/'))       return '🖼️';
  if (mime.startsWith('video/'))       return '🎬';
  if (mime.startsWith('audio/'))       return '🎵';
  if (mime === 'application/pdf')      return '📑';
  if (mime.includes('word'))           return '📝';
  return '📄';
}

function typeLabel(mime) {
  if (!mime) return 'DOC';
  if (mime.startsWith('image/'))  return 'IMG';
  if (mime.startsWith('video/'))  return 'VID';
  if (mime.startsWith('audio/'))  return 'ÁUD';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('word'))      return 'DOC';
  return 'ARQ';
}

function escHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

let toastTimer;
function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast${type === 'error' ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 3500);
}
