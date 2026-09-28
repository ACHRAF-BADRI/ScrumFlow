import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, PASSWORD, api, createProject, createTask, request, signUp } from './helpers.js';

async function rootSession() {
  const { ensureRootAdmin } = await import('../src/services/admin.js');
  await ensureRootAdmin();
  const res = await request.post('/api/auth/login').send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return { ...res.body, auth: `Bearer ${res.body.token}` };
}

describe('platform administration', () => {
  test('the main admin comes from the server settings, the area is invisible to others', async () => {
    const root = await rootSession();
    assert.deepEqual([root.user.isAdmin, root.user.email], [true, ADMIN_EMAIL]);
    assert.equal(JSON.stringify(root.user).includes('adminFingerprint'), false);

    const user = await signUp('Regular');
    assert.equal(user.user.isAdmin, false);
    assert.equal((await api(user).get('/api/admin/stats')).status, 404, 'no hint that the area exists');
    assert.equal((await api(root).get('/api/admin/stats')).status, 200);

    // Running the startup step again changes nothing, and the account cannot be deleted by itself
    await rootSession();
    assert.equal((await api(root).delete('/api/auth/me').send({ confirm: root.user.name })).body.code, 'errors.adminProtected');
  });

  test('users: search, create, view everything, edit, suspend blocks sign in and live sessions', async () => {
    const root = await rootSession();
    const owner = await signUp('Nadia Owner');
    const project = await createProject(owner, 'Hermes');
    const task = await createTask(owner, project._id, { title: 'Checkout', assignee: owner.user._id, points: 3 });

    const list = (await api(root).get(`/api/admin/users?q=${encodeURIComponent('Nadia')}`)).body;
    const row = list.users.find((u) => u._id === owner.user._id);
    assert.deepEqual([row.projects, row.openTasks, row.isAdmin], [1, 1, false]);

    const detail = (await api(root).get(`/api/admin/users/${owner.user._id}`)).body;
    assert.deepEqual(detail.projects.map((p) => [p.name, p.role]), [['Hermes', 'owner']]);
    assert.deepEqual(detail.tasks.map((t) => [t.key, t.title, t.role]), [[`${project.key}-${task.number}`, 'Checkout', 'assignee']]);
    assert.ok(detail.activity.length >= 1);

    const created = await api(root).post('/api/admin/users').send({ name: 'Made By Admin', email: `made.${Date.now()}@test.io`, password: PASSWORD });
    assert.equal(created.status, 201);
    assert.equal((await request.post('/api/auth/login').send({ email: created.body.user.email, password: PASSWORD })).status, 200);

    const renamed = await api(root).patch(`/api/admin/users/${owner.user._id}`).send({ name: 'Nadia O.', password: `${PASSWORD}-new` });
    assert.equal(renamed.body.user.name, 'Nadia O.');
    assert.equal((await request.post('/api/auth/login').send({ email: owner.user.email, password: `${PASSWORD}-new` })).status, 200);

    await api(root).patch(`/api/admin/users/${owner.user._id}`).send({ suspended: true });
    assert.equal((await request.post('/api/auth/login').send({ email: owner.user.email, password: `${PASSWORD}-new` })).body.code, 'errors.accountSuspended');
    const stale = await api(owner).get('/api/auth/me');
    assert.deepEqual([stale.status, stale.body.code], [401, 'errors.accountSuspended'], 'existing sessions stop working');
    await api(root).patch(`/api/admin/users/${owner.user._id}`).send({ suspended: false });
    assert.equal((await api(owner).get('/api/auth/me')).status, 200);
  });

  test('admin access: only the main admin grants it, admins cannot touch the main admin or each other', async () => {
    const root = await rootSession();
    const helper = await signUp('Helper');
    const other = await signUp('Other');

    await api(root).patch(`/api/admin/users/${helper.user._id}`).send({ isAdmin: true });
    assert.equal((await api(helper).get('/api/admin/stats')).status, 200, 'the new admin sees the area');
    assert.equal((await api(helper).get('/api/auth/me')).body.user.isAdmin, true);

    assert.equal((await api(helper).patch(`/api/admin/users/${other.user._id}`).send({ isAdmin: true })).body.code, 'errors.adminProtected');
    assert.equal((await api(helper).patch(`/api/admin/users/${root.user._id}`).send({ suspended: true })).status, 403);
    assert.equal((await api(helper).delete(`/api/admin/users/${root.user._id}`)).status, 403);
    assert.equal((await api(root).patch(`/api/admin/users/${root.user._id}`).send({ isAdmin: false })).status, 403, 'the main admin stays admin');
    assert.equal((await api(root).patch(`/api/admin/users/${root.user._id}`).send({ email: 'x@test.io' })).status, 403);

    // A regular admin can still manage regular users
    assert.equal((await api(helper).patch(`/api/admin/users/${other.user._id}`).send({ name: 'Other Renamed' })).status, 200);

    await api(root).patch(`/api/admin/users/${helper.user._id}`).send({ isAdmin: false });
    assert.equal((await api(helper).get('/api/admin/stats')).status, 404);
  });

  test('tasks of a user: change status, delete; deleting a user; everything is in the audit log', async () => {
    const root = await rootSession();
    const owner = await signUp('Owner');
    const mate = await signUp('Mate');
    const project = await createProject(owner, 'Zeus', [mate]);
    const task = await createTask(owner, project._id, { title: 'Ship it', assignee: mate.user._id });
    const extra = await createTask(owner, project._id, { title: 'Remove me' });

    const moved = (await api(root).patch(`/api/admin/tasks/${task._id}`).send({ status: 'done' })).body.task;
    assert.ok(moved.completedAt);
    assert.equal((await api(root).patch(`/api/admin/tasks/${task._id}`).send({ status: 'nope' })).body.code, 'errors.badStatus');
    assert.equal((await api(root).delete(`/api/admin/tasks/${extra._id}`)).status, 204);
    assert.equal((await api(owner).get(`/api/projects/${project._id}/tasks/${extra._id}`)).status, 404);

    const removed = await api(root).delete(`/api/admin/users/${mate.user._id}`);
    assert.equal(removed.status, 200);
    assert.equal((await request.post('/api/auth/login').send({ email: mate.user.email, password: PASSWORD })).status, 401);
    assert.equal((await api(owner).get(`/api/projects/${project._id}/tasks/${task._id}`)).body.task.assignee, null, 'their work is unassigned');

    const { entries } = (await api(root).get('/api/admin/audit')).body;
    const actions = entries.map((e) => e.action);
    for (const action of ['task.updated', 'task.deleted', 'user.deleted']) assert.ok(actions.includes(action), action);
    assert.equal(entries.find((e) => e.action === 'user.deleted').targetEmail, mate.user.email);
  });
});
