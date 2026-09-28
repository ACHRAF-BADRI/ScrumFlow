import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { describe, test } from 'node:test';
import { CLOUDINARY_SECRET, api, createProject, createTask, request, signUp } from './helpers.js';

describe('attachments, templates, recurring tasks and saved filters', () => {
  test('config tells the client which optional features are on', async () => {
    const res = await request.get('/api/config');
    assert.equal(res.body.attachments, true, 'CLOUDINARY_URL is set by the test helpers');
  });

  test('attachments: signed upload, only files from our folder, author or admin can delete', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const project = await createProject(owner, 'Files', [member]);
    const task = await createTask(owner, project._id, { title: 'With a file' });
    const base = `/api/projects/${project._id}/tasks/${task._id}/attachments`;

    const sign = (await api(member).post(`${base}/sign`)).body;
    const expected = crypto.createHash('sha1').update(`folder=${sign.folder}&timestamp=${sign.timestamp}${CLOUDINARY_SECRET}`).digest('hex');
    assert.deepEqual([sign.cloudName, sign.folder, sign.signature], ['demo-cloud', `scrumflow/${project._id}`, expected]);

    const foreign = await api(member).post(base).send({ url: 'https://evil.example/x.png', publicId: `scrumflow/${project._id}/x`, name: 'x.png' });
    assert.equal(foreign.body.code, 'errors.badAttachment');
    const otherFolder = await api(member).post(base).send({ url: 'https://res.cloudinary.com/demo-cloud/image/upload/x.png', publicId: 'scrumflow/other/x', name: 'x.png' });
    assert.equal(otherFolder.body.code, 'errors.badAttachment');

    const file = { url: 'https://res.cloudinary.com/demo-cloud/image/upload/v1/spec.png', publicId: `scrumflow/${project._id}/spec`, name: 'spec.png', size: 2048, mime: 'image/png', resourceType: 'image' };
    const added = await api(member).post(base).send(file);
    assert.equal(added.status, 201);
    const [saved] = added.body.task.attachments;
    assert.deepEqual([saved.name, saved.resourceType, saved.uploadedBy.name], ['spec.png', 'image', 'Member']);

    const stranger = await signUp('Stranger');
    await api(owner).post(`/api/projects/${project._id}/members`).send({ email: stranger.user.email });
    assert.equal((await api(stranger).delete(`${base}/${saved._id}`)).status, 403);
    const removed = await api(owner).delete(`${base}/${saved._id}`);
    assert.equal(removed.body.task.attachments.length, 0);
  });

  test('templates: create with a checklist, use it for a task, only the author or an admin edits', async () => {
    const owner = await signUp('Owner');
    const member = await signUp('Member');
    const project = await createProject(owner, 'Tpl', [member]);
    const base = `/api/projects/${project._id}/templates`;

    const missing = await api(member).post(base).send({ name: 'Bug report' });
    assert.equal(missing.body.code, 'errors.missingFields');
    const { template } = (await api(member).post(base).send({ name: 'Bug report', title: 'Bug: ', type: 'bug', priority: 'high', checklist: ['Steps', 'Expected', ' '] })).body;
    assert.deepEqual(template.checklist, ['Steps', 'Expected']);

    const task = await createTask(member, project._id, { title: 'Bug: login', type: template.type, checklist: template.checklist });
    assert.deepEqual(task.checklist.map((i) => i.text), ['Steps', 'Expected']);

    const other = await signUp('Other');
    await api(owner).post(`/api/projects/${project._id}/members`).send({ email: other.user.email });
    assert.equal((await api(other).patch(`${base}/${template._id}`).send({ name: 'Hacked' })).status, 403);
    assert.equal((await api(owner).patch(`${base}/${template._id}`).send({ name: 'Bug' })).body.template.name, 'Bug');
    assert.equal((await api(member).delete(`${base}/${template._id}`)).body.templates.length, 0);
  });

  test('recurring: next run dates', async () => {
    const { nextRun } = await import('../src/services/recurring.js');
    const monday = new Date('2026-09-28T10:00:00Z'); // after 06:00 UTC
    assert.equal(nextRun({ frequency: 'daily' }, monday).toISOString(), '2026-09-29T06:00:00.000Z');
    assert.equal(nextRun({ frequency: 'weekly', weekday: 1 }, monday).toISOString(), '2026-10-05T06:00:00.000Z');
    assert.equal(nextRun({ frequency: 'weekly', weekday: 3 }, monday).toISOString(), '2026-09-30T06:00:00.000Z');
    assert.equal(nextRun({ frequency: 'monthly', monthDay: 28 }, monday).toISOString(), '2026-10-28T06:00:00.000Z');
    assert.equal(nextRun({ frequency: 'monthly', monthDay: 1 }, new Date('2026-12-15T00:00:00Z')).toISOString(), '2027-01-01T06:00:00.000Z');
    assert.equal(nextRun({ frequency: 'none' }), null);
  });

  test('recurring: due templates create one task in the active sprint, then wait for the next date', async () => {
    const { runRecurring } = await import('../src/services/recurring.js');
    const owner = await signUp('Owner');
    const project = await createProject(owner, 'Ops');
    const sprint = (await api(owner).post(`/api/projects/${project._id}/sprints`).send({})).body.sprint;
    await createTask(owner, project._id, { title: 'Seed', sprint: sprint._id });
    await api(owner).post(`/api/projects/${project._id}/sprints/${sprint._id}/start`).send({});
    const { template } = (
      await api(owner)
        .post(`/api/projects/${project._id}/templates`)
        .send({ name: 'Weekly deploy', title: 'Deploy to production', assignee: owner.user._id, checklist: ['Tag', 'Deploy'], repeat: { frequency: 'weekly', weekday: 1 } })
    ).body;
    assert.ok(template.repeat.nextRun);

    const later = new Date(new Date(template.repeat.nextRun).getTime() + 3 * 7 * 86400000); // server slept 3 weeks
    await runRecurring(later);
    await runRecurring(later);
    const tasks = (await api(owner).get(`/api/projects/${project._id}/tasks`)).body.tasks.filter((t) => t.title === 'Deploy to production');
    assert.equal(tasks.length, 1, 'one task, not one per missed week');
    assert.deepEqual([tasks[0].sprint, tasks[0].assignee._id, tasks[0].checklist.length], [sprint._id, owner.user._id, 2]);

    const stored = (await api(owner).get(`/api/projects/${project._id}/templates`)).body.templates[0];
    assert.ok(new Date(stored.repeat.nextRun) > later);
  });

  test('saved filters are personal and per project', async () => {
    const owner = await signUp('Owner');
    const mate = await signUp('Mate');
    const project = await createProject(owner, 'Views', [mate]);
    const saved = await api(owner).post('/api/me/filters').send({ project: project._id, name: 'My bugs', filters: { type: 'bug', assignee: owner.user._id, evil: 'x' } });
    assert.equal(saved.status, 201);
    assert.deepEqual(saved.body.filters[0].filters, { assignee: owner.user._id, type: 'bug' });
    assert.equal((await api(mate).get(`/api/me/filters?project=${project._id}`)).body.filters.length, 0);

    const outsider = await signUp('Outsider');
    assert.equal((await api(outsider).post('/api/me/filters').send({ project: project._id, name: 'Spy' })).status, 404);
    const left = await api(owner).delete(`/api/me/filters/${saved.body.filters[0]._id}`);
    assert.equal(left.body.filters.length, 0);
    assert.equal((await api(owner).get('/api/auth/me')).body.user.savedFilters, undefined, 'not sent with the profile');
  });
});
