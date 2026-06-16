import test from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { requireRoles } from './role.middleware.js';

type TestResponse = Response & {
  statusCode: number;
  body: any;
};

function makeResponse(): TestResponse {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(this: TestResponse, code: number) {
      this.statusCode = code;
      return this;
    },
    json(this: TestResponse, payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as TestResponse;

  return res;
}

test('requireRoles rejects missing authentication', () => {
  const res = makeResponse();
  let nextCalled = false;
  const middleware = requireRoles('super_admin');

  middleware({ user: undefined, originalUrl: '/admin/health', method: 'GET' } as Request, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, 'No autenticado');
  assert.equal(nextCalled, false);
});

test('requireRoles rejects insufficient role with 403', () => {
  const res = makeResponse();
  let nextCalled = false;
  const middleware = requireRoles('super_admin');

  middleware({ user: { sub: 'user-1', role: 'student' }, originalUrl: '/admin/health', method: 'GET' } as Request, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 403);
  assert.equal(res.body.message, 'Acceso restringido a super_admin');
  assert.equal(nextCalled, false);
});

test('requireRoles allows any configured role', () => {
  const res = makeResponse();
  let nextCalled = false;
  const middleware = requireRoles('super_admin', 'admin');

  middleware({ user: { sub: 'admin-1', role: 'admin' }, originalUrl: '/admin/health', method: 'GET' } as Request, res, () => {
    nextCalled = true;
  });

  assert.equal(res.statusCode, 200);
  assert.equal(nextCalled, true);
});
