import test from 'node:test';
import assert from 'node:assert';
import { prisma } from '../../../lib/prisma.js';
import { LongitudHandler } from './longitud.handler.js';
import { PalabrasProhibidasHandler } from './palabras-prohibidas.handler.js';
import { SpamHandler } from './spam.handler.js';
import { EnlacesExternosHandler } from './enlaces-externos.handler.js';
import { PersistenciaHandler } from './persistencia.handler.js';
import { runModerationPipeline } from './moderation-pipeline.js';

import { chatSubject } from '../observers/index.js';
import * as socketLib from '../../../lib/socket.js';

// Setup Mock Environment for prisma calls
const originalModerationAuditLogCreate = prisma.moderationAuditLog?.create;
const originalUserBlockFindUnique = prisma.userBlock?.findUnique;
const originalUserBlockUpsert = prisma.userBlock?.upsert;
const originalUserBlockDelete = prisma.userBlock?.delete;
const originalMessageCount = prisma.message?.count;
const originalMessageCreate = prisma.message?.create;
const originalUserFindUnique = prisma.user?.findUnique;
const originalStudyGroupFindUnique = prisma.studyGroup?.findUnique;
const originalTransaction = prisma.$transaction;
const originalChatSubjectNotify = chatSubject.notify;
const originalEmitToUser = (socketLib as any).emitToUser;

// We will use a mock configuration to dynamically test
let mockAudits: any[] = [];
let mockBlocks: any[] = [];
let mockMessagesCount = 0;
let mockUser: any = { id: 'user-1', name: 'Nicolas' };
let mockGroup: any = { id: 'group-1', name: 'Grupo Estudiantes', members: [{ id: 'user-1', name: 'Nicolas' }] };

function setupMocks() {
  mockAudits = [];
  mockBlocks = [];
  mockMessagesCount = 0;

  // Initialize objects if prisma has them undefined in client-less test setups
  if (!prisma.moderationAuditLog) (prisma as any).moderationAuditLog = {};
  if (!prisma.userBlock) (prisma as any).userBlock = {};
  if (!prisma.message) (prisma as any).message = {};
  if (!prisma.user) (prisma as any).user = {};
  if (!prisma.studyGroup) (prisma as any).studyGroup = {};

  prisma.moderationAuditLog.create = async (args: any) => {
    mockAudits.push(args.data);
    return { id: 'audit-id', ...args.data };
  };

  prisma.userBlock.findUnique = async (args: any) => {
    return mockBlocks.find(b => b.userId === args.where.userId) || null;
  };

  prisma.userBlock.upsert = async (args: any) => {
    const existingIdx = mockBlocks.findIndex(b => b.userId === args.where.userId);
    if (existingIdx !== -1) {
      mockBlocks[existingIdx] = { ...mockBlocks[existingIdx], ...args.update };
      return mockBlocks[existingIdx];
    } else {
      const newBlock = { ...args.create };
      mockBlocks.push(newBlock);
      return newBlock;
    }
  };

  prisma.userBlock.delete = async (args: any) => {
    mockBlocks = mockBlocks.filter(b => b.userId !== args.where.userId);
    return {};
  };

  prisma.message.count = async (args: any) => {
    return mockMessagesCount;
  };

  prisma.message.create = async (args: any) => {
    return { id: 'msg-id', createdAt: new Date(), sender: mockUser, ...args.data };
  };

  prisma.user.findUnique = async (args: any) => {
    return mockUser;
  };

  prisma.studyGroup.findUnique = async (args: any) => {
    return mockGroup;
  };

  prisma.message.findUnique = async (args: any) => {
    return { id: 'msg-id', createdAt: new Date(), senderId: 'user-1', sender: mockUser, content: 'test', poll: null };
  };

  (prisma as any).$transaction = async (cb: any) => {
    return cb(prisma);
  };

  chatSubject.notify = async () => {};
}

function restoreMocks() {
  if (prisma.moderationAuditLog) prisma.moderationAuditLog.create = originalModerationAuditLogCreate;
  if (prisma.userBlock) {
    prisma.userBlock.findUnique = originalUserBlockFindUnique;
    prisma.userBlock.upsert = originalUserBlockUpsert;
    prisma.userBlock.delete = originalUserBlockDelete;
  }
  if (prisma.message) {
    prisma.message.count = originalMessageCount;
    prisma.message.create = originalMessageCreate;
  }
  if (prisma.user) prisma.user.findUnique = originalUserFindUnique;
  if (prisma.studyGroup) prisma.studyGroup.findUnique = originalStudyGroupFindUnique;
  (prisma as any).$transaction = originalTransaction;
  chatSubject.notify = originalChatSubjectNotify;
}

test('Message Moderation Chain of Responsibility Tests', async (t) => {
  setupMocks();

  await t.test('LongitudHandler - rejects message > 1000 characters with MO_001', async () => {
    const handler = new LongitudHandler();
    
    // Normal message
    const normalResult = await handler.handle({
      userId: 'user-1',
      content: 'Hello world',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(normalResult.approved, true);

    // Over-length message
    const longContent = 'A'.repeat(1001);
    const longResult = await handler.handle({
      userId: 'user-1',
      content: longContent,
      chatId: 'group-1',
      isPrivate: false
    });

    assert.strictEqual(longResult.approved, false);
    assert.strictEqual(longResult.moderationCode, 'MO_001');
    assert.strictEqual(longResult.message, 'Mensaje demasiado largo');
    assert.strictEqual(mockAudits.length, 1);
    assert.strictEqual(mockAudits[0].moderationCode, 'MO_001');
  });

  await t.test('PalabrasProhibidasHandler - rejects message with banned words with MO_002', async () => {
    const handler = new PalabrasProhibidasHandler();
    mockAudits = [];

    // Normal message
    const normalResult = await handler.handle({
      userId: 'user-1',
      content: 'This is a clean message',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(normalResult.approved, true);

    // Message with prohibited word
    const badResult = await handler.handle({
      userId: 'user-1',
      content: 'Este mensaje contiene ofensiva1 y mas palabras',
      chatId: 'group-1',
      isPrivate: false
    });

    assert.strictEqual(badResult.approved, false);
    assert.strictEqual(badResult.moderationCode, 'MO_002');
    // Error message must not disclose the exact word
    assert.ok(!badResult.message?.includes('ofensiva1'));
    assert.strictEqual(mockAudits.length, 1);
    assert.strictEqual(mockAudits[0].moderationCode, 'MO_002');
    assert.strictEqual(mockAudits[0].metadata.termDetected, 'ofensiva1');
  });

  await t.test('SpamHandler - blocks user and rejects with MO_003 when > 5 messages in 30 seconds', async () => {
    const handler = new SpamHandler();
    mockAudits = [];
    mockBlocks = [];

    // 1. Normal state (e.g. 2 messages in 30 seconds)
    mockMessagesCount = 2;
    const okResult = await handler.handle({
      userId: 'user-1',
      content: 'Test message',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(okResult.approved, true);
    assert.strictEqual(mockBlocks.length, 0);

    // 2. Spam state (5 messages in 30 seconds)
    mockMessagesCount = 5;
    const spamResult = await handler.handle({
      userId: 'user-1',
      content: 'Test message 6',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(spamResult.approved, false);
    assert.strictEqual(spamResult.moderationCode, 'MO_003');
    // User Block is created
    assert.strictEqual(mockBlocks.length, 1);
    assert.strictEqual(mockBlocks[0].userId, 'user-1');
    assert.ok(mockBlocks[0].blockedUntil > new Date());

    // 3. User already blocked
    mockMessagesCount = 0; // count goes to 0 but block is active
    const blockedResult = await handler.handle({
      userId: 'user-1',
      content: 'Another attempt',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(blockedResult.approved, false);
    assert.strictEqual(blockedResult.moderationCode, 'MO_003');
  });

  await t.test('EnlacesExternosHandler - rejects non-whitelisted domains with MO_004', async () => {
    const handler = new EnlacesExternosHandler();
    mockAudits = [];

    // 1. Allowed domain (github.com, drive.google.com, sub.ucaldas.edu.co)
    const okResult1 = await handler.handle({
      userId: 'user-1',
      content: 'Check out https://github.com/Nicol/uniconnect',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(okResult1.approved, true);

    const okResult2 = await handler.handle({
      userId: 'user-1',
      content: 'Check out https://sub.ucaldas.edu.co/portal',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(okResult2.approved, true);

    // 2. Unallowed domains
    const badResult = await handler.handle({
      userId: 'user-1',
      content: 'Visit https://phishing-site.com or http://unallowed.net',
      chatId: 'group-1',
      isPrivate: false
    });
    assert.strictEqual(badResult.approved, false);
    assert.strictEqual(badResult.moderationCode, 'MO_004');
    assert.strictEqual(mockAudits.length, 1);
    assert.ok(mockAudits[0].metadata.detectedDomains.includes('phishing-site.com'));
    assert.ok(mockAudits[0].metadata.detectedDomains.includes('unallowed.net'));
  });

  await t.test('Pipeline integration - runs chain and invokes PersistenciaHandler', async () => {
    setupMocks();
    mockMessagesCount = 0; // No spam
    
    const pipelineResult = await runModerationPipeline({
      userId: 'user-1',
      content: 'All good with https://github.com/test',
      chatId: 'group-1',
      isPrivate: false
    });

    assert.strictEqual(pipelineResult.approved, true);
    assert.ok(pipelineResult.savedMessage);
    assert.strictEqual(pipelineResult.savedMessage.senderId, 'user-1');
  });

  restoreMocks();
});
