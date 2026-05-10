/* ══ VOO DA MEMÓRIA — Main JS ══════════════════════════════ */

// ── NAV scroll ──────────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

// ── Mobile nav toggle ───────────────────────────────────────
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');
navToggle.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});
navLinks.querySelectorAll('a').forEach(a => {
  a.addEventListener('click', () => navLinks.classList.remove('open'));
});

// ── Char count ──────────────────────────────────────────────
const textoEl = document.getElementById('texto');
const charCount = document.getElementById('charCount');
textoEl.addEventListener('input', () => {
  charCount.textContent = textoEl.value.length;
});

// ── File drop zone ──────────────────────────────────────────
const fileDrop = document.getElementById('fileDrop');
const fileInput = document.getElementById('arquivo');
const fileDropInner = document.getElementById('fileDropInner');
const fileSelected = document.getElementById('fileSelected');
const fileName = document.getElementById('fileName');
const fileRemove = document.getElementById('fileRemove');
const arquivoErr = document.getElementById('arquivoErr');

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg','image/png','image/gif','image/webp','application/pdf',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/webm'];

function setFile(file) {
  if (!file) return clearFile();
  if (!ALLOWED.includes(file.type)) {
    arquivoErr.textContent = 'Tipo não permitido. Use imagem, PDF ou áudio.';
    clearFile(); return;
  }
  if (file.size > MAX_SIZE) {
    arquivoErr.textContent = 'Arquivo muito grande (máximo 10 MB).';
    clearFile(); return;
  }
  arquivoErr.textContent = '';
  fileName.textContent = file.name;
  fileDropInner.hidden = true;
  fileSelected.hidden = false;
  // Transfer to DataTransfer trick
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
}

function clearFile() {
  fileInput.value = '';
  fileDropInner.hidden = false;
  fileSelected.hidden = true;
  fileName.textContent = '';
}

fileDropInner.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => setFile(fileInput.files[0]));
fileRemove.addEventListener('click', clearFile);

fileDrop.addEventListener('dragover', e => { e.preventDefault(); fileDrop.classList.add('dragover'); });
fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
fileDrop.addEventListener('drop', e => {
  e.preventDefault();
  fileDrop.classList.remove('dragover');
  setFile(e.dataTransfer.files[0]);
});

// ── Form submission ─────────────────────────────────────────
const storyForm = document.getElementById('storyForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const formSuccess = document.getElementById('formSuccess');
const uploadBar = document.getElementById('uploadBar');
const uploadBarFill = document.getElementById('uploadBarFill');
const uploadBarPct = document.getElementById('uploadBarPct');

function showError(fieldId, msg) {
  document.getElementById(fieldId).textContent = msg;
}
function clearErrors() {
  ['nomeErr','textoErr','arquivoErr'].forEach(id => document.getElementById(id).textContent = '');
}

storyForm.addEventListener('submit', e => {
  e.preventDefault();
  clearErrors();

  const nome = document.getElementById('nome').value.trim();
  const texto = document.getElementById('texto').value.trim();
  let valid = true;

  if (!nome || nome.length < 2) { showError('nomeErr','Nome inválido (mínimo 2 caracteres).'); valid = false; }
  if (!texto || texto.length < 20) { showError('textoErr','Texto muito curto (mínimo 20 caracteres).'); valid = false; }
  if (!valid) return;

  const formData = new FormData();
  formData.append('nome', nome);
  formData.append('texto', texto);
  if (fileInput.files[0]) formData.append('arquivo', fileInput.files[0]);

  submitBtn.disabled = true;
  btnText.hidden = true;
  btnLoading.hidden = false;
  if (fileInput.files[0]) { uploadBar.hidden = false; }

  const xhr = new XMLHttpRequest();

  if (fileInput.files[0]) {
    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        uploadBarFill.style.width = pct + '%';
        uploadBarPct.textContent = pct + '%';
      }
    });
  }

  xhr.addEventListener('load', () => {
    submitBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
    uploadBar.hidden = true;

    let data;
    try { data = JSON.parse(xhr.responseText); } catch { data = {}; }

    if (xhr.status === 201) {
      storyForm.querySelector('.form-group, .form-note, .btn').style.display;
      // Hide form fields, show success
      Array.from(storyForm.children).forEach(el => { if (el !== formSuccess) el.hidden = true; });
      formSuccess.hidden = false;
      loadStories(); // refresh stories list
    } else {
      showError('textoErr', data.error || 'Erro ao enviar. Tente novamente.');
    }
  });

  xhr.addEventListener('error', () => {
    submitBtn.disabled = false;
    btnText.hidden = false;
    btnLoading.hidden = true;
    uploadBar.hidden = true;
    showError('textoErr','Erro de rede. Verifique sua conexão.');
  });

  xhr.open('POST', '/api/stories');
  xhr.send(formData);
});

document.getElementById('newStoryBtn').addEventListener('click', () => {
  Array.from(storyForm.children).forEach(el => { el.hidden = false; });
  formSuccess.hidden = true;
  storyForm.reset();
  clearFile();
  charCount.textContent = '0';
  uploadBarFill.style.width = '0%';
});

// ── Load public stories ─────────────────────────────────────
const storiesGrid = document.getElementById('storiesGrid');
const storiesLoading = document.getElementById('storiesLoading');
const storiesEmpty = document.getElementById('storiesEmpty');

function fileIcon(mime) {
  if (!mime) return '';
  if (mime.startsWith('image/')) return '🖼';
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('audio/')) return '🎵';
  return '📎';
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'long', year:'numeric' });
}

async function loadStories() {
  storiesLoading.hidden = false;
  storiesEmpty.hidden = true;
  storiesGrid.querySelectorAll('.story-card').forEach(el => el.remove());

  try {
    const res = await fetch('/api/stories');
    const stories = await res.json();
    storiesLoading.hidden = true;

    if (!stories.length) {
      storiesEmpty.hidden = false;
      return;
    }

    storiesEmpty.hidden = true;

    stories.forEach(s => {
      const card = document.createElement('article');
      card.className = 'story-card';
      const initial = s.nome ? s.nome[0].toUpperCase() : '?';
      card.innerHTML = `
        <div class="story-card-header">
          <div style="display:flex;align-items:center;gap:.75rem">
            <div class="story-avatar">${initial}</div>
            <div>
              <div class="story-name">${escHtml(s.nome)}</div>
              <div class="story-date">${formatDate(s.createdAt)}</div>
            </div>
          </div>
        </div>
        <p class="story-text">${escHtml(s.texto)}</p>
        ${s.file ? `<a class="story-file-link" href="${s.file}" download="${escHtml(s.fileOriginalName||'arquivo')}">
          ${fileIcon(s.fileMime)} ${escHtml(s.fileOriginalName||'Arquivo')}
        </a>` : ''}
      `;
      storiesGrid.appendChild(card);
    });
  } catch {
    storiesLoading.hidden = true;
    storiesEmpty.hidden = false;
  }
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
    .replace(/'/g,'&#x27;');
}

loadStories();

// ── Intersection observer for pilar animations ──────────────
const pilares = document.querySelectorAll('.pilar');
const obs = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const delay = entry.target.dataset.delay || 0;
      setTimeout(() => {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }, delay);
      obs.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

pilares.forEach(p => {
  p.style.opacity = '0';
  p.style.transform = 'translateY(30px)';
  p.style.transition = 'opacity .6s ease, transform .6s ease';
  obs.observe(p);
});
