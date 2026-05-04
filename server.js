const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');

const app = express();
const PORT = process.env.PORT || 3000;

const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const DATA_FILE = path.join(__dirname, 'stories.json');
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readStories() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeStories(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const ALLOWED_MIME = [
  'image/jpeg','image/png','image/gif','image/webp',
  'application/pdf',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/webm',
];
const MAX_SIZE = 10 * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, UPLOADS_DIR),
  filename: (_,file,cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safe = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_,file,cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null,true);
    else cb(new Error('Tipo de arquivo não permitido. Use imagem, PDF ou áudio.'));
  },
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/stories', (_,res) => {
  res.json(readStories().filter(s=>s.status==='approved'));
});

app.get('/api/admin/stories', (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN||'voo2026')) return res.status(401).json({error:'Não autorizado.'});
  res.json(readStories());
});

app.patch('/api/admin/stories/:id', (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN||'voo2026')) return res.status(401).json({error:'Não autorizado.'});
  const stories = readStories();
  const idx = stories.findIndex(s=>s.id===req.params.id);
  if (idx===-1) return res.status(404).json({error:'Não encontrada.'});
  const {status} = req.body;
  if (!['approved','rejected','pending'].includes(status)) return res.status(400).json({error:'Status inválido.'});
  stories[idx].status = status;
  writeStories(stories);
  res.json(stories[idx]);
});

app.delete('/api/admin/stories/:id', (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN||'voo2026')) return res.status(401).json({error:'Não autorizado.'});
  let stories = readStories();
  const story = stories.find(s=>s.id===req.params.id);
  if (!story) return res.status(404).json({error:'Não encontrada.'});
  if (story.file) {
    const fp = path.join(UPLOADS_DIR, path.basename(story.file));
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  stories = stories.filter(s=>s.id!==req.params.id);
  writeStories(stories);
  res.json({ok:true});
});

app.post('/api/stories', upload.single('arquivo'), (req,res) => {
  try {
    const nome = sanitizeHtml(req.body.nome||'',{allowedTags:[]}).trim();
    const texto = sanitizeHtml(req.body.texto||'',{allowedTags:[]}).trim();
    if (!nome||nome.length<2) return res.status(400).json({error:'Nome inválido.'});
    if (!texto||texto.length<20) return res.status(400).json({error:'Texto muito curto (mínimo 20 caracteres).'});
    if (nome.length>120) return res.status(400).json({error:'Nome muito longo.'});
    if (texto.length>10000) return res.status(400).json({error:'Texto muito longo (máximo 10.000 caracteres).'});
    const story = {
      id: crypto.randomBytes(12).toString('hex'),
      nome, texto,
      file: req.file ? `/uploads/${req.file.filename}` : null,
      fileOriginalName: req.file ? req.file.originalname : null,
      fileMime: req.file ? req.file.mimetype : null,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    const stories = readStories();
    stories.unshift(story);
    writeStories(stories);
    res.status(201).json({ok:true,id:story.id});
  } catch(err) {
    res.status(500).json({error:'Erro interno do servidor.'});
  }
});

app.use((err,req,res,next) => {
  if (err instanceof multer.MulterError) {
    if (err.code==='LIMIT_FILE_SIZE') return res.status(400).json({error:'Arquivo muito grande (máx 10 MB).'});
    return res.status(400).json({error:err.message});
  }
  if (err) return res.status(400).json({error:err.message});
  next();
});

app.listen(PORT, () => console.log(`Voo da Memoria rodando em http://localhost:${PORT}`));
