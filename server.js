const express    = require('express');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');
const crypto     = require('crypto');
const sanitizeHtml = require('sanitize-html');
const mongoose   = require('mongoose');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── MongoDB connection ───────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ Erro MongoDB:', err));

// ── Schema ───────────────────────────────────────────────────
const storySchema = new mongoose.Schema({
  nome:             { type: String, required: true },
  texto:            { type: String, required: true },
  file:             { type: String, default: null },
  fileOriginalName: { type: String, default: null },
  fileMime:         { type: String, default: null },
  status:           { type: String, enum: ['pending','approved','rejected'], default: 'pending' },
  createdAt:        { type: Date, default: Date.now },
});

const Story = mongoose.model('Story', storySchema);

// ── Upload ───────────────────────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME = [
  'image/jpeg','image/png','image/gif','image/webp',
  'application/pdf',
  'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/webm',
];

const storage = multer.diskStorage({
  destination: (_,__,cb) => cb(null, UPLOADS_DIR),
  filename:    (_,file,cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const safe = crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_,file,cb) => {
    ALLOWED_MIME.includes(file.mimetype) ? cb(null,true) : cb(new Error('Tipo de arquivo não permitido.'));
  },
});

// ── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── ROTAS ────────────────────────────────────────────────────

// Histórias públicas (aprovadas)
app.get('/api/stories', async (_,res) => {
  try {
    const stories = await Story.find({ status: 'approved' }).sort({ createdAt: -1 });
    res.json(stories);
  } catch { res.status(500).json({ error: 'Erro ao buscar histórias.' }); }
});

// Admin — todas as histórias
app.get('/api/admin/stories', async (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN || 'voo2026'))
    return res.status(401).json({ error: 'Não autorizado.' });
  try {
    const stories = await Story.find().sort({ createdAt: -1 });
    res.json(stories);
  } catch { res.status(500).json({ error: 'Erro ao buscar histórias.' }); }
});

// Admin — atualizar status
app.patch('/api/admin/stories/:id', async (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN || 'voo2026'))
    return res.status(401).json({ error: 'Não autorizado.' });
  const { status } = req.body;
  if (!['approved','rejected','pending'].includes(status))
    return res.status(400).json({ error: 'Status inválido.' });
  try {
    const story = await Story.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!story) return res.status(404).json({ error: 'Não encontrada.' });
    res.json(story);
  } catch { res.status(500).json({ error: 'Erro ao atualizar.' }); }
});

// Admin — excluir
app.delete('/api/admin/stories/:id', async (req,res) => {
  const token = req.headers['x-admin-token'];
  if (token !== (process.env.ADMIN_TOKEN || 'voo2026'))
    return res.status(401).json({ error: 'Não autorizado.' });
  try {
    const story = await Story.findByIdAndDelete(req.params.id);
    if (!story) return res.status(404).json({ error: 'Não encontrada.' });
    if (story.file) {
      const fp = path.join(UPLOADS_DIR, path.basename(story.file));
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Erro ao excluir.' }); }
});

// Enviar história
app.post('/api/stories', upload.single('arquivo'), async (req,res) => {
  try {
    const nome  = sanitizeHtml(req.body.nome  || '', { allowedTags: [] }).trim();
    const texto = sanitizeHtml(req.body.texto || '', { allowedTags: [] }).trim();
    if (!nome  || nome.length  < 2)     return res.status(400).json({ error: 'Nome inválido.' });
    if (!texto || texto.length < 20)    return res.status(400).json({ error: 'Texto muito curto.' });
    if (nome.length  > 120)             return res.status(400).json({ error: 'Nome muito longo.' });
    if (texto.length > 10000)           return res.status(400).json({ error: 'Texto muito longo.' });

    const story = await Story.create({
      nome,
      texto,
      file:             req.file ? `/uploads/${req.file.filename}` : null,
      fileOriginalName: req.file ? req.file.originalname : null,
      fileMime:         req.file ? req.file.mimetype : null,
    });

    res.status(201).json({ ok: true, id: story._id });
  } catch { res.status(500).json({ error: 'Erro interno.' }); }
});

// Multer error handler
app.use((err,req,res,next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ error: 'Arquivo muito grande (máx 10 MB).' });
    return res.status(400).json({ error: err.message });
  }
  if (err) return res.status(400).json({ error: err.message });
  next();
});

app.listen(PORT, () => console.log(`🐦 Voo da Memória rodando em http://localhost:${PORT}`));
