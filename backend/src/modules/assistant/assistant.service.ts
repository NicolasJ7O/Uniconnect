import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '../../errors/app-error.js';
import { prisma } from '../../lib/prisma.js';
import { assistantKnowledgeBase, type AssistantKnowledgeChunk, type AssistantRole } from './assistant.content.js';

type AssistantDatabase = PrismaClient | Prisma.TransactionClient;

const assistantSessionInclude = {
  messages: {
    orderBy: {
      createdAt: 'asc' as const,
    },
  },
} as const;

type AssistantSessionRecord = Prisma.AssistantSessionGetPayload<{
  include: typeof assistantSessionInclude;
}>;

type AssistantMessageRecord = Prisma.AssistantMessageGetPayload<{}>;

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'qwen2.5-coder:3b';
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS || 12000);
const MAX_CONTEXT_MESSAGES = 8;

const ROLE_ALIASES: Record<string, AssistantRole> = {
  student: 'student',
  moderator: 'moderator',
  admin: 'super_admin',
  super_admin: 'super_admin',
};

const ROLE_LABELS: Record<AssistantRole, string> = {
  student: 'estudiante',
  moderator: 'moderador',
  super_admin: 'super_admin',
};

const DOMAIN_KEYWORDS = [
  'uniconnect',
  'dashboard',
  'perfil',
  'grupo',
  'grupos',
  'foro',
  'biblioteca',
  'evento',
  'eventos',
  'sesion',
  'sesiones',
  'chat',
  'mensajes',
  'rol',
  'admin',
  'moderador',
  'estudiante',
  'auth',
  'auth0',
  'google',
  'prisma',
];

function normalizeRole(role: string | undefined): AssistantRole {
  return ROLE_ALIASES[role || 'student'] ?? 'student';
}

function roleLabel(role: AssistantRole) {
  return ROLE_LABELS[role];
}

function stripAccents(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function tokenize(value: string) {
  return stripAccents(value.toLowerCase())
    .replace(/[^a-z0-9áéíóúüñ\s_-]/gi, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2);
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function sanitizeSessionKey(sessionKey: string) {
  const normalized = sessionKey.trim();
  if (!normalized) {
    throw new AppError(400, 'La sesión del chatbot es obligatoria');
  }
  return normalized;
}

function selectKnowledgeChunks(query: string, role: AssistantRole) {
  const queryTokens = tokenize(query);
  const queryText = stripAccents(query.toLowerCase());

  const scored = assistantKnowledgeBase
    .filter((chunk) => chunk.audience.includes(role))
    .map((chunk) => {
      const chunkText = stripAccents([chunk.title, chunk.summary, chunk.content, ...chunk.keywords].join(' ').toLowerCase());
      let score = 0;

      for (const token of queryTokens) {
        if (chunk.keywords.some((keyword) => stripAccents(keyword.toLowerCase()).includes(token))) {
          score += 4;
        }

        if (chunk.title.toLowerCase().includes(token)) {
          score += 3;
        }

        if (chunkText.includes(token)) {
          score += 1;
        }
      }

      if (queryText.includes(stripAccents(chunk.title.toLowerCase()))) {
        score += 6;
      }

      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score);

  return scored.slice(0, 4).map(({ chunk }) => chunk);
}

function isUniConnectTopic(query: string, chunks: AssistantKnowledgeChunk[]) {
  if (chunks.length > 0) {
    return true;
  }

  const queryText = stripAccents(query.toLowerCase());
  return DOMAIN_KEYWORDS.some((keyword) => queryText.includes(stripAccents(keyword.toLowerCase())));
}

function buildRecentHistory(messages: AssistantMessageRecord[]) {
  return messages.slice(-MAX_CONTEXT_MESSAGES).map((message) => ({
    role: message.speakerRole,
    content: message.content,
  }));
}

function serializeMessage(message: AssistantMessageRecord) {
  return {
    id: message.id,
    sessionId: message.sessionId,
    speakerRole: message.speakerRole,
    content: message.content,
    metadata: (message.metadata ?? null) as Record<string, any> | null,
    createdAt: message.createdAt.toISOString(),
  };
}

function serializeSession(session: AssistantSessionRecord) {
  return {
    id: session.id,
    userId: session.userId,
    sessionKey: session.sessionKey,
    role: session.role,
    roleLabel: roleLabel(normalizeRole(session.role)),
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    messages: session.messages.map(serializeMessage),
  };
}

function buildSourceMetadata(chunks: AssistantKnowledgeChunk[]) {
  return uniqueStrings(chunks.map((chunk) => chunk.reference)).map((reference) => ({
    reference,
  }));
}

function buildFallbackResponse(role: AssistantRole, chunks: AssistantKnowledgeChunk[]) {
  const references = buildSourceMetadata(chunks);
  const topicSummary = chunks
    .map((chunk) => `- ${chunk.summary}`)
    .join('\n');

  return {
    content: chunks.length > 0
      ? `Puedo ayudarte como ${roleLabel(role)} con UniConnect.\n\n${topicSummary}\n\nSi quieres, puedo profundizar en una sección concreta.`
      : 'Solo puedo responder sobre funcionalidades, políticas y módulos de UniConnect. Si tu consulta es sobre otra plataforma o un tema general ajeno al sistema, no la puedo resolver desde este asistente.',
    answerType: chunks.length > 0 ? (role === 'student' ? 'STANDARD' : 'ADMIN') : 'REFUSAL',
    references,
  };
}

async function callOllamaIfAvailable(payload: {
  role: AssistantRole;
  query: string;
  history: Array<{ role: string; content: string }>;
  chunks: AssistantKnowledgeChunk[];
}) {
  const contextBlock = payload.chunks.map((chunk) => `[${chunk.reference}] ${chunk.content}`).join('\n\n');
  const historyBlock = payload.history
    .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
    .join('\n');

  const systemPrompt = [
    'Eres el asistente contextual de UniConnect.',
    `Responde en español como si fueras un asistente para el rol ${payload.role}.`,
    'Solo puedes responder sobre funcionalidades, políticas, módulos, configuración y operación de UniConnect.',
    'Si la consulta es ajena a UniConnect, responde con una restricción elegante y breve.',
    'Incluye al final una línea con las referencias consultadas en formato: Referencias consultadas: ...',
    'Prioriza la información del contexto recuperado y usa el historial reciente solo para mantener la conversación coherente.',
    'Si el usuario es moderator o super_admin, da preferencia a contexto técnico y de administración.',
  ].join(' ');

  const prompt = [
    `Contexto de conocimiento recuperado:\n${contextBlock}`,
    historyBlock ? `Historial reciente:\n${historyBlock}` : 'Historial reciente: sin conversaciones previas relevantes.',
    `Consulta actual:\n${payload.query}`,
  ].join('\n\n');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        options: {
          temperature: 0.2,
          num_ctx: 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama responded with ${response.status}`);
    }

    const data = await response.json() as { message?: { content?: string } };
    const content = data.message?.content?.trim();
    if (!content) {
      throw new Error('Empty Ollama response');
    }

    return {
      content,
      answerType: payload.role === 'student' ? 'STANDARD' : 'ADMIN',
      references: buildSourceMetadata(payload.chunks),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function generateAssistantReply(input: {
  role: AssistantRole;
  query: string;
  history: Array<{ role: string; content: string }>;
  chunks: AssistantKnowledgeChunk[];
}) {
  if (!isUniConnectTopic(input.query, input.chunks)) {
    return buildFallbackResponse(input.role, []);
  }

  try {
    return await callOllamaIfAvailable(input);
  } catch {
    return buildFallbackResponse(input.role, input.chunks);
  }
}

async function upsertAssistantSession(db: AssistantDatabase, input: {
  userId: string;
  sessionKey: string;
  role: AssistantRole;
}) {
  return db.assistantSession.upsert({
    where: {
      userId_sessionKey: {
        userId: input.userId,
        sessionKey: input.sessionKey,
      },
    },
    update: {
      role: input.role,
      lastSeenAt: new Date(),
    },
    create: {
      userId: input.userId,
      sessionKey: input.sessionKey,
      role: input.role,
      lastSeenAt: new Date(),
    },
    include: assistantSessionInclude,
  });
}

async function loadAssistantSession(db: AssistantDatabase, sessionId: string) {
  const session = await db.assistantSession.findUnique({
    where: { id: sessionId },
    include: assistantSessionInclude,
  });

  if (!session) {
    throw new AppError(404, 'Sesión del asistente no encontrada');
  }

  return session;
}

export async function getAssistantSessionHistory(userId: string, sessionKey: string, role: string) {
  const normalizedRole = normalizeRole(role);
  const normalizedSessionKey = sanitizeSessionKey(sessionKey);
  const session = await upsertAssistantSession(prisma, {
    userId,
    sessionKey: normalizedSessionKey,
    role: normalizedRole,
  });

  return serializeSession(session);
}

export async function sendAssistantMessage(userId: string, sessionKey: string, role: string, query: string) {
  const normalizedRole = normalizeRole(role);
  const normalizedSessionKey = sanitizeSessionKey(sessionKey);
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    throw new AppError(400, 'La consulta no puede estar vacía');
  }

  const session = await upsertAssistantSession(prisma, {
    userId,
    sessionKey: normalizedSessionKey,
    role: normalizedRole,
  });

  const userMessage = await prisma.assistantMessage.create({
    data: {
      sessionId: session.id,
      speakerRole: 'user',
      content: trimmedQuery,
      metadata: {
        role: normalizedRole,
      },
    },
  });

  const currentSession = await loadAssistantSession(prisma, session.id);
  const recentHistory = buildRecentHistory(currentSession.messages);
  const relevantChunks = selectKnowledgeChunks(trimmedQuery, normalizedRole);
  const reply = await generateAssistantReply({
    role: normalizedRole,
    query: trimmedQuery,
    history: recentHistory,
    chunks: relevantChunks,
  });

  const assistantMessage = await prisma.assistantMessage.create({
    data: {
      sessionId: session.id,
      speakerRole: 'assistant',
      content: reply.content,
      metadata: {
        answerType: reply.answerType,
        role: normalizedRole,
        references: reply.references,
      },
    },
  });

  const refreshed = await loadAssistantSession(prisma, session.id);

  return {
    session: serializeSession(refreshed),
    userMessage: serializeMessage(userMessage),
    assistantMessage: serializeMessage(assistantMessage),
    role: normalizedRole,
    roleLabel: roleLabel(normalizedRole),
    answerType: reply.answerType,
  };
}
