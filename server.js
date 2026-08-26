require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { put } = require('@vercel/blob');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5555;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const file = req.file;
    const id = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${id}${ext}`;

    const blob = await put(storedName, file.buffer, {
      access: 'public',
      contentType: file.mimetype,
      addRandomSuffix: false
    });

    const vanityUrl = `${BASE_URL}/file/${storedName}`;

    res.json({
      success: true,
      url: vanityUrl,
      blobUrl: blob.url,
      filename: storedName,
      size: file.size,
      mimetype: file.mimetype
    });

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'An error occurred during upload' });
  }
});

app.get('/file/:filename', async (req, res) => {
  try {
    const { head } = require('@vercel/blob');
    const blob = await head(req.params.filename);
    if (!blob) return res.status(404).send('Not found');

    const response = await fetch(blob.url);
    if (!response.ok) return res.status(502).send('Upstream error');

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200);
    response.body.pipe(res);
  } catch (err) {
    res.status(500).send('Error');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Svazer Upload running at ${BASE_URL}`));
