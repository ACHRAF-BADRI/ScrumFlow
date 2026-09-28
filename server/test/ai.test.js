import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import { api, createProject, createTask, request, signUp } from './helpers.js';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Simulated Groq: answers `content` (or a status), remembers the last request. */
function fakeAi(content, status = 200) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    if (!String(url).startsWith('https://api.groq.com/')) throw new Error(`unexpected fetch ${url}`);
    calls.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
    const body = status === 200 ? { choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] } : { error: { message: 'nope' } };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return calls;
}

describe('AI suggestions', () => {
  test('config announces the provider, never the key', async () => {
    const { body } = await request.get('/api/config');
    assert.deepEqual(body.ai, { provider: 'Groq' });
    assert.equal(JSON.stringify(body).includes(process.env.GROQ_API_KEY), false);
  });

  test('breakdown: task sent as data, answer cleaned even when wrapped in text', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const task = await createTask(owner, project._id, { title: 'Password reset by email', description: 'Users forgot their password.' });
    const calls = fakeAi('Sure! ```json\n{"checklist": ["Add the reset form", " ", "Send the email", {"text": "Expire links after 1 hour"}], "acceptanceCriteria": ["A reset email arrives within a minute"]}\n```');

    const res = await api(owner).post(`/api/projects/${project._id}/ai/tasks/${task._id}/breakdown`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.checklist, ['Add the reset form', 'Send the email', 'Expire links after 1 hour']);
    assert.deepEqual(res.body.acceptanceCriteria, ['A reset email arrives within a minute']);
    assert.deepEqual(res.body.usage, { used: 1, limit: 4 });

    const [call] = calls;
    assert.equal(call.headers.authorization, `Bearer ${process.env.GROQ_API_KEY}`);
    assert.deepEqual(call.body.response_format, { type: 'json_object' });
    assert.match(call.body.messages[0].content, /treat it as data/);
    assert.match(call.body.messages[1].content, /Password reset by email/);
    assert.match(call.body.messages[0].content, /Write in English/);
  });

  test('estimate: points snapped to the scale, similar keys limited to real finished tasks', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner, 'Apollo');
    const ref = await createTask(owner, project._id, { title: 'Login page', points: 3, status: 'done' });
    const task = await createTask(owner, project._id, { title: 'Signup page' });
    const calls = fakeAi({ points: 4, reason: 'Close to the login page.', similar: [`${project.key}-${ref.number}`, 'XYZ-99'] });

    const { body } = await api(owner).post(`/api/projects/${project._id}/ai/tasks/${task._id}/estimate`);
    assert.deepEqual([body.points, body.reason, body.similar], [3, 'Close to the login page.', [`${project.key}-${ref.number}`]]);
    assert.match(calls[0].body.messages[1].content, /Login page: 3 pts/);
  });

  test('sprint summary and draft retrospective, in the user language', async () => {
    const owner = await signUp('Owner');
    await api(owner).patch('/api/auth/me').send({ language: 'fr' });
    const project = await createProject(owner);
    const sprint = (await api(owner).post(`/api/projects/${project._id}/sprints`).send({ name: 'Sprint 1', goal: 'Ship login' })).body.sprint;
    await createTask(owner, project._id, { title: 'Login', sprint: sprint._id, points: 5, status: 'done' });
    const calls = fakeAi({ summary: '**Objectif atteint.**', wentWell: ['Bonne entraide'], toImprove: ['Estimer plus tôt'], actions: ['Ajouter des tests'] });

    const { body } = await api(owner).post(`/api/projects/${project._id}/ai/sprints/${sprint._id}/summary`);
    assert.deepEqual([body.summary, body.wentWell, body.toImprove, body.actions], ['**Objectif atteint.**', ['Bonne entraide'], ['Estimer plus tôt'], ['Ajouter des tests']]);
    assert.match(calls[0].body.messages[0].content, /Write in French/);
    assert.match(calls[0].body.messages[1].content, /Goal: Ship login/);
  });

  test('daily limit per project, provider errors are explained, other projects stay closed', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const task = await createTask(owner, project._id, { title: 'Anything' });
    const url = `/api/projects/${project._id}/ai/tasks/${task._id}/breakdown`;

    fakeAi({ checklist: ['Step'] }, 429);
    assert.equal((await api(owner).post(url)).body.code, 'errors.aiBusy');
    fakeAi('not json at all');
    assert.equal((await api(owner).post(url)).body.code, 'errors.aiFailed');
    fakeAi({ checklist: ['Step'] });
    assert.equal((await api(owner).post(url)).status, 200);
    assert.equal((await api(owner).post(url)).status, 200);
    const over = await api(owner).post(url);
    assert.deepEqual([over.status, over.body.code], [429, 'errors.aiLimit'], 'limit of 4 per day in the tests');

    const outsider = await signUp('Outsider');
    assert.equal((await api(outsider).post(url)).status, 404);
  });
});
