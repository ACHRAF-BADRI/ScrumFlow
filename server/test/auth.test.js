import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, request, signUp } from './helpers.js';

describe('auth and account', () => {
  test('sign up, sign in and read the profile', async () => {
    const res = await request.post('/api/auth/register').send({ name: 'Nora', email: 'nora@test.io', password: 'secret123' });
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.password, undefined, 'the password hash is never returned');

    const login = await request.post('/api/auth/login').send({ email: 'NORA@test.io', password: 'secret123' });
    assert.equal(login.status, 200, 'email is case insensitive');

    const me = await request.get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    assert.equal(me.body.user.name, 'Nora');
  });

  test('wrong credentials and duplicate emails are refused', async () => {
    const bad = await request.post('/api/auth/login').send({ email: 'nora@test.io', password: 'nope' });
    assert.equal(bad.status, 401);
    assert.equal(bad.body.code, 'errors.invalidCredentials');
    const dup = await request.post('/api/auth/register').send({ name: 'X', email: 'nora@test.io', password: 'secret123' });
    assert.equal(dup.body.code, 'errors.emailTaken');
  });

  test('protected routes need a token', async () => {
    assert.equal((await request.get('/api/projects')).status, 401);
  });

  test('changing the password checks the current one (400, not 401, so the session stays)', async () => {
    const user = await signUp('Tom');
    const wrong = await api(user).post('/api/auth/me/password').send({ currentPassword: 'nope', newPassword: 'another1' });
    assert.equal(wrong.status, 400);
    assert.equal(wrong.body.code, 'errors.wrongPassword');
    const ok = await api(user).post('/api/auth/me/password').send({ currentPassword: 'secret123', newPassword: 'another1' });
    assert.equal(ok.status, 200);
    const login = await request.post('/api/auth/login').send({ email: user.user.email, password: 'another1' });
    assert.equal(login.status, 200);
  });

  test('forgot password answers the same whether the email exists or not', async () => {
    const unknown = await request.post('/api/auth/forgot-password').send({ email: 'nobody@nowhere.io' });
    const user = await signUp('Lea');
    const known = await request.post('/api/auth/forgot-password').send({ email: user.user.email });
    assert.deepEqual(unknown.body, known.body);
    const invalid = await request.post('/api/auth/reset-password').send({ token: 'nope', password: 'brandnew1' });
    assert.equal(invalid.body.code, 'errors.resetInvalid');
  });

  test('deleting the account requires the exact name and hands shared projects over', async () => {
    const owner = await signUp('Owner Name');
    const mate = await signUp('Mate');
    const shared = (await api(owner).post('/api/projects').send({ name: 'Shared' })).body.project;
    await api(owner).post(`/api/projects/${shared._id}/members`).send({ email: mate.user.email });
    const solo = (await api(owner).post('/api/projects').send({ name: 'Solo' })).body.project;

    const refused = await api(owner).delete('/api/auth/me').send({ confirm: 'Owner' });
    assert.equal(refused.body.code, 'errors.confirmMismatch');

    const res = await api(owner).delete('/api/auth/me').send({ confirm: 'Owner Name' });
    assert.deepEqual([res.body.transferred, res.body.deleted], [1, 1]);
    const inherited = (await api(mate).get(`/api/projects/${shared._id}`)).body;
    assert.equal(inherited.role, 'owner');
    assert.equal((await api(mate).get(`/api/projects/${solo._id}`)).status, 404);
  });
});
