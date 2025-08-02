import express from 'express'
import multer from 'multer';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type'

import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import { promisify } from 'util';
import libreoffice from 'libreoffice-convert';

import { minioClient, bucketName } from '../config/minio.js'
import fileModel from '../models/File.js'

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload file
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // 1. Validate file exists
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.file;
    
    // 2. Additional file validation
    const fileType = await fileTypeFromBuffer(file.buffer);
    if (!fileType) {
      return res.status(400).json({ error: 'Unrecognized file type' });
    }

    // 3. Ensure consistent file extension handling
    const originalExt = path.extname(file.originalname).toLowerCase();
    const detectedExt = `.${fileType.ext}`;
    
    // Use detected extension if mismatch found (e.g., fake .jpg extension)
    const finalExtension = originalExt === detectedExt ? originalExt : detectedExt;
    const baseName = path.parse(file.originalname).name;
    const finalFilename = `${baseName}${finalExtension}`;

    // 4. Versioning logic
    const existingFiles = await fileModel.find({ originalName: finalFilename });
    const newVersion = existingFiles.length + 1;
    const versionedFilename = `${baseName}_v${newVersion}${finalExtension}`;
    const objectName = `${Date.now()}-${versionedFilename}`;

    // 5. Upload to MinIO with proper content type
    await minioClient.putObject(
      bucketName,
      versionedFilename,
      file.buffer,
      file.size,
      {
        'Content-Type': fileType.mime // Use detected MIME type
      }
    );

    // 6. Update previous versions
    if (existingFiles.length > 0) {
      await fileModel.updateMany(
        { originalName: finalFilename },
        { isCurrent: false }
      );
    }

    // 7. Save metadata with accurate type information
    const newFile = new fileModel({
      filename: versionedFilename,
      originalName: finalFilename,
      version: newVersion,
      size: file.size,
      mimetype: fileType.mime, // Use detected MIME type
      path: `${bucketName}/${versionedFilename}`,
      isCurrent: true,
      // Additional useful metadata
      fileExtension: finalExtension,
      detectedType: fileType.mime
    });

    await newFile.save();

    // 8. Return response with all relevant info
    res.status(201).json({
      ...newFile.toObject(),
      uploadStatus: 'success',
      versionInfo: {
        current: newVersion,
        total: existingFiles.length + 1
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    
    // More specific error handling
    if (error.code === 'FileTooLarge') {
      return res.status(413).json({ error: 'File size exceeds limit' });
    }
    
    res.status(500).json({ 
      error: 'Upload failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all files
router.get('/', async (req, res) => {
  try {
    const files = await fileModel.find().sort({ createdAt: -1 });
    res.json(files);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch files' });
  }
});

// Get file by ID (Failed)
router.get('/:id', async (req, res) => {
  try {
    // 1. First get the file metadata from MongoDB
    const file = await fileModel.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found in database' });
    }

    // 2. Determine the object key for MinIO
    let objectKey = file.filename;
    if (file.path && file.path.startsWith(bucketName + '/')) {
      objectKey = file.path.substring(bucketName.length + 1);
    }

    console.log(`Fetching object ${objectKey} from bucket ${bucketName}`);

    // 3. Get the file stream from MinIO
    const dataStream = await minioClient.getObject(bucketName, objectKey);

    // 4. Handle stream errors
    dataStream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'File stream error',
          details: err.message
        });
      }
    });

    // 5. Set headers and pipe the stream to response
    res.setHeader('Content-Type', file.mimetype);
    res.setHeader('Content-Disposition', `attachment; filename="${file.originalName}"`);
    dataStream.pipe(res);

  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({
      error: 'Failed to fetch file',
      details: error.message
    });
  }
});

const libreConvert = promisify(libreoffice.convert);

// Supported MIME types for preview generation
const SUPPORTED_PREVIEW_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  PDF: ['application/pdf'],
  OFFICE: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  TEXT: ['text/plain', 'text/csv', 'application/json']
};


// router.get('/preview/:id', async (req, res) => {
//   try {
//     // 1. Get file metadata from database
//     const file = await fileModel.findById(req.params.id);
//     if (!file) {
//       return sendErrorPreview(res, 'File not found', 404);
//     }

//     // 2. Get file buffer from MinIO (updated implementation)
//     const fileBuffer = await minioClient.getObject(bucketName, file.filename);
    
//     // 3. Generate appropriate preview based on file type
//     if (SUPPORTED_PREVIEW_TYPES.IMAGE.includes(file.mimetype)) {
//       return generateImagePreview(res, fileBuffer, file.mimetype);
//     } else if (SUPPORTED_PREVIEW_TYPES.PDF.includes(file.mimetype)) {
//       return generatePdfPreview(res, fileBuffer);
//     } else if (SUPPORTED_PREVIEW_TYPES.OFFICE.includes(file.mimetype)) {
//       return generateOfficePreview(res, fileBuffer, file.mimetype);
//     } else if (SUPPORTED_PREVIEW_TYPES.TEXT.includes(file.mimetype)) {
//       return generateTextPreview(res, fileBuffer);
//     } else {
//       return sendUnsupportedPreview(res, file.filename);
//     }
//   } catch (error) {
//     console.error('Preview generation error:', error);
//     return sendErrorPreview(res, 'Failed to generate preview');
//   }
// });

// // Helper functions (updated)

// async function generateImagePreview(res, buffer, mimeType) {
//   try {
//     // Create thumbnail for images
//     const thumbnail = await sharp(buffer)
//       .resize(800, 800, { 
//         fit: 'inside', 
//         withoutEnlargement: true 
//       })
//       .toBuffer();
    
//     res.set('Content-Type', 'image/png');
//     res.send(thumbnail);
//   } catch (error) {
//     console.error('Image preview error:', error);
//     return sendErrorPreview(res, 'Failed to generate image preview');
//   }
// }

// async function generatePdfPreview(res, buffer) {
//   try {
//     // Load PDF and get first page dimensions
//     const pdfDoc = await PDFDocument.load(buffer);
//     pdfDoc.registerFontkit(fontkit);
//     const pages = pdfDoc.getPages();
//     if (pages.length === 0) {
//       return sendUnsupportedPreview(res, 'PDF');
//     }

//     const { width, height } = pages[0].getSize();
//     const scale = Math.min(800 / width, 600 / height) * 0.8;

//     // Create PDF thumbnail
//     const thumbnail = await sharp({
//       create: {
//         width: Math.round(width * scale),
//         height: Math.round(height * scale),
//         channels: 4,
//         background: { r: 255, g: 255, b: 255, alpha: 1 }
//       }
//     })
//     .png()
//     .composite([{
//       input: await pdfDoc.saveAsBase64({ dataUri: true }),
//       blend: 'over',
//       top: 0,
//       left: 0
//     }])
//     .toBuffer();

//     res.set('Content-Type', 'image/png');
//     res.send(thumbnail);
//   } catch (error) {
//     console.error('PDF preview error:', error);
//     return sendErrorPreview(res, 'Failed to generate PDF preview');
//   }
// }

// async function generateOfficePreview(res, buffer, mimeType) {
//   try {
//     // Convert office docs to PDF first
//     const pdfBuffer = await libreConvert(buffer, '.pdf');
//     return generatePdfPreview(res, pdfBuffer);
//   } catch (error) {
//     console.error('Office preview error:', error);
//     return sendErrorPreview(res, 'Failed to generate office document preview');
//   }
// }

// async function generateTextPreview(res, buffer) {
//   try {
//     const textContent = buffer.toString('utf-8').substring(0, 2000);
//     const lineHeight = 24;
//     const margin = 20;
//     const fontSize = 16;
//     const lines = textContent.split('\n');
//     const height = Math.min(600, margin * 2 + lines.length * lineHeight);

//     const svgText = lines.map((line, i) => 
//       `<text x="${margin}" y="${margin + (i * lineHeight)}" 
//             font-family="monospace" font-size="${fontSize}">
//         ${escapeHtml(line)}
//       </text>`
//     ).join('');

//     const preview = await sharp({
//       create: {
//         width: 800,
//         height: height,
//         channels: 4,
//         background: { r: 255, g: 255, b: 255, alpha: 1 }
//       }
//     })
//     .composite([{
//       input: Buffer.from(`
//         <svg width="800" height="${height}">
//           <rect width="100%" height="100%" fill="white"/>
//           ${svgText}
//         </svg>
//       `),
//       top: 0,
//       left: 0
//     }])
//     .png()
//     .toBuffer();

//     res.set('Content-Type', 'image/png');
//     res.send(preview);
//   } catch (error) {
//     console.error('Text preview error:', error);
//     return sendErrorPreview(res, 'Failed to generate text preview');
//   }
// }

// // Utility functions

// function escapeHtml(text) {
//   return text.replace(/[<>&]/g, c => 
//     ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
// }

// function sendUnsupportedPreview(res, filename) {
//   const extension = filename.split('.').pop().toUpperCase();
//   return generateErrorImage(res, 
//     `No preview available for ${extension} files`,
//     'rgba(240, 240, 240, 1)',
//     'gray'
//   );
// }

// function sendErrorPreview(res, message, statusCode = 500) {
//   return generateErrorImage(res, 
//     message,
//     'rgba(255, 200, 200, 1)',
//     'red',
//     statusCode
//   );
// }

// async function generateErrorImage(res, message, bgColor, textColor, statusCode = 500) {
//   try {
//     const errorImage = await sharp({
//       create: {
//         width: 600,
//         height: 300,
//         channels: 4,
//         background: bgColor
//       }
//     })
//     .composite([{
//       input: Buffer.from(`
//         <svg width="600" height="300">
//           <text x="50%" y="50%" 
//                 font-family="Arial" font-size="16" 
//                 fill="${textColor}" 
//                 text-anchor="middle" 
//                 dominant-baseline="middle">
//             ${escapeHtml(message)}
//           </text>
//         </svg>
//       `),
//       top: 0,
//       left: 0
//     }])
//     .png()
//     .toBuffer();

//     res.status(statusCode).set('Content-Type', 'image/png');
//     res.send(errorImage);
//   } catch (error) {
//     console.error('Failed to generate error image:', error);
//     res.status(500).json({ error: message });
//   }
// }

// routes/files.js
router.get('/versions/:filename', async (req, res) => {
  try {
    // Extract base filename without extension (e.g., "report" from "report.pdf")
    const originalName = req.params.filename;
    
    // Find all versions of this file
    const versions = await fileModel.find({ originalName })
      .sort({ version: -1 }) // Newest first
      .select('filename version size createdAt uploadedBy isCurrent'); // Optimized response

    if (versions.length === 0) {
      return res.status(404).json({ error: 'No versions found for this file' });
    }

    res.json({
      originalName,
      totalVersions: versions.length,
      versions
    });

  } catch (error) {
    console.error('Version fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve file versions' });
  }
});

// Delete file
router.delete('/:id', async (req, res) => {
  try {
    const file = await fileModel.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete from MinIO
    await minioClient.removeObject(bucketName, file.filename);

    // Delete from MongoDB
    await fileModel.findByIdAndDelete(req.params.id);

    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

export default router;