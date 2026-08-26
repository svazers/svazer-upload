import { readFileSync } from 'fs';
import path from 'path';

const BASE = 'https://cdn-svazer.vercel.app';

const mimeTypes = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav', '.pdf': 'application/pdf', '.txt': 'text/plain',
  '.html': 'text/html', '.json': 'application/json', '.js': 'application/javascript',
  '.css': 'text/css',
  '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.apk': 'application/vnd.android.package-archive', '.zip': 'application/zip'
};

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node example-upload.mjs <file>');
  process.exit(1);
}

const file = readFileSync(filePath);
const fileName = path.basename(filePath);
const ext = path.extname(filePath).toLowerCase();
const mime = mimeTypes[ext] || 'application/octet-stream';

// Step 1: request presigned upload URL
const reqRes = await fetch(`${BASE}/api/request-upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileName, fileType: mime })
});
const reqData = await reqRes.json();
if (!reqRes.ok) throw new Error(reqData.error);

// Step 2: upload file directly to Blob via presigned URL
const upRes = await fetch(reqData.uploadUrl, {
  method: 'PUT',
  headers: { 'Content-Type': mime },
  body: file
});
if (!upRes.ok) throw new Error('Upload to storage failed');

const url = `${BASE}/file/${reqData.filename}`;

console.log('Sukses!');
console.log('URL     :', url);
console.log('Size    :', (file.length / 1024).toFixed(1), 'KB');
