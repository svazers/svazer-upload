const { put, head, presignUrl, issueSignedToken } = require('@vercel/blob');
const crypto = require('crypto');
const path = require('path');
const { Readable } = require('stream');
const Busboy = require('busboy');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Content-Length');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (req.method === 'POST' && pathname === '/api/request-upload') {
    return handleRequestUpload(req, res);
  }

  if (req.method === 'POST' && pathname === '/api/upload') {
    return handleUpload(req, res);
  }

  if (req.method === 'GET' && pathname.startsWith('/file/')) {
    return handleServe(req, res, pathname);
  }

  res.status(404).json({ error: 'Not found' });
};

async function handleRequestUpload(req, res) {
  try {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      const { fileName, fileType: rawType } = body;
      if (!fileName) return res.status(400).json({ error: 'fileName required' });
      const fileType = rawType || 'application/octet-stream';

      const id = crypto.randomBytes(4).toString('hex');
      const ext = path.extname(fileName).toLowerCase();
      const storedName = `${id}${ext}`;

      const token = await issueSignedToken({
        operations: ['put'],
        pathname: storedName,
        maximumSizeInBytes: 25 * 1024 * 1024,
        allowedContentTypes: [fileType],
        validUntil: Date.now() + 3600000
      });

      const { presignedUrl } = await presignUrl(token, {
        operation: 'put',
        pathname: storedName
      });

      res.status(200).json({
        success: true,
        uploadUrl: presignedUrl,
        filename: storedName
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred' });
  }
}

async function handleUpload(req, res) {
  try {
    const { fileBuffer, filename, mimetype } = await parseFile(req);
    if (!fileBuffer) return res.status(400).json({ error: 'No file uploaded' });

    const id = crypto.randomBytes(4).toString('hex');
    const ext = path.extname(filename).toLowerCase();
    const storedName = `${id}${ext}`;

    const blob = await put(storedName, fileBuffer, {
      access: 'public',
      contentType: mimetype,
      addRandomSuffix: false
    });

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const vanityUrl = `${protocol}://${host}/file/${storedName}`;

      res.status(200).json({
        success: true,
        url: vanityUrl,
        blobUrl: blob.url,
        filename: storedName,
        size: fileBuffer.length,
        mimetype
      });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'An error occurred during upload' });
  }
}

async function handleServe(req, res, pathname) {
  try {
    const filename = pathname.replace('/file/', '');
    if (!filename) return res.status(404).send('Not found');

    const blob = await head(filename);
    if (!blob) return res.status(404).send('Not found');

    const response = await fetch(blob.url);
    if (!response.ok) return res.status(502).send('Upstream error');

    const buffer = Buffer.from(await response.arrayBuffer());

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
    res.statusCode = 200;
    res.end(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error');
  }
}

function parseFile(req) {
  return new Promise((resolve, reject) => {
    let fileBuffer = null;
    let filename = '';
    let mimetype = '';
    let found = false;

    const busboy = Busboy({ headers: req.headers, limits: { fileSize: 25 * 1024 * 1024 } });

    busboy.on('file', (fieldname, file, info) => {
      if (found) return;
      found = true;
      filename = info.filename;
      mimetype = info.mimeType || 'application/octet-stream';
      const chunks = [];
      file.on('data', chunk => chunks.push(chunk));
      file.on('limit', () => reject(new Error('File too large')));
      file.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    busboy.on('finish', () => resolve({ fileBuffer, filename, mimetype }));
    busboy.on('error', reject);

    req.pipe(busboy);
  });
}
