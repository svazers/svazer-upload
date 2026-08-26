# Svazer Upload

Layanan upload file menggunakan Vercel Blob. File diunggah **sekali** langsung ke Blob lewat presigned URL, lalu disajikan lewat URL proxy `https://svazer-upload.vercel.app/file/:filename`.

## Stack

- **Runtime**: Vercel Serverless (Node.js) + server lokal (`server.js`)
- **Storage**: Vercel Blob
- **UI**: Static HTML + vanilla JS
- **Upload**: presigned `PUT` (single upload, tanpa step finalize ganda)

## Deploy ke Vercel

### 1. Buat Vercel Blob Store

1. Buka [Vercel Dashboard → Storage](https://vercel.com/dashboard/stores)
2. Klik **Create Database** → pilih **Blob**
3. Beri nama (mis. `svazer-upload`), pilih region terdekat
4. Salin `BLOB_READ_WRITE_TOKEN` dan `BLOB_STORE_ID`

### 2. Set Environment Variables

Di [Vercel Dashboard → Project → Settings → Environment Variables](https://vercel.com/dashboard):

| Name | Value | Environment |
|------|-------|-------------|
| `PEPEK_READ_WRITE_TOKEN` | `vercel_blob_rw_xxxx` | Production |
| `PEPEK_STORE_ID` | `store_xxxx` | Production |

> Kode otomatis menormalisasi `PEPEK_*` ke `BLOB_*` (yang dibaca SDK `@vercel/blob`), jadi nama env var di Vercel boleh `PEPEK_*` maupun `BLOB_*`.

### 3. Deploy

```bash
npm install
npx vercel --prod
```

## Development Lokal

```bash
npm install
# isi .env:
#   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxxx
#   BLOB_STORE_ID=store_xxxx
npm start          # jalan di http://localhost:5555
```

Server lokal (`server.js`) menyediakan `POST /api/upload` (multipart) dan `GET /file/:filename` (proxy).

## API

### POST /api/request-upload
Minta presigned upload URL. Body JSON: `{ "fileName": "foto.jpg", "fileType": "image/jpeg" }`.
Jika `fileType` kosong, dianggap `application/octet-stream` (cocok untuk `.apk` dan binary lain).

Respons:
```json
{
  "success": true,
  "uploadUrl": "https://vercel.com/api/blob/?pathname=...",
  "filename": "a1b2c3d4.jpg"
}
```

### PUT {uploadUrl}
Unggah file langsung ke Blob (**single upload**). Header `Content-Type` = `fileType`.
Setelah sukses, file tersedia di `https://svazer-upload.vercel.app/file/<filename>`.

### GET /file/:filename
Sajikan file lewat domain proyek (proxy dari Blob). Ini URL shareable yang dipakai frontend.

### POST /api/upload (alternatif, multipart)
Upload via form multipart (field `file`). Cocok untuk skrip/server-side.
Respons:
```json
{
  "success": true,
  "url": "https://svazer-upload.vercel.app/file/a1b2c3d4.jpg",
  "blobUrl": "https://xxxx.public.blob.vercel-storage.com/a1b2c3d4.jpg",
  "filename": "a1b2c3d4.jpg",
  "size": 123456,
  "mimetype": "image/jpeg"
}
```

## Contoh (Node)

```js
const BASE = 'https://svazer-upload.vercel.app';
const req = await fetch(`${BASE}/api/request-upload`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ fileName: 'foto.jpg', fileType: 'image/jpeg' })
});
const { uploadUrl, filename } = await req.json();
await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: fileBuffer });
console.log(`URL: ${BASE}/file/${filename}`);
```

Lihat `example-upload.mjs` untuk contoh lengkap (termasuk `.apk`/`.zip`).

## Contoh curl

### Flow presigned (single upload)

```bash
# 1. Minta presigned URL
RESP=$(curl -s -X POST https://svazer-upload.vercel.app/api/request-upload \
  -H "Content-Type: application/json" \
  -d '{"fileName":"foto.jpg","fileType":"image/jpeg"}')
UPLOAD_URL=$(echo "$RESP" | jq -r .uploadUrl)
FILENAME=$(echo "$RESP" | jq -r .filename)

# 2. Upload langsung ke Blob (single PUT)
curl -X PUT "$UPLOAD_URL" -H "Content-Type: image/jpeg" --data-binary @foto.jpg

# 3. URL shareable (proxy)
echo "https://svazer-upload.vercel.app/file/$FILENAME"
```

### Alternatif: multipart (satu perintah)

```bash
curl -X POST https://svazer-upload.vercel.app/api/upload -F "file=@foto.jpg"
```

## Batasan

| Batasan | Nilai |
|---------|-------|
| Ukuran file maks | 25 MB |
| Ekstensi | semua didukung (tidak ada whitelist MIME) |
| Storage Vercel gratis | 10 GB |
| Bandwidth Vercel gratis | 100 GB/bulan |

## Struktur

```
svazer-upload/
├── api/
│   └── index.js          Serverless function Vercel (request-upload, file proxy)
├── public/
│   ├── index.html        Frontend
│   └── favicon.png
├── server.js             Server dev lokal
├── vercel.json           Konfigurasi Vercel (rewrites, maxDuration 30s)
├── example-upload.mjs    Contoh upload via API
├── package.json
├── .env.example
└── README.md
```
