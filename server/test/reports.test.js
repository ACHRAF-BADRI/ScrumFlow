import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, createProject, createTask, request, signUp } from './helpers.js';

describe('reports and public link', () => {
  test('burndown and burnup of a chosen sprint, list of started sprints', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const base = `/api/projects/${project._id}`;
    const s1 = (await api(owner).post(`${base}/sprints`).send({ name: 'S1' })).body.sprint;
    const done = await createTask(owner, project._id, { title: 'A', sprint: s1._id, points: 5 });
    await createTask(owner, project._id, { title: 'B', sprint: s1._id, points: 3 });
    await api(owner).post(`${base}/sprints/${s1._id}/start`).send({});
    await api(owner).patch(`${base}/tasks/${done._id}`).send({ status: 'done' });
    await api(owner).post(`${base}/sprints/${s1._id}/complete`).send({ moveTo: 'backlog' });

    const stats = (await api(owner).get(`${base}/stats?sprint=${s1._id}`)).body;
    assert.deepEqual(stats.sprints.map((s) => [s.name, s.status]), [['S1', 'completed']]);
    assert.equal(stats.burndown.sprint, 'S1');
    assert.equal(stats.burndown.total, 8, 'scope = committed points, even though B moved out');
    const today = stats.burndown.points.find((p) => p.done !== null && p.remaining !== null && p.done > 0);
    assert.deepEqual([today.done, today.remaining, today.scope], [5, 3, 8]);
  });

  test('cumulative flow rebuilds past statuses from the activity log', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const a = await createTask(owner, project._id, { title: 'A' });
    await createTask(owner, project._id, { title: 'B' });
    await api(owner).patch(`/api/projects/${project._id}/tasks/${a._id}`).send({ status: 'in_progress' });

    const { days } = (await api(owner).get(`/api/projects/${project._id}/flow?days=7`)).body;
    assert.equal(days.length, 7);
    const last = days.at(-1);
    assert.deepEqual([last.todo, last.in_progress, last.done], [1, 1, 0]);
    assert.equal(days[0].todo + days[0].in_progress, 0, 'tasks did not exist a week ago');
  });

  test('public link: managers only, read-only board without emails, can be turned off', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const project = await createProject(owner, 'Public', [member]);
    const base = `/api/projects/${project._id}`;
    await createTask(owner, project._id, { title: 'Visible', assignee: member.user._id });

    assert.equal((await api(member).post(`${base}/share`)).status, 403);
    const { token } = (await api(owner).post(`${base}/share`)).body;
    assert.ok(token.length >= 20);

    // Saving the project again must not drop the hidden token
    await api(owner).patch(base).send({ name: 'Public board' });
    assert.equal((await api(owner).get(`${base}/share`)).body.token, token);
    assert.equal((await api(member).get(base)).body.project.shareToken, undefined, 'not sent with the project');

    const board = (await request.get(`/api/public/${token}`)).body;
    assert.equal(board.project.name, 'Public board');
    assert.deepEqual(board.tasks.map((t) => [t.title, t.assignee.name]), [['Visible', 'Member']]);
    assert.equal(JSON.stringify(board).includes('@test.io'), false, 'no email leaks');

    await api(owner).delete(`${base}/share`);
    assert.equal((await request.get(`/api/public/${token}`)).status, 404);
  });
});
