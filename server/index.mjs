import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { executeRuletaPremio } from '../lib/ruleta-premio-service.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(express.json({ limit: '48kb' }));

const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
if (corsOrigins.length) {
  app.use(cors({ origin: corsOrigins }));
} else {
  app.use(cors({ origin: true }));
}

app.post('/api/ruleta-premio', async (req, res) => {
  try {
    const result = await executeRuletaPremio(req.body || {});
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    console.error('[ruleta-premio]', e);
    return res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
});

app.use(
  express.static(ROOT, {
    extensions: ['html'],
    index: ['vinyaroots.html', 'index.html']
  })
);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`VinyaRoots — http://localhost:${PORT} (estático + /api/ruleta-premio)`);
  console.log('Cupones: Vercel KV si hay KV_*; si no, archivo server/data/cupones-emitidos.json');
});
