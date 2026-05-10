import express from 'express';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './modules/auth/auth.routes.js';
import { studentRouter } from './modules/student/student.routes.js';
import { studyGroupRouter } from './modules/study-group/study-group.routes.js';
import { env } from './config/env.js';
import { checkDbConnection, prisma } from './lib/prisma.js';
import { AppError } from './errors/app-error.js';
import { errorHandler } from './middlewares/error-handler.js';
import { createServer } from 'http';
import { initSocket } from './lib/socket.js';

const app = express();
const httpServer = createServer(app);
const io = initSocket(httpServer);
const port = env.PORT;

const allowedOrigins = new Set([
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
]);

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Permite requests sin origin (curl, health checks, server-to-server)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new AppError(403, `CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // importante para preflight

app.use(helmet({ crossOriginResourcePolicy: false })); // Allow serving static files correctly
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Servir archivos estáticos de la carpeta uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

let isDatabaseConnected = false;

app.get('/health', (_req, res) => {
  res.json({
    status: isDatabaseConnected ? 'ok' : 'degraded',
    version: '1.0.0',
    service: 'uniconnect-backend',
    database: isDatabaseConnected ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health/db', async (_req, res) => {
  const connected = await checkDbConnection();
  isDatabaseConnected = connected;

  return res.status(connected ? 200 : 503).json({
    database: connected ? 'up' : 'down',
    timestamp: new Date().toISOString(),
  });
});

app.use('/auth', authRouter);
app.use('/student', studentRouter);
app.use('/groups', studyGroupRouter);

import { chatRouter } from './modules/chat/chat.routes.js';
app.use('/chat', chatRouter);

// Global Error Handler
app.use(errorHandler);

async function bootstrap() {
  try {
    await prisma.$connect();
    isDatabaseConnected = true;
    console.log('Database connection: OK');

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`API running on http://0.0.0.0:${port}`);
      console.log(`API accessible on local network at http://<this-machine-ip>:${port}`);
    });
  } catch (error) {
    isDatabaseConnected = false;
    console.error('Database connection: FAILED');
    console.error(error);
    process.exit(1);
  }
}

bootstrap();