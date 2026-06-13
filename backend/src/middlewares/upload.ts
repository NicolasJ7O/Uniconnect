import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { AppError } from '../errors/app-error.js';

const uploadDir = path.join(process.cwd(), 'uploads/groups');

// Ensure directory exists
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const COMMON_DOCUMENT_MIME_TYPES = new Set([
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/markdown',
    'application/rtf',
]);

const COMMON_DOCUMENT_EXTENSIONS = new Set([
    '.pdf',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
    '.ppt',
    '.pptx',
    '.txt',
    '.md',
    '.rtf',
]);

function isAllowedResourceFile(file: Express.Multer.File): boolean {
    const ext = path.extname(file.originalname).toLowerCase();
    return (
        file.mimetype === 'application/pdf' ||
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('video/') ||
        COMMON_DOCUMENT_MIME_TYPES.has(file.mimetype) ||
        COMMON_DOCUMENT_EXTENSIONS.has(ext) ||
        (file.mimetype === 'application/octet-stream' && COMMON_DOCUMENT_EXTENSIONS.has(ext))
    );
}

export const uploadPDF = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
            return;
        }

        cb(new AppError(400, 'Solo se permiten archivos PDF'));
    },
});

export const uploadResourceFile = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (isAllowedResourceFile(file)) {
            cb(null, true);
            return;
        }

        cb(new AppError(400, 'Solo se permiten archivos PDF, documentos, imágenes o videos'));
    },
});
