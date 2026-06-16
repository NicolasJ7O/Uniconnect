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

// ---------------------------------------------------------------------------
// PrismaPromise compatibility helper
//
// Prisma methods return `PrismaPromise<T>`, which is a thenable with extra
// fluent-API properties (sender, user, group, poll …). A plain `async`
// function returns a native `Promise<T>` which TypeScript rejects when you
// assign it to a Prisma delegate method because it is missing those chaining
// members.
//
// Solution: cast every mock assignment through `as any` at the site of the
// property assignment. This tells TypeScript "trust me, this satisfies the
// delegate's call signature" while keeping runtime behaviour correct.
// ---------------------------------------------------------------------------

// Save originals for restore
const originalModerationAuditLogCreate = prisma.moderationAuditLog?.create;
const originalUserBlockFindUnique      = prisma.userBlock?.findUnique;
const originalUserBlockUpsert          = prisma.userBlock?.upsert;
const originalUserBlockDelete          = prisma.userBlock?.delete;
const originalMessageCount             = prisma.message?.count;
const originalMessageCreate            = prisma.message?.create;
const originalMessageFindUnique        = (prisma.message as any)?.findUnique;
const originalUserFindUnique           = prisma.user?.findUnique;
const originalStudyGroupFindUnique     = prisma.studyGroup?.findUnique;
const originalTransaction              = prisma.$transaction;
const originalChatSubjectNotify        = chatSubject.notify;

// Mutable test state
let mockAudits: any[]       = [];
let mockBlocks: any[]       = [];
let mockMessagesCount       = 0;
let mockUser: any           = { id: 'user-1', name: 'Nicolas' };
let mockGroup: any          = {
  id: 'group-1',
  name: 'Grupo Estudiantes',
  ownerId: 'owner-1',
  members: [{ id: 'user-1', name: 'Nicolas' }],
};

function setupMocks() {
  mockAudits        = [];
  mockBlocks        = [];
  mockMessagesCount = 0;

  // Guard: initialise delegate objects if prisma client is not fully booted
  if (!prisma.moderationAuditLog) (prisma as any).moderationAuditLog = {};
  if (!prisma.userBlock)          (prisma as any).userBlock           = {};
  if (!prisma.message)            (prisma as any).message             = {};
  if (!prisma.user)               (prisma as any).user                = {};
  if (!prisma.studyGroup)         (prisma as any).studyGroup          = {};

  // ── moderationAuditLog ──────────────────────────────────────────────────
  (prisma.moderationAuditLog as any).create = async (args: any) => {
    mockAudits.push(args.data);
    return { id: 'audit-id', ...args.data };
  };

  // ── userBlock ────────────────────────────────────────────────────────────
  (prisma.userBlock as any).findUnique = async (args: any) => {
    return mockBlocks.find(b => b.userId === args.where.userId) ?? null;
  };

  (prisma.userBlock as any).upsert = async (args: any) => {
    const idx = mockBlocks.findIndex(b => b.userId === args.where.userId);
    if (idx !== -1) {
      // Handle Prisma-style atomic increments: { increment: N }
      const update = { ...args.update };
      for (const [key, val] of Object.entries(update)) {
        if (val !== null && typeof val === 'object' && 'increment' in (val as any)) {
          update[key] = (mockBlocks[idx][key] ?? 0) + (val as any).increment;
        }
      }
      mockBlocks[idx] = { ...mockBlocks[idx], ...update };
      return mockBlocks[idx];
    }
    const newBlock = { ...args.create };
    mockBlocks.push(newBlock);
    return newBlock;
  };

  (prisma.userBlock as any).delete = async (args: any) => {
    mockBlocks = mockBlocks.filter(b => b.userId !== args.where.userId);
    return {};
  };

  // ── message ──────────────────────────────────────────────────────────────
  (prisma.message as any).count = async (_args: any) => mockMessagesCount;

  (prisma.message as any).create = async (args: any) => ({
    id: 'msg-id',
    createdAt: new Date(),
    sender: mockUser,
    groupId: args.data?.groupId ?? null,
    senderId: args.data?.senderId ?? 'user-1',
    content: args.data?.content ?? '',
    poll: null,
    ...args.data,
  });

  (prisma.message as any).findUnique = async (_args: any) => ({
    id: 'msg-id',
    createdAt: new Date(),
    senderId: 'user-1',
    sender: mockUser,
    content: 'test',
    poll: null,
  });

  // ── user ─────────────────────────────────────────────────────────────────
  (prisma.user as any).findUnique = async (_args: any) => mockUser;

  // ── studyGroup ───────────────────────────────────────────────────────────
  (prisma.studyGroup as any).findUnique = async (_args: any) => mockGroup;

  // ── $transaction ─────────────────────────────────────────────────────────
  // PersistenciaHandler passes an async callback; we run it immediately with
  // the same prisma instance (already mocked).
  (prisma as any).$transaction = async (cb: any) => cb(prisma);

  // ── Notification side-effects (fire & forget in tests) ───────────────────
  if (!prisma.notification) (prisma as any).notification = {};
  (prisma.notification as any).create = async (_args: any) => ({ id: 'notif-id' });

  // ── Observer + socket (no-op) ─────────────────────────────────────────────
  // NOTE: emitToUser is an ESM live-binding export and cannot be reassigned
  // from outside the module in ES module mode (read-only property).
  // This is safe because socket.ts already guards: `if (io) { ... }` — when
  // io is not initialised (test environment), emitToUser is a silent no-op.
  chatSubject.notify = async () => {};
}

function restoreMocks() {
  if (prisma.moderationAuditLog) {
    (prisma.moderationAuditLog as any).create = originalModerationAuditLogCreate;
  }
  if (prisma.userBlock) {
    (prisma.userBlock as any).findUnique = originalUserBlockFindUnique;
    (prisma.userBlock as any).upsert     = originalUserBlockUpsert;
    (prisma.userBlock as any).delete     = originalUserBlockDelete;
  }
  if (prisma.message) {
    (prisma.message as any).count      = originalMessageCount;
    (prisma.message as any).create     = originalMessageCreate;
    (prisma.message as any).findUnique = originalMessageFindUnique;
  }
  if (prisma.user)       (prisma.user as any).findUnique       = originalUserFindUnique;
  if (prisma.studyGroup) (prisma.studyGroup as any).findUnique = originalStudyGroupFindUnique;
  (prisma as any).$transaction = originalTransaction;
  chatSubject.notify           = originalChatSubjectNotify;
}

// ===========================================================================
// Tests
// ===========================================================================

test('Message Moderation Chain of Responsibility Tests', async (t) => {
  setupMocks();

  // ── 1. LongitudHandler ─────────────────────────────────────────────────
  await t.test('LongitudHandler - rejects message > 1000 characters with MO_001', async () => {
    const handler = new LongitudHandler();

    const normalResult = await handler.handle({
      userId: 'user-1', content: 'Hello world', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(normalResult.approved, true);

    const longResult = await handler.handle({
      userId: 'user-1', content: 'A'.repeat(1001), chatId: 'group-1', isPrivate: false,
    });

    assert.strictEqual(longResult.approved, false);
    assert.strictEqual(longResult.moderationCode, 'MO_001');
    assert.strictEqual(longResult.message, 'Mensaje demasiado largo');
    assert.strictEqual(mockAudits.length, 1);
    assert.strictEqual(mockAudits[0].moderationCode, 'MO_001');
  });

  // ── 2. PalabrasProhibidasHandler ───────────────────────────────────────
  await t.test('PalabrasProhibidasHandler - rejects message with banned words with MO_002', async () => {
    const handler = new PalabrasProhibidasHandler();
    mockAudits = [];

    const normalResult = await handler.handle({
      userId: 'user-1', content: 'This is a clean message', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(normalResult.approved, true);

    const badResult = await handler.handle({
      userId: 'user-1', content: 'Este mensaje contiene ofensiva1 y mas palabras', chatId: 'group-1', isPrivate: false,
    });

    assert.strictEqual(badResult.approved, false);
    assert.strictEqual(badResult.moderationCode, 'MO_002');
    // Error message must NOT disclose the exact word
    assert.ok(!badResult.message?.includes('ofensiva1'));
    assert.strictEqual(mockAudits.length, 1);
    assert.strictEqual(mockAudits[0].moderationCode, 'MO_002');
    assert.strictEqual(mockAudits[0].metadata.termDetected, 'ofensiva1');
  });

  // ── 3. SpamHandler ─────────────────────────────────────────────────────
  await t.test('SpamHandler - blocks user and rejects with MO_003 when >= 5 messages in 30 s', async () => {
    const handler = new SpamHandler();
    mockAudits = [];
    mockBlocks = [];

    // Normal (2 messages in window)
    mockMessagesCount = 2;
    const okResult = await handler.handle({
      userId: 'user-1', content: 'Test message', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(okResult.approved, true);
    assert.strictEqual(mockBlocks.length, 0);

    // Spam threshold reached (5 messages)
    mockMessagesCount = 5;
    const spamResult = await handler.handle({
      userId: 'user-1', content: 'Test message 6', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(spamResult.approved, false);
    assert.strictEqual(spamResult.moderationCode, 'MO_003');
    // blockedUntil must be returned in the result
    assert.ok(spamResult.blockedUntil instanceof Date, 'blockedUntil should be a Date');
    assert.ok(spamResult.blockedUntil! > new Date(), 'blockedUntil should be in the future');
    // UserBlock record created
    assert.strictEqual(mockBlocks.length, 1);
    assert.strictEqual(mockBlocks[0].userId, 'user-1');
    assert.ok(mockBlocks[0].blockedUntil > new Date());
    assert.strictEqual(mockBlocks[0].blockCount, 1, 'blockCount should be 1 after first block');

    // User already blocked → rejected immediately (no new DB write for count)
    mockMessagesCount = 0;
    const blockedResult = await handler.handle({
      userId: 'user-1', content: 'Another attempt', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(blockedResult.approved, false);
    assert.strictEqual(blockedResult.moderationCode, 'MO_003');
    assert.ok(blockedResult.blockedUntil instanceof Date, 'blockedUntil should propagate on re-check');
  });

  // ── 4. EnlacesExternosHandler ──────────────────────────────────────────
  await t.test('EnlacesExternosHandler - rejects non-whitelisted domains with MO_004', async () => {
    const handler = new EnlacesExternosHandler();
    mockAudits = [];

    const okResult1 = await handler.handle({
      userId: 'user-1', content: 'Check out https://github.com/Nicol/uniconnect', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(okResult1.approved, true);

    const okResult2 = await handler.handle({
      userId: 'user-1', content: 'Check out https://sub.ucaldas.edu.co/portal', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(okResult2.approved, true);

    const badResult = await handler.handle({
      userId: 'user-1', content: 'Visit https://phishing-site.com or http://unallowed.net', chatId: 'group-1', isPrivate: false,
    });
    assert.strictEqual(badResult.approved, false);
    assert.strictEqual(badResult.moderationCode, 'MO_004');
    assert.strictEqual(mockAudits.length, 1);
    assert.ok(mockAudits[0].metadata.detectedDomains.includes('phishing-site.com'));
    assert.ok(mockAudits[0].metadata.detectedDomains.includes('unallowed.net'));
  });

  // ── 5. Full pipeline integration ───────────────────────────────────────
  await t.test('Pipeline integration - runs chain and invokes PersistenciaHandler', async () => {
    setupMocks();
    mockMessagesCount = 0;

    const pipelineResult = await runModerationPipeline({
      userId: 'user-1',
      content: 'All good with https://github.com/test',
      chatId: 'group-1',
      isPrivate: false,
    });

    assert.strictEqual(pipelineResult.approved, true);
    assert.ok(pipelineResult.savedMessage, 'savedMessage should be present');
    assert.strictEqual(pipelineResult.savedMessage.senderId, 'user-1');
  });

  restoreMocks();
});
