import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import sharp from 'sharp';
import express from 'express'
import { promisify } from 'util';
import libreoffice from 'libreoffice-convert';
import pdfToImage from 'pdf2image';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import pdftoppm from 'pdf-poppler';
import fileModel from '../models/File.js';
import { minioClient, bucketName } from '../config/minio.js';

const router = express.Router();
const libreConvert = promisify(libreoffice.convert);

// Set fontconfig path to prevent warnings
process.env.FONTCONFIG_PATH = '/etc/fonts';

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

router.get('/preview/:id', async (req, res) => {
  try {
    // 1. Get file metadata from database
    const file = await fileModel.findById(req.params.id);
    if (!file) {
      return sendErrorPreview(res, 'File not found', 404);
    }

    // 2. Get the correct filename from path (extract after bucket name)
    const objectKey = file.path.replace(`${bucketName}/`, '');

    // 3. Get file buffer from MinIO (properly convert stream to buffer)
    const fileBuffer = await streamToBuffer(
      await minioClient.getObject(bucketName, file.filename)
    );
    
    // 4. Generate appropriate preview based on file type
    if (SUPPORTED_PREVIEW_TYPES.IMAGE.includes(file.mimetype)) {
      return generateImagePreview(res, fileBuffer, file.mimetype);
    } else if (SUPPORTED_PREVIEW_TYPES.PDF.includes(file.mimetype)) {
      return generatePdfPreview(res, fileBuffer);
    } else if (SUPPORTED_PREVIEW_TYPES.OFFICE.includes(file.mimetype)) {
      return generateOfficePreview(res, fileBuffer, file.mimetype);
    } else if (SUPPORTED_PREVIEW_TYPES.TEXT.includes(file.mimetype)) {
      return generateTextPreview(res, fileBuffer);
    } else {
      return sendUnsupportedPreview(res, file.filename);
    }
  } catch (error) {
    console.error('Preview generation error:', error);
    return sendErrorPreview(res, 'Failed to generate preview');
  }
});

// Helper function to convert stream to buffer
function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Helper functions

async function generateImagePreview(res, buffer, mimeType) {
  try {
    // Validate buffer exists
    if (!buffer || buffer.length === 0) {
      throw new Error('Empty file buffer received');
    }

    // Create thumbnail for images
    const thumbnail = await sharp(buffer)
      .resize(800, 800, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .toBuffer();
    
    res.set('Content-Type', 'image/png');
    res.send(thumbnail);
  } catch (error) {
    console.error('Image preview error:', error);
    return sendErrorPreview(res, 'Failed to generate image preview');
  }
}

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

//     // Render PDF page to image
//     const pdfImage = await pdfDoc.embedPng(
//       await pdfDoc.saveAsBase64({ dataUri: true })
//     );

//     // Create PDF thumbnail
//     const thumbnail = await sharp({
//       create: {
//         width: Math.round(width * scale),
//         height: Math.round(height * scale),
//         channels: 4,
//         background: { r: 255, g: 255, b: 255, alpha: 1 }
//       }
//     })
//     .composite([{
//       input: await pdfImage.toBuffer(),
//       top: 0,
//       left: 0
//     }])
//     .png()
//     .toBuffer();

//     res.set('Content-Type', 'image/png');
//     res.send(thumbnail);
//   } catch (error) {
//     console.error('PDF preview error:', error);
//     return sendErrorPreview(res, 'Failed to generate PDF preview');
//   }
// }
async function generatePdfPreview(res, buffer) {
  let tempPdfPath = '';
  let tempImagePath = '';

  try {
    // 1. Create temp directory if it doesn't exist
    const tempDir = path.join(os.tmpdir(), 'pdf_previews');
    await fs.mkdir(tempDir, { recursive: true });

    // 2. Save PDF to temp file
    tempPdfPath = path.join(tempDir, `temp_${Date.now()}.pdf`);
    await fs.writeFile(tempPdfPath, buffer);

    // 3. Set output path for the image
    const outputPath = path.join(tempDir, `preview_${Date.now()}`);

    // 4. Convert PDF to image using pdftoppm
    const options = {
      format: 'png',
      out_dir: tempDir,
      out_prefix: path.basename(outputPath),
      page: 1 // Convert only first page
    };

    await pdftoppm.convert(tempPdfPath, options);

    // 5. Find the generated image (pdftoppm adds page number to filename)
    tempImagePath = `${outputPath}-1.png`;
    const imageBuffer = await fs.readFile(tempImagePath);

    // 6. Create thumbnail
    const thumbnail = await sharp(imageBuffer)
      .resize(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toBuffer();

    res.set('Content-Type', 'image/png');
    res.send(thumbnail);
  } catch (error) {
    console.error('PDF preview error:', error);
    return sendErrorPreview(res, 'Failed to generate PDF preview');
  } finally {
    // 7. Clean up temp files
    try {
      if (tempPdfPath) await fs.unlink(tempPdfPath);
      if (tempImagePath) await fs.unlink(tempImagePath);
    } catch (cleanupError) {
      console.error('Error cleaning up temp files:', cleanupError);
    }
  }
}

async function generateOfficePreview(res, buffer, mimeType) {
  try {
    // Convert office docs to PDF first
    const pdfBuffer = await libreConvert(buffer, '.pdf');
    return generatePdfPreview(res, pdfBuffer);
  } catch (error) {
    console.error('Office preview error:', error);
    return sendErrorPreview(res, 'Failed to generate office document preview');
  }
}

async function generateTextPreview(res, buffer) {
  try {
    const textContent = buffer.toString('utf-8').substring(0, 2000);
    const lineHeight = 24;
    const margin = 20;
    const fontSize = 16;
    const lines = textContent.split('\n');
    const height = Math.min(600, margin * 2 + lines.length * lineHeight);

    const svgText = lines.map((line, i) => 
      `<text x="${margin}" y="${margin + (i * lineHeight)}" 
            font-family="monospace" font-size="${fontSize}">
        ${escapeHtml(line)}
      </text>`
    ).join('');

    const preview = await sharp({
      create: {
        width: 800,
        height: height,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    })
    .composite([{
      input: Buffer.from(`
        <svg width="800" height="${height}">
          <rect width="100%" height="100%" fill="white"/>
          ${svgText}
        </svg>
      `),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();

    res.set('Content-Type', 'image/png');
    res.send(preview);
  } catch (error) {
    console.error('Text preview error:', error);
    return sendErrorPreview(res, 'Failed to generate text preview');
  }
}

// Utility functions

function escapeHtml(text) {
  return text.replace(/[<>&]/g, c => 
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

function sendUnsupportedPreview(res, filename) {
  const extension = filename.split('.').pop().toUpperCase();
  return generateErrorImage(res, 
    `No preview available for ${extension} files`,
    'rgba(240, 240, 240, 1)',
    'gray'
  );
}

function sendErrorPreview(res, message, statusCode = 500) {
  return generateErrorImage(res, 
    message,
    'rgba(255, 200, 200, 1)',
    'red',
    statusCode
  );
}

async function generateErrorImage(res, message, bgColor, textColor, statusCode = 500) {
  try {
    const errorImage = await sharp({
      create: {
        width: 600,
        height: 300,
        channels: 4,
        background: bgColor
      }
    })
    .composite([{
      input: Buffer.from(`
        <svg width="600" height="300">
          <text x="50%" y="50%" 
                font-family="Arial" font-size="16" 
                fill="${textColor}" 
                text-anchor="middle" 
                dominant-baseline="middle">
            ${escapeHtml(message)}
          </text>
        </svg>
      `),
      top: 0,
      left: 0
    }])
    .png()
    .toBuffer();

    res.status(statusCode).set('Content-Type', 'image/png');
    res.send(errorImage);
  } catch (error) {
    console.error('Failed to generate error image:', error);
    res.status(500).json({ error: message });
  }
}

export default router;