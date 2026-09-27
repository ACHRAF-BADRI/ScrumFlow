import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, createProject, createTask, signUp } from './helpers.js';

describe('tasks, checklist, epics and activity', () => {
  test('tasks get sequential keys, the first "to do" status, and unknown statuses are refused', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const a = await createTask(owner, project._id, { title: 'First' });
    const b = await createTask(owner, project._id, { title: 'Second' });
    assert.deepEqual([a.number, b.number, a.status], [1, 2, 'todo']);
    const bad = await api(owner).patch(`/api/projects/${project._id}/tasks/${a._id}`).send({ status: 'nope' });
    assert.equal(bad.body.code, 'errors.badStatus');
  });

  test('completedAt follows the status, and drag & drop keeps the original completion date', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const task = await createTask(owner, project._id, { title: 'Ship it' });
    const url = `/api/projects/${project._id}/tasks/${task._id}`;
    const done = (await api(owner).patch(url).send({ status: 'done' })).body.task;
    assert.ok(done.completedAt);
    await api(owner).post(`/api/projects/${project._id}/tasks/reorder`).send({ items: [{ id: task._id, order: 5, status: 'done' }] });
    const again = (await api(owner).get(url)).body.task;
    assert.equal(again.completedAt, done.completedAt, 'reordering a done task does not reset the date');
    const reopened = (await api(owner).patch(url).send({ status: 'in_progress' })).body.task;
    assert.equal(reopened.completedAt, null);
  });

  test('assignees must be project members', async () => {
    const owner = await signUp('Owner');
    const outsider = await signUp('Outsider');
    const project = await createProject(owner);
    const res = await api(owner).post(`/api/projects/${project._id}/tasks`).send({ title: 'X', assignee: outsider.user._id });
    assert.equal(res.body.code, 'errors.assigneeNotMember');
  });

  test('checklist: add, check, rename, delete', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const task = await createTask(owner, project._id, { title: 'With steps' });
    const base = `/api/projects/${project._id}/tasks/${task._id}/checklist`;
    await api(owner).post(base).send({ text: 'Design' });
    const added = (await api(owner).post(base).send({ text: 'Build' })).body.task.checklist;
    assert.equal(added.length, 2);
    const checked = (await api(owner).patch(`${base}/${added[0]._id}`).send({ done: true })).body.task.checklist;
    assert.ok(checked[0].done && checked[0].doneAt);
    const renamed = (await api(owner).patch(`${base}/${added[1]._id}`).send({ text: 'Build the API' })).body.task.checklist;
    assert.equal(renamed[1].text, 'Build the API');
    const left = (await api(owner).delete(`${base}/${added[1]._id}`)).body.task.checklist;
    assert.equal(left.length, 1);
    const empty = await api(owner).post(base).send({ text: '   ' });
    assert.equal(empty.status, 400);
  });

  test('epics: only an epic can be a parent, deleting it detaches its stories', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const epic = await createTask(owner, project._id, { title: 'Checkout', type: 'epic' });
    const story = await createTask(owner, project._id, { title: 'Pay by card', epic: epic._id, status: 'done', points: 5 });
    const other = await createTask(owner, project._id, { title: 'Other' });
    assert.equal(story.epic, epic._id);

    const notEpic = await api(owner).patch(`/api/projects/${project._id}/tasks/${other._id}`).send({ epic: story._id });
    assert.equal(notEpic.body.code, 'errors.badEpic');

    const stats = (await api(owner).get(`/api/projects/${project._id}/stats`)).body;
    assert.deepEqual(stats.epics.map((e) => [e.title, e.done, e.total, e.donePoints]), [['Checkout', 1, 1, 5]]);

    await api(owner).delete(`/api/projects/${project._id}/tasks/${epic._id}`);
    const detached = (await api(owner).get(`/api/projects/${project._id}/tasks/${story._id}`)).body.task;
    assert.equal(detached.epic, null);
  });

  test('activity log records changes with readable values', async () => {
    const owner = await signUp('Nora');
    const project = await createProject(owner);
    const task = await createTask(owner, project._id, { title: 'Log me' });
    await api(owner).patch(`/api/projects/${project._id}/tasks/${task._id}`).send({ status: 'review', assignee: owner.user._id, points: 3 });
    await api(owner).post(`/api/projects/${project._id}/tasks/${task._id}/checklist`).send({ text: 'Step' });

    const { activity } = (await api(owner).get(`/api/projects/${project._id}/activity`)).body;
    const summary = activity.map((a) => (a.type === 'task.updated' ? `${a.data.field}:${a.data.to}` : a.type));
    assert.ok(summary.includes('task.created'));
    assert.ok(summary.includes('status:review'));
    assert.ok(summary.includes('assignee:Nora'), 'names are stored, not ids');
    assert.ok(summary.includes('points:3'));
    assert.ok(summary.includes('checklist.added'));
    assert.equal(activity[0].actorName, 'Nora');

    const history = (await api(owner).get(`/api/projects/${project._id}/tasks/${task._id}/activity`)).body.activity;
    assert.ok(history.length >= 4);
  });
});
