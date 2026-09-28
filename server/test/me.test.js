import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, createProject, createTask, signUp } from './helpers.js';

describe('my work, search and notifications', () => {
  test('my work lists only my open tasks, across projects, with each workflow', async () => {
    const owner = await signUp('Owner');
    const me = await signUp('Me');
    const p1 = await createProject(owner, 'Apollo', [me]);
    const p2 = await createProject(owner, 'Hermes', [me]);
    await createTask(owner, p1._id, { title: 'Mine open', assignee: me.user._id });
    await createTask(owner, p2._id, { title: 'Mine done', assignee: me.user._id, status: 'done' });
    await createTask(owner, p2._id, { title: 'Not mine', assignee: owner.user._id });

    const open = (await api(me).get('/api/me/tasks')).body;
    assert.deepEqual(open.tasks.map((t) => t.title), ['Mine open']);
    assert.equal(open.projects.length, 2);
    assert.ok(open.projects.every((p) => p.statuses.length === 5), 'projects carry their workflow');

    const done = (await api(me).get('/api/me/tasks?status=done')).body;
    assert.deepEqual(done.tasks.map((t) => t.title), ['Mine done']);
  });

  test('search finds tasks by title or key, only in my projects', async () => {
    const owner = await signUp('Owner');
    const stranger = await signUp('Stranger');
    const project = await createProject(owner, 'Zeta');
    await createTask(owner, project._id, { title: 'Payment page' });
    const second = await createTask(owner, project._id, { title: 'Invoices' });

    const byTitle = (await api(owner).get('/api/me/search?q=payment')).body;
    assert.deepEqual(byTitle.tasks.map((t) => t.title), ['Payment page']);
    const byKey = (await api(owner).get(`/api/me/search?q=ZET-${second.number}`)).body;
    assert.deepEqual(byKey.tasks.map((t) => t.title), ['Invoices']);
    const regex = await api(owner).get('/api/me/search?q=' + encodeURIComponent('(.*'));
    assert.equal(regex.status, 200, 'user input is escaped');
    const other = (await api(stranger).get('/api/me/search?q=payment')).body;
    assert.equal(other.tasks.length, 0);
  });

  test('assigning someone creates a notification for them, not for yourself', async () => {
    const owner = await signUp('Nora');
    const mate = await signUp('Tom Mate');
    const project = await createProject(owner, 'Bell', [mate]);
    await createTask(owner, project._id, { title: 'Self', assignee: owner.user._id });
    const task = await createTask(owner, project._id, { title: 'For Tom' });
    await api(owner).patch(`/api/projects/${project._id}/tasks/${task._id}`).send({ assignee: mate.user._id });
    await api(owner).post(`/api/projects/${project._id}/tasks/${task._id}/comments`).send({ text: 'Thanks @Tom Mate!' });
    // Notifications are created after the response: wait for them instead of a fixed delay (slow CI machines)
    let bell;
    for (let i = 0; i < 50; i += 1) {
      bell = (await api(mate).get('/api/notifications')).body;
      if (bell.notifications.length >= 3) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.deepEqual(bell.notifications.map((n) => n.type).sort(), ['added', 'assigned', 'mention']);
    assert.equal(bell.unread, 3);
    const read = (await api(mate).post('/api/notifications/read-all')).body;
    assert.equal(read.unread, 0);
    assert.equal((await api(owner).get('/api/notifications')).body.notifications.length, 0);
  });
});
