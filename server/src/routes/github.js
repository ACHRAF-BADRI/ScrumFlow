import crypto from 'crypto';
import express, { Router } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { logActivity } from '../services/activity.js';
import { emitProjectChanged } from '../realtime.js';
import { isDoneStatus, statusesOf } from '../utils/statuses.js';

/*
 * GitHub webhook of one project: commits and pull requests that mention a
 * task key (e.g. "APO-12") appear on that task; a merged pull request can move
 * it to Done. The raw body is needed to check GitHub's signature, so this
 * router is mounted before express.json().
 */
const router = Router();
const MAX_LINKS = 30;

export function verifySignature(secret, raw, header) {
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(`sha256=${crypto.createHmac('sha256', secret).update(raw).digest('hex')}`);
  const received = Buffer.from(header);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/** Task numbers mentioned as KEY-123 in the given texts. */
export function mentionedNumbers(key, ...texts) {
  const re = new RegExp(`(?<![A-Za-z0-9])${key}-(\\d{1,6})(?![0-9])`, 'gi');
  const numbers = new Set();
  for (const text of texts) for (const match of String(text ?? '').matchAll(re)) numbers.add(Number(match[1]));
  return [...numbers];
}

/** Adds or updates (same URL) a link on the tasks; returns the tasks whose link is new. */
async function upsertLinks(project, numbers, link) {
  if (!numbers.length) return [];
  const tasks = await Task.find({ project: project._id, number: { $in: numbers } });
  const added = [];
  for (const task of tasks) {
    const existing = task.links.find((l) => l.url === link.url);
    if (existing) Object.assign(existing, link);
    else {
      task.links.push(link);
      if (task.links.length > MAX_LINKS) task.links.splice(0, task.links.length - MAX_LINKS);
      added.push(task);
    }
    await task.save();
  }
  return tasks.map((task) => ({ task, isNew: added.includes(task) }));
}

router.post('/github/:projectId', express.raw({ type: '*/*', limit: '5mb' }), async (req, res) => {
  const { projectId } = req.params;
  if (!mongoose.isValidObjectId(projectId)) return res.status(404).json({ message: 'Not found' });
  const project = await Project.findById(projectId).select('+github.secret');
  if (!project?.github?.secret) return res.status(404).json({ message: 'Not found' });
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifySignature(project.github.secret, raw, req.get('x-hub-signature-256'))) return res.status(401).json({ message: 'Bad signature' });

  let payload;
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).json({ message: 'Invalid JSON' });
  }
  const event = req.get('x-github-event');
  const actor = { _id: null, name: 'GitHub' };
  let linked = 0;

  if (payload.repository?.full_name && project.github.repo !== payload.repository.full_name) {
    await Project.updateOne({ _id: project._id }, { 'github.repo': payload.repository.full_name });
  }

  if (event === 'push') {
    for (const commit of (payload.commits ?? []).slice(0, 100)) {
      const numbers = mentionedNumbers(project.key, commit.message);
      const title = String(commit.message ?? '').split('\n')[0].slice(0, 200);
      const results = await upsertLinks(project, numbers, {
        kind: 'commit',
        url: commit.url,
        title,
        ref: String(commit.id ?? '').slice(0, 7),
        state: 'pushed',
        author: commit.author?.username || commit.author?.name || '',
        at: commit.timestamp ? new Date(commit.timestamp) : new Date(),
      });
      for (const { task, isNew } of results) {
        linked += 1;
        if (isNew) await logActivity({ project, actor: { ...actor, name: commit.author?.name || 'GitHub' }, task, type: 'github.linked', data: { kind: 'commit', ref: String(commit.id).slice(0, 7), title } });
      }
    }
  }

  if (event === 'pull_request' && payload.pull_request) {
    const pr = payload.pull_request;
    const numbers = mentionedNumbers(project.key, pr.title, pr.body, pr.head?.ref);
    const state = pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open';
    const results = await upsertLinks(project, numbers, {
      kind: 'pr',
      url: pr.html_url,
      title: String(pr.title ?? '').slice(0, 200),
      ref: `#${pr.number}`,
      state,
      author: pr.user?.login ?? '',
      at: new Date(pr.updated_at ?? Date.now()),
    });
    const done = statusesOf(project).find((s) => s.category === 'done');
    for (const { task, isNew } of results) {
      linked += 1;
      if (isNew) await logActivity({ project, actor: { ...actor, name: pr.user?.login || 'GitHub' }, task, type: 'github.linked', data: { kind: 'pr', ref: `#${pr.number}`, title: pr.title } });
      // A merged pull request finishes the task, if the project wants it
      if (state === 'merged' && project.github.autoClose && done && !isDoneStatus(project, task.status)) {
        const from = task.status;
        task.status = done.key;
        task.completedAt ??= new Date();
        await task.save();
        await logActivity({ project, actor, task, type: 'github.closed', data: { ref: `#${pr.number}`, from } });
      }
    }
  }

  if (linked) emitProjectChanged(project._id);
  return res.json({ ok: true, event, linked });
});

export default router;
