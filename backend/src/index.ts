import express from 'express';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { authRouter } from './modules/auth/auth.routes.js';
import { studentRouter } from './modules/student/student.routes.js';
import { studyGroupRouter } from './modules/study-group/study-group.routes.js';
import { forumRouter } from './modules/forum/forum.routes.js';
import { libraryRouter } from './modules/library/library.routes.js';
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
  'http://192.168.147.255:8081',
  'https://uniconnect-dashboard-little-morning-9182.fly.dev',
  'https://uniconnect-dashboard-little-morning-9182.fly.dev/auth/callback',
  'com.ucaldas.estudiantes://oauthredirect',
  'https://uniconnect-dashboard-little-morning-9182.fly.dev/'
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
app.use('/forum', forumRouter);
app.use('/library', libraryRouter);

import { getProfileByIdHandler } from './modules/student/student.controller.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
app.get('/perfil/:id', requireAuth, getProfileByIdHandler);

import notificationRouter from './modules/notification/notification.route.js';
app.use('/notifications', notificationRouter);

import { chatRouter } from './modules/chat/chat.routes.js';
app.use('/chat', chatRouter);

import { assistantRouter } from './modules/assistant/assistant.routes.js';
app.use('/assistant', assistantRouter);

import { adminRouter } from './modules/admin/admin.routes.js';
app.use('/admin', adminRouter);

import { eventRouter } from './modules/event/event.routes.js';
app.use('/events', eventRouter);
app.use('/eventos', eventRouter);
import { studySessionRouter } from './modules/study-session/study-session.routes.js';
app.use('/study-sessions', studySessionRouter);
app.use('/sesiones-estudio', studySessionRouter);

// Global Error Handler
app.use(errorHandler);

async function bootstrap() {
  try {
    await prisma.$connect();
    isDatabaseConnected = true;
    console.log('Database connection: OK');
    const { startStudySessionScheduler } = await import('./modules/study-session/study-session.scheduler.js');
    const { startPollScheduler } = await import('./modules/chat/polls/poll.scheduler.js');
    startStudySessionScheduler();
    startPollScheduler();

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
