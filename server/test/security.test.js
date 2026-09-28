import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { afterEach, describe, test } from 'node:test';
import { PASSWORD, api, createProject, createTask, request, signUp } from './helpers.js';

const { base32Encode, totp, verifyTotp } = await import('../src/utils/totp.js');
const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Replaces fetch for the given URL prefixes (provider APIs), everything else is refused. */
function stubFetch(routes) {
  globalThis.fetch = async (url) => {
    const hit = Object.entries(routes).find(([prefix]) => String(url).startsWith(prefix));
    if (!hit) throw new Error(`unexpected fetch ${url}`);
    return new Response(JSON.stringify(hit[1]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

describe('two-step verification, sign in with GitHub, GitLab and Microsoft, Git webhooks', () => {
  test('TOTP matches the RFC 6238 test vector', () => {
    // RFC 6238 test key, built here so no key-like text sits in the code
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    assert.equal(totp(secret, 59_000), '287082');
    assert.equal(verifyTotp(secret, '287082', 59_000 + 30_000), true, 'one step of drift is accepted');
    assert.equal(verifyTotp(secret, '287082', 59_000 + 120_000), false);
  });

  test('2FA: enable with a code, login needs the code, a recovery code works once, disable', async () => {
    const user = await signUp('Secure');
    const { secret, otpauthUrl } = (await api(user).post('/api/auth/me/2fa/setup')).body;
    assert.match(otpauthUrl, /^otpauth:\/\/totp\/ScrumFlow/);
    assert.equal((await api(user).post('/api/auth/me/2fa/enable').send({ code: '000000' })).body.code, 'errors.wrongCode');
    const enabled = (await api(user).post('/api/auth/me/2fa/enable').send({ code: totp(secret) })).body;
    assert.equal(enabled.user.twoFactor.enabled, true);
    assert.equal(enabled.recoveryCodes.length, 8);
    assert.equal(JSON.stringify(enabled.user).includes(secret), false, 'the secret is never sent back');

    const login = (await request.post('/api/auth/login').send({ email: user.user.email, password: PASSWORD })).body;
    assert.deepEqual([login.twoFactor, login.token], [true, undefined]);
    assert.equal((await request.get('/api/auth/me').set('Authorization', `Bearer ${login.ticket}`)).status, 401, 'a ticket is not a session');
    assert.equal((await request.post('/api/auth/2fa').send({ ticket: login.ticket, code: '123456' })).body.code, 'errors.wrongCode');
    const ok = (await request.post('/api/auth/2fa').send({ ticket: login.ticket, code: totp(secret) })).body;
    assert.ok(ok.token);

    const [recovery] = enabled.recoveryCodes;
    assert.ok((await request.post('/api/auth/2fa').send({ ticket: login.ticket, code: recovery })).body.token);
    assert.equal((await request.post('/api/auth/2fa').send({ ticket: login.ticket, code: recovery })).status, 400, 'used only once');

    const session = { auth: `Bearer ${ok.token}` };
    assert.equal((await api(session).post('/api/auth/me/2fa/disable').send({ password: 'nope' })).status, 400);
    assert.equal((await api(session).post('/api/auth/me/2fa/disable').send({ password: PASSWORD })).body.user.twoFactor.enabled, false);
  });

  test('sign in with GitHub: state is checked, account created or reused by email', async () => {
    const config = (await request.get('/api/config')).body;
    assert.deepEqual(config.oauth, { google: false, github: true, gitlab: true, microsoft: true });
    assert.match((await request.get('/api/auth/oauth/google')).headers.location, /\/login\?oauthError=disabled$/);

    const start = await request.get('/api/auth/oauth/github?lang=fr');
    const authorize = new URL(start.headers.location);
    assert.equal(authorize.origin, 'https://github.com');
    const state = authorize.searchParams.get('state');

    const bad = await request.get(`/api/auth/oauth/github/callback?code=x&state=forged`);
    assert.match(bad.headers.location, /oauthError=failed/);

    const email = `gh.${Date.now()}@test.io`;
    stubFetch({
      'https://github.com/login/oauth/access_token': { access_token: crypto.randomBytes(16).toString('hex') },
      'https://api.github.com/user/emails': [{ email, primary: true, verified: true }],
      'https://api.github.com/user': { id: 4242, login: 'octo', name: 'Octo Cat' },
    });
    const done = await request.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    const hash = new URLSearchParams(new URL(done.headers.location).hash.slice(1));
    assert.equal(hash.get('new'), '1');
    const me = (await request.get('/api/auth/me').set('Authorization', `Bearer ${hash.get('token')}`)).body.user;
    assert.deepEqual([me.name, me.email, me.language, me.oauth.github], ['Octo Cat', email, 'fr', true]);

    // Same email again: same account, not a new one
    const again = await request.get(`/api/auth/oauth/github/callback?code=abc&state=${state}`);
    assert.equal(new URLSearchParams(new URL(again.headers.location).hash.slice(1)).get('new'), null);
  });

  test('sign in with Microsoft: personal accounts are trusted, unverified work emails are refused', async () => {
    const idToken = (claims) => `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`;
    const stateOf = async () => new URL((await request.get('/api/auth/oauth/microsoft')).headers.location).searchParams.get('state');

    const email = `ms.${Date.now()}@outlook.com`;
    stubFetch({ 'https://login.microsoftonline.com/common/oauth2/v2.0/token': { id_token: idToken({ tid: '9188040d-6c67-4c5b-b112-36a304b66dad', oid: 'o1', preferred_username: email, name: 'Mia Soft' }) } });
    const ok = await request.get(`/api/auth/oauth/microsoft/callback?code=c&state=${await stateOf()}`);
    const token = new URLSearchParams(new URL(ok.headers.location).hash.slice(1)).get('token');
    const me = (await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`)).body.user;
    assert.deepEqual([me.name, me.email, me.oauth.microsoft], ['Mia Soft', email, true]);

    // A work directory can claim someone else's address: without xms_edov it is not used
    const victim = await signUp('Victim');
    stubFetch({ 'https://login.microsoftonline.com/common/oauth2/v2.0/token': { id_token: idToken({ tid: 'some-company', oid: 'o2', email: victim.user.email, name: 'Attacker' }) } });
    const refused = await request.get(`/api/auth/oauth/microsoft/callback?code=c&state=${await stateOf()}`);
    assert.match(refused.headers.location, /oauthError=noEmail/);

    stubFetch({ 'https://login.microsoftonline.com/common/oauth2/v2.0/token': { id_token: idToken({ tid: 'some-company', oid: 'o3', email: `work.${Date.now()}@acme.io`, xms_edov: true, name: 'Worker' }) } });
    const verified = await request.get(`/api/auth/oauth/microsoft/callback?code=c&state=${await stateOf()}`);
    assert.ok(new URL(verified.headers.location).hash.includes('token='), 'verified work email accepted');
  });

  test('sign in with GitLab: only a confirmed email is used', async () => {
    const stateOf = async () => new URL((await request.get('/api/auth/oauth/gitlab')).headers.location).searchParams.get('state');
    const start = new URL((await request.get('/api/auth/oauth/gitlab')).headers.location);
    assert.equal(`${start.origin}${start.pathname}`, 'https://gitlab.com/oauth/authorize');
    assert.equal(start.searchParams.get('scope'), 'read_user');

    const email = `gl.${Date.now()}@test.io`;
    stubFetch({ 'https://gitlab.com/oauth/token': { access_token: crypto.randomBytes(16).toString('hex') }, 'https://gitlab.com/api/v4/user': { id: 77, username: 'tanuki', name: 'Tanu Ki', email, confirmed_at: '2024-01-01T00:00:00Z' } });
    const ok = await request.get(`/api/auth/oauth/gitlab/callback?code=c&state=${await stateOf()}`);
    const token = new URLSearchParams(new URL(ok.headers.location).hash.slice(1)).get('token');
    const me = (await request.get('/api/auth/me').set('Authorization', `Bearer ${token}`)).body.user;
    assert.deepEqual([me.name, me.email, me.oauth.gitlab], ['Tanu Ki', email, true]);

    stubFetch({ 'https://gitlab.com/oauth/token': { access_token: crypto.randomBytes(16).toString('hex') }, 'https://gitlab.com/api/v4/user': { id: 78, username: 'x', email: `new.${Date.now()}@test.io`, confirmed_at: null } });
    const refused = await request.get(`/api/auth/oauth/gitlab/callback?code=c&state=${await stateOf()}`);
    assert.match(refused.headers.location, /oauthError=noEmail/);
  });

  test('GitLab webhook: token checked, commits and merge requests linked, merged MR finishes the task', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner, 'Apollo');
    const task = await createTask(owner, project._id, { title: 'Export' });
    const key = `${project.key}-${task.number}`;
    const { secret, webhookUrl, provider } = (await api(owner).post(`/api/projects/${project._id}/git`).send({ provider: 'gitlab' })).body;
    assert.equal(provider, 'gitlab');
    assert.ok(webhookUrl.endsWith(`/api/webhooks/gitlab/${project._id}`));
    assert.equal((await request.post(`/api/webhooks/github/${project._id}`).send('{}')).status, 404, 'the GitHub URL is closed for a GitLab project');

    const send = (event, payload, token = secret) =>
      request.post(`/api/webhooks/gitlab/${project._id}`).set('content-type', 'application/json').set('x-gitlab-event', event).set('x-gitlab-token', token).send(JSON.stringify(payload));
    const glProject = { path_with_namespace: 'acme/apollo' };
    assert.equal((await send('Push Hook', { project: glProject, commits: [] }, 'wrong')).status, 401);
    await send('Push Hook', { project: glProject, commits: [{ id: '1234567890abc', url: 'https://gitlab.com/acme/apollo/-/commit/1234567', message: `Export CSV ${key}`, author: { name: 'Tanu' }, timestamp: new Date().toISOString() }] });
    const mr = { iid: 5, url: 'https://gitlab.com/acme/apollo/-/merge_requests/5', title: `${key}: export`, description: '', state: 'opened', source_branch: 'export', updated_at: new Date().toISOString() };
    await send('Merge Request Hook', { project: glProject, user: { username: 'tanu' }, object_attributes: mr });
    await send('Merge Request Hook', { project: glProject, user: { username: 'tanu' }, object_attributes: { ...mr, state: 'merged', action: 'merge' } });

    const saved = (await api(owner).get(`/api/projects/${project._id}/tasks/${task._id}`)).body.task;
    assert.deepEqual(saved.links.map((l) => [l.provider, l.kind, l.ref, l.state]), [['gitlab', 'commit', '1234567', 'pushed'], ['gitlab', 'pr', '!5', 'merged']]);
    assert.equal(saved.status, 'done');
    assert.equal((await api(owner).get(`/api/projects/${project._id}/git`)).body.repo, 'acme/apollo');
  });

  test('GitHub webhook: signed pushes and PRs link tasks, a merged PR finishes the task', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner, 'Apollo');
    const task = await createTask(owner, project._id, { title: 'Login' });
    const key = `${project.key}-${task.number}`;
    const base = `/api/projects/${project._id}/git`;
    const member = await signUp('Member');
    await api(owner).post(`/api/projects/${project._id}/members`).send({ email: member.user.email });
    assert.equal((await api(member).get(base)).status, 403);
    const { secret, webhookUrl } = (await api(owner).post(base).send({ provider: 'github' })).body;
    assert.ok(webhookUrl.endsWith(`/api/webhooks/github/${project._id}`));

    const send = (event, payload, signWith = secret) => {
      const raw = JSON.stringify(payload);
      const signature = `sha256=${crypto.createHmac('sha256', signWith).update(raw).digest('hex')}`;
      return request.post(`/api/webhooks/github/${project._id}`).set('content-type', 'application/json').set('x-github-event', event).set('x-hub-signature-256', signature).send(raw);
    };

    const repository = { full_name: 'acme/apollo' };
    assert.equal((await send('push', { repository, commits: [] }, 'wrong-secret')).status, 401);
    const push = await send('push', { repository, commits: [{ id: 'abcdef1234', url: 'https://github.com/acme/apollo/commit/abcdef1', message: `Add login form (${key.toLowerCase()})\n\nDetails`, author: { username: 'octo' } }] });
    assert.deepEqual([push.status, push.body.linked], [200, 1]);

    const pr = { number: 7, html_url: 'https://github.com/acme/apollo/pull/7', title: `${key} Login`, body: '', state: 'open', merged: false, user: { login: 'octo' }, head: { ref: 'feature/login' } };
    await send('pull_request', { action: 'opened', repository, pull_request: pr });
    await send('pull_request', { action: 'closed', repository, pull_request: { ...pr, state: 'closed', merged: true } });

    const saved = (await api(owner).get(`/api/projects/${project._id}/tasks/${task._id}`)).body.task;
    assert.deepEqual(saved.links.map((l) => [l.kind, l.ref, l.state]), [['commit', 'abcdef1', 'pushed'], ['pr', '#7', 'merged']], 'the PR link is updated, not duplicated');
    assert.equal(saved.status, 'done');
    assert.ok(saved.completedAt);
    assert.equal((await api(owner).get(base)).body.repo, 'acme/apollo');
  });
});
