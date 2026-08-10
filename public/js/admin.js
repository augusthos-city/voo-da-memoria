/* ══ VOO DA MEMÓRIA — Admin JS ════════════════════════════ */

let adminToken = '';
let allStories = [];
let currentFilter = 'all';

const adminLogin = document.getElementById('adminLogin');
const adminPanel = document.getElementById('adminPanel');
const loginBtn = document.getElementById('loginBtn');
const loginErr = document.getElementById('loginErr');
const adminList = document.getElementById('adminList');
const adminStats = document.getElementById('adminStats');

// ── Login ────────────────────────────────────────────────────
loginBtn.addEventListener('click', tryLogin);
document.getElementById('adminToken').addEventListener('keydown', e => {
  if (e.key === 'Enter') tryLogin();
});

async function tryLogin() {
  const token = document.getElementById('adminToken').value.trim();
  if (!token) { loginErr.textContent = 'Insira o token.'; return; }
  loginBtn.textContent = 'Verificando…'; loginBtn.disabled = true;
  try {
    const res = await fetch('/api/admin/stories', { headers: { 'x-admin-token': token } });
    if (res.status === 401) { loginErr.textContent = 'Token inválido.'; return; }
    adminToken = token;
    allStories = await res.json();
    adminLogin.hidden = true;
    adminPanel.hidden = false;
    renderStories();
    updateStats();
  } catch { loginErr.textContent = 'Erro de conexão.'; }
  finally { loginBtn.textContent = 'Entrar'; loginBtn.disabled = false; }
}

document.getElementById('logoutBtn').addEventListener('click', () => {
  adminToken = ''; allStories = [];
  adminPanel.hidden = true; adminLogin.hidden = false;
  document.getElementById('adminToken').value = '';
  loginErr.textContent = '';
});

// ── Filter buttons ───────────────────────────────────────────
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    renderStories();
  });
});

// ── Render ───────────────────────────────────────────────────
function renderStories() {
  const filtered = currentFilter === 'all'
    ? allStories
    : allStories.filter(s => s.status === currentFilter);

  if (!filtered.length) {
    adminList.innerHTML = '<div class="admin-empty">Nenhuma história nesta categoria.</div>';
    return;
  }

  adminList.innerHTML = filtered.map(s => `
    <div class="admin-card" data-id="${s._id}">
      <div class="admin-card-header">
        <div class="admin-card-meta">
          <span class="admin-card-name">${escHtml(s.nome)}</span>
          <span class="admin-card-date">${new Date(s.createdAt).toLocaleString('pt-BR')}</span>
        </div>
        <span class="admin-card-status status-${s.status}">${statusLabel(s.status)}</span>
      </div>
      <div class="admin-card-text">${escHtml(s.texto)}</div>
      ${s.file ? `<div class="admin-card-file">
        <a class="story-file-link" href="${s.file}" target="_blank" rel="noopener">
          📎 ${escHtml(s.fileOriginalName||'Arquivo')}
        </a>
      </div>` : ''}
      <div class="admin-card-actions">
        ${s.status !== 'approved' ? `<button class="action-btn action-approve" onclick="setStatus('${s._id}','approved')">✓ Aprovar</button>` : ''}
        ${s.status !== 'rejected' ? `<button class="action-btn action-reject" onclick="setStatus('${s._id}','rejected')">✕ Rejeitar</button>` : ''}
        ${s.status !== 'pending'  ? `<button class="action-btn action-pending" onclick="setStatus('${s._id}','pending')">↩ Pendente</button>` : ''}
        <button class="action-btn action-delete" onclick="deleteStory('${s._id}')">🗑 Excluir</button>
      </div>
    </div>
  `).join('');
}

function statusLabel(s) {
  return { pending:'⏳ Pendente', approved:'✓ Aprovada', rejected:'✕ Rejeitada' }[s] || s;
}

function updateStats() {
  const p = allStories.filter(s=>s.status==='pending').length;
  const a = allStories.filter(s=>s.status==='approved').length;
  const r = allStories.filter(s=>s.status==='rejected').length;
  adminStats.innerHTML = `
    <div class="admin-stat">Total: <strong>${allStories.length}</strong></div>
    <div class="admin-stat">⏳ <strong>${p}</strong></div>
    <div class="admin-stat">✓ <strong>${a}</strong></div>
    <div class="admin-stat">✕ <strong>${r}</strong></div>
  `;
}

// ── Actions ──────────────────────────────────────────────────
async function setStatus(id, status) {
  try {
    const res = await fetch(`/api/admin/stories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json', 'x-admin-token': adminToken },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) { alert('Erro ao atualizar.'); return; }
    const updated = await res.json();
    const idx = allStories.findIndex(s => s._id === id);
    if (idx !== -1) allStories[idx] = updated;
    renderStories(); updateStats();
  } catch { alert('Erro de rede.'); }
}

async function deleteStory(id) {
  if (!confirm('Excluir permanentemente esta história?')) return;
  try {
    const res = await fetch(`/api/admin/stories/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': adminToken },
    });
    if (!res.ok) { alert('Erro ao excluir.'); return; }
    allStories = allStories.filter(s => s._id !== id);
    renderStories(); updateStats();
  } catch { alert('Erro de rede.'); }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}
