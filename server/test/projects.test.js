import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { api, createProject, createTask, signUp } from './helpers.js';

describe('projects, team and workflow', () => {
  test('a new project gets the default workflow and a readable key', async () => {
    const owner = await signUp('Nora');
    const project = await createProject(owner, 'Mobile App');
    assert.equal(project.key, 'MA');
    assert.deepEqual(project.statuses.map((s) => s.key), ['todo', 'in_progress', 'review', 'stuck', 'done']);
  });

  test('outsiders cannot see a project, members cannot manage it', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const outsider = await signUp('Outsider');
    const project = await createProject(owner, 'Private', [member]);
    assert.equal((await api(outsider).get(`/api/projects/${project._id}`)).status, 404);
    assert.equal((await api(member).patch(`/api/projects/${project._id}`).send({ name: 'Hacked' })).status, 403);
  });

  test('inviting an email without account creates an invitation and returns its link', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const res = await api(owner).post(`/api/projects/${project._id}/members`).send({ email: 'newbie@test.io' });
    assert.equal(res.status, 202);
    assert.equal(res.body.emailSent, false, 'no Resend key in tests');
    assert.match(res.body.inviteUrl, /\/invite\/[a-f0-9]{64}$/);
    const pending = (await api(owner).get(`/api/projects/${project._id}/invitations`)).body.invitations;
    assert.deepEqual(pending.map((i) => i.email), ['newbie@test.io']);
  });

  test('workflow: validation rules', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const url = `/api/projects/${project._id}`;
    const onlyOne = await api(owner).patch(url).send({ statuses: [{ key: 'todo', category: 'todo' }] });
    assert.equal(onlyOne.body.code, 'errors.statusesCount');
    const noDone = await api(owner).patch(url).send({ statuses: [{ key: 'todo', category: 'todo' }, { key: 'review', category: 'in_progress' }] });
    assert.equal(noDone.body.code, 'errors.statusesDone');
    const unnamed = await api(owner).patch(url).send({ statuses: [{ key: 'todo', category: 'todo' }, { label: '', category: 'done' }] });
    assert.equal(unnamed.body.code, 'errors.statusName');
  });

  test('workflow: removed statuses move their tasks, "done" category completes them', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const stuck = await createTask(owner, project._id, { title: 'Blocked', status: 'stuck' });
    const review = await createTask(owner, project._id, { title: 'In review', status: 'review' });

    const res = await api(owner)
      .patch(`/api/projects/${project._id}`)
      .send({
        statuses: [
          { key: 'todo', category: 'todo' },
          { key: 'in_progress', category: 'in_progress' },
          { key: 'review', label: 'Shipped', category: 'done' }, // renamed and now counts as done
          { key: 'done', category: 'done' },
        ],
      });
    assert.equal(res.status, 200);
    const tasks = (await api(owner).get(`/api/projects/${project._id}/tasks`)).body.tasks;
    const byId = Object.fromEntries(tasks.map((t) => [t._id, t]));
    assert.equal(byId[stuck._id].status, 'in_progress', 'deleted "stuck" -> first status of its category');
    assert.ok(byId[review._id].completedAt, 'status moved to the done category');
  });

  test('stats count "done" from the status category', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    await createTask(owner, project._id, { title: 'A', status: 'done', points: 3 });
    await createTask(owner, project._id, { title: 'B', points: 2 });
    const stats = (await api(owner).get(`/api/projects/${project._id}/stats`)).body;
    assert.deepEqual([stats.totals.tasks, stats.totals.done, stats.totals.donePoints], [2, 1, 3]);
    assert.equal(stats.byStatus.done, 1);
  });

  test('workflow: WIP limits are kept and clamped', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner);
    const res = await api(owner)
      .patch(`/api/projects/${project._id}`)
      .send({ statuses: [{ key: 'todo', category: 'todo' }, { key: 'in_progress', category: 'in_progress', wipLimit: 3 }, { key: 'done', category: 'done', wipLimit: 500 }] });
    assert.deepEqual(res.body.project.statuses.map((s) => s.wipLimit), [0, 3, 99]);
  });

  test('migration: the old GitHub setting moves to the Git integration', async () => {
    const owner = await signUp('Owner');
    const project = await createProject(owner, 'Legacy');
    const { default: Project } = await import('../src/models/Project.js');
    const legacy = `old-${Date.now()}`;
    await Project.collection.updateOne({ _id: new (await import('mongoose')).default.Types.ObjectId(project._id) }, { $set: { github: { secret: legacy, repo: 'a/b', autoClose: false } }, $unset: { git: 1 } });
    const { runMigrations } = await import('../src/services/migrations.js');
    await runMigrations();
    await runMigrations(); // safe to run twice
    const git = (await api(owner).get(`/api/projects/${project._id}/git`)).body;
    assert.deepEqual([git.connected, git.provider, git.repo, git.autoClose, git.secret], [true, 'github', 'a/b', false, legacy]);
  });
});
