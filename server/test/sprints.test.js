import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, createProject, createTask, signUp } from './helpers.js';

async function activeSprint(owner, project) {
  const sprint = (await api(owner).post(`/api/projects/${project._id}/sprints`).send({ name: 'Sprint 1' })).body.sprint;
  const done = await createTask(owner, project._id, { title: 'Done work', sprint: sprint._id, points: 5 });
  const open = await createTask(owner, project._id, { title: 'Open work', sprint: sprint._id, points: 3 });
  await api(owner).patch(`/api/projects/${project._id}/tasks/${done._id}`).send({ status: 'done' });
  const started = await api(owner).post(`/api/projects/${project._id}/sprints/${sprint._id}/start`).send({});
  assert.equal(started.body.sprint.status, 'active');
  return { sprint, done, open };
}

describe('sprints and retrospective', () => {
  test('only one active sprint, completion moves open work and measures velocity', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const { sprint, open } = await activeSprint(owner, project);

    const second = (await api(owner).post(`/api/projects/${project._id}/sprints`).send({})).body.sprint;
    await createTask(owner, project._id, { title: 'Next', sprint: second._id });
    const refused = await api(owner).post(`/api/projects/${project._id}/sprints/${second._id}/start`).send({});
    assert.equal(refused.body.code, 'errors.sprintAlreadyActive');

    const completed = (await api(owner).post(`/api/projects/${project._id}/sprints/${sprint._id}/complete`).send({ moveTo: second._id })).body;
    assert.deepEqual([completed.sprint.committedPoints, completed.sprint.completedPoints, completed.moved], [8, 5, 1]);
    const moved = (await api(owner).get(`/api/projects/${project._id}/tasks/${open._id}`)).body.task;
    assert.equal(moved.sprint, second._id);

    const locked = await api(owner).delete(`/api/projects/${project._id}/sprints/${sprint._id}`);
    assert.equal(locked.body.code, 'errors.sprintCompletedLocked', 'history is kept');
  });

  test('members cannot manage sprints', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const project = await createProject(owner, 'Team', [member]);
    assert.equal((await api(member).post(`/api/projects/${project._id}/sprints`).send({})).status, 403);
  });

  test('retrospective: cards, one vote per person, author rights, action to task', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const other = await signUp('Other');
    const project = await createProject(owner, 'Retro', [member, other]);
    const { sprint } = await activeSprint(owner, project);
    const base = `/api/projects/${project._id}/sprints/${sprint._id}/retro`;

    const card = (await api(member).post(base).send({ column: 'wentWell', text: 'Great pairing' })).body.sprint.retro[0];
    await api(owner).post(`${base}/${card._id}/vote`);
    await api(other).post(`${base}/${card._id}/vote`);
    let retro = (await api(owner).post(`${base}/${card._id}/vote`)).body.sprint.retro; // second click removes the vote
    assert.equal(retro[0].votes.length, 1);

    const forbidden = await api(other).delete(`${base}/${card._id}`);
    assert.equal(forbidden.status, 403, 'only the author or an admin can delete a card');

    const action = (await api(member).post(base).send({ column: 'actions', text: 'Add a staging environment' })).body.sprint.retro.find((i) => i.column === 'actions');
    const res = await api(member).post(`${base}/${action._id}/task`);
    assert.equal(res.status, 201);
    assert.deepEqual([res.body.task.title, res.body.task.sprint, res.body.task.labels], ['Add a staging environment', null, ['retro']]);
    retro = res.body.sprint.retro;
    assert.ok(retro.find((i) => i._id === action._id).task);

    const invalid = await api(member).post(base).send({ column: 'nope', text: 'x' });
    assert.equal(invalid.status, 400);
  });

  test('a planned sprint has no retrospective yet', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const planned = (await api(owner).post(`/api/projects/${project._id}/sprints`).send({})).body.sprint;
    const res = await api(owner).get(`/api/projects/${project._id}/sprints/${planned._id}/retro`);
    assert.equal(res.body.code, 'errors.retroPlanned');
  });
});
