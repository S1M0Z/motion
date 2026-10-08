import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLocal, jsonBody } from '../src/lib/server/http';
test('local origin follows Host when Next canonicalizes the request URL', () => {
  assert.doesNotThrow(() => assertLocal(new Request('http://localhost:3000/api/projects', { headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' } })));
  assert.throws(() => assertLocal(new Request('http://localhost:3000/api/projects', { headers: { host: '127.0.0.1:3000', origin: 'https://other.example' } })));
  assert.throws(() => assertLocal(new Request('http://localhost:3000/api/projects', { headers: { host: 'other.example' } })));
  assert.throws(() => assertLocal(new Request('http://localhost:3000/api/projects', { headers: { 'sec-fetch-site': 'cross-site' } })));
});
test('JSON request size and syntax are checked before validation', async () => {
  await assert.rejects(() => jsonBody(new Request('http://localhost:3000', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid' })), /JSON invalide/);
  await assert.rejects(() => jsonBody(new Request('http://localhost:3000', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"oversized":true}' }), 5), /volumineuse/);
});
