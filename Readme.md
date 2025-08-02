# Document Management Service (DMS‑Backend)

**File‑based data management backend with versioning, previews, and REST API built with Node.js, Express, MongoDB & MinIO.**

---

## Table of Contents
1. [Overview](#overview)  
2. [System Architecture](#system-architecture)  
3. [Prerequisites](#prerequisites)  
4. [Setup Instructions](#setup-instructions)  
   - [Clone & Install](#clone--install)  
   - [MinIO Docker Setup](#minio-docker-setup)  
   - [Environment Configuration](#environment-configuration)  
   - [Run Backend](#run-backend)  
5. [API Reference](#api-reference)  
   1. [Upload File](#1-post-apifilesupload)  
   2. [List All Files](#2-get-apifiles)  
   3. [Download File by ID](#3-get-apifilesid)  
   4. [List Version History](#4-get-apifilesversionsfilename)  
   5. [Delete File by ID](#5-delete-apifilesid)  
   6. [Preview File](#6-get-apifilepreviewid)  
6. [File Versioning](#file-versioning)  
7. [Supported File Types & Preview Rules](#supported-file-types--preview-rules)  
8. [Error Handling](#error-handling)  
9. [Further Reading & Best Practices](#further-reading--best-practices)  

---

## Overview
The DMS‑Backend is a RESTful service allowing:
- Uploading files of various types (PDFs, Office docs, images, text),
- Automatic versioning and MIME validation,
- File listing with version history,
- Downloading and preview generation via secure ID lookups,
- Deletion of the current (latest) file version.

---

## System Architecture
- **Frontend**: React.js (out of scope here)  
- **Backend**: Node.js + Express  
- **Metadata Storage**: MongoDB  
- **File Storage**: MinIO S3‑compatible object store  

---

## Prerequisites
- Node.js (≥14.x) & npm  
- MongoDB instance (local or cloud)  
- MinIO server (local or remote)  

---

## Setup Instructions

### Clone & Install
```bash
git clone <your‑repo‑url> dms-backend
cd dms-backend
npm install

```

## MinIO Docker Setup

```bash
docker pull minio/minio
 
docker images
 
docker run `
   -p 9000:9000 `
   -p 9001:9001 `
   --name minio `
   -v ~/minio/data:/data `
   -e "MINIO_ROOT_USER=ROOTNAME" `
   -e "MINIO_ROOT_PASSWORD=CHANGEME123" `
   quay.io/minio/minio server /data --console-address ":9001"

```

Then open your browser:

MinIO console: http://127.0.0.1:9001/

Storage endpoint: http://127.0.0.1:9000/

Use ROOTNAME / CHANGEME123 to log in.

Environment Configuration
Create a .env file in project root with:

```bash
.env

PORT=8000
MONGO_URI=mongodb://localhost:27017/document-management
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=ROOTNAME
MINIO_SECRET_KEY=CHANGEME123
MINIO_BUCKET=documents
Run Backend

npm run backend
HTTP server should be live at http://localhost:8000.

```
---

## API Reference
Base URL: http://localhost:8000/api

1. POST /files/upload
Upload a file. Supports auto-versioning, MIME detection, and spoof protection.

Headers: Content-Type: multipart/form-data

Body: file field (required)

Success (201):

```bash
json

{
  "_id": "...",
  "filename": "example_v2.pdf",
  "originalName": "example.pdf",
  "version": 2,
  "size": 12345,
  "mimetype": "application/pdf",
  "path": "documents/example_v2.pdf",
  "isCurrent": true,
  "fileExtension": ".pdf",
  "detectedType": "application/pdf",
  "createdAt": "...",
  "updatedAt": "...",
  "uploadStatus": "success",
  "versionInfo": { "current": 2, "total": 2 }
}
Errors:

400 No file uploaded

400 Unrecognized file type

413 File size exceeds limit

500 Upload failed

```

2. GET /files/
List all file versions (newest first).

Response:
```bash
json

[
  { "_id":"...", "filename":"report_v2.pdf", ..., "isCurrent": true },
  { "_id":"...", "filename":"report_v1.pdf", ..., "isCurrent": false }
]
```

3. GET /files/:id
Download a file by MongoDB _id.

Response: Attachment with original filename & MIME

Errors:

404 File not found

500 Read/stream error

4. GET /files/versions/:filename
Get all versions of logical/original filename (e.g. report.pdf).

Response:

```bash
json

{
  "originalName": "report.pdf",
  "totalVersions": 2,
  "versions": [
    { "filename":"report_v2.pdf", "version":2, "isCurrent": true, ... },
    { "filename":"report_v1.pdf", "version":1, "isCurrent": false, ... }
  ]
}
Error: 404 if no versions exist

```

5. DELETE /files/:id
Deletes the current (latest) version by MongoDB _id. Also removes from MinIO.

Response:

```bash
json

{ "message": "File deleted successfully" }
Error:

404 File not found

500 Deletion failed
```

6. GET /file/preview/:id
Gets a preview (PNG) for supported types:

    - Images → thumbnail (800×800px)

    - PDFs → first page

    - Office docs → converted to PDF then rendered

    - Text or CSV → snippet rendered as image

If unsupported or error:

    - Returns PNG with message like "No preview available"

---

## File Versioning
- Files are versioned per original name, e.g.:

    - invoice.pdf → invoice_v1.pdf, invoice_v2.pdf, ...

- MongoDB stores:

    - version (number), isCurrent (boolean)

- Only the most recent upload per logical name has isCurrent: true

- API /versions/:filename shows sorted history

---

### Supported File Types & Preview Rules

|---------------------|----------------------------------------------------------------------|------------------------------------------------------|
| Category            | Example MIME Types                                                   | Preview Behavior                                     |
|---------------------|----------------------------------------------------------------------|------------------------------------------------------|
| Images              | `image/jpeg`, `image/png`, `image/gif`, `image/webp`                 | Generates an 800 × 800px thumbnail                   |
| PDF                 | `application/pdf`                                                    | Renders the **first page** as a PNG image            |
| Office Documents    | Microsoft Word / Excel / PowerPoint formats (both legacy and modern) | Converted to PDF, then rendered as a preview image   |
| Text / CSV / JSON   | `text/plain`, `text/csv`, `application/json`                         | Renders a snippet of the text content as an image    |
| Others              | Unrecognized or unsupported types                                    | Returns a fallback PNG with an “Unsupported” message |
|---------------------|----------------------------------------------------------------------|------------------------------------------------------|
---
## Error Handling
Across endpoints:

- 400 – Bad request or no file

- 404 – Resource not found

- 413 – Payload too large

- 500 – Internal server / processing error or storage failure

Error details returned as JSON (for API) or embedded in PNG image (for preview endpoint).