require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');

const recsRouter     = require('./routes/recs');
const listingsRouter = require('./routes/listings');
const iotRouter      = require('./routes/iot');
const auditRouter    = require('./routes/audit');

const app  = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  // Vercel preview URLs follow pattern: *.vercel.app
  /^https:\/\/.*\.vercel\.app$/,
  // Set FRONTEND_URL in .env for custom domain
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
];
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: Date.now() }));
app.use('/api/recs',      recsRouter);
app.use('/api/listings',  listingsRouter);
app.use('/api/iot',       iotRouter);
app.use('/api/audit',    auditRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => console.log(`RecDapp API running on http://localhost:${PORT}`));
