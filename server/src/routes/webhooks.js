import crypto from 'crypto';
import express, { Router } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import { logActivity } from '../services/activity.js';
import { emitProjectChanged } from '../realtime.js';
import { isDoneStatus, statusesOf } from '../utils/statuses.js';

/*
 * Git webhooks of one project (GitHub or GitLab): commits and pull / merge
 * requests that mention a task key (e.g. "APO-12") appear on that task; a
 * merged one can move it to Done. GitHub signs the raw body, so this router is
 * mounted before express.json().
 */
const router = Router();
const MAX_LINKS = 30;
const raw = express.raw({ type: '*/*', limit: '5mb' });

const sameText = (a, b) => {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
};

/** GitHub: HMAC-SHA256 of the raw body with the secret. */
export const verifyGitHub = (secret, body, header) =>
  Boolean(secret && header?.startsWith('sha256=')) && sameText(`sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`, header);

/** GitLab: the secret token is sent as is in X-Gitlab-Token. */
export const verifyGitLab = (secret, header) => Boolean(secret) && sameText(secret, header);

/** Task numbers mentioned as KEY-123 in the given texts. */
export function mentionedNumbers(key, ...texts) {
  const re = new RegExp(`(?<![A-Za-z0-9])${key}-(\\d{1,6})(?![0-9])`, 'gi');
  const numbers = new Set();
  for (const text of texts) for (const match of String(text ?? '').matchAll(re)) numbers.add(Number(match[1]));
  return [...numbers];
}

/** Adds or updates (same URL) a link on the mentioned tasks. */
async function upsertLinks(project, numbers, link) {
  if (!numbers.length) return [];
  const tasks = await Task.find({ project: project._id, number: { $in: numbers } });
  const results = [];
  for (const task of tasks) {
    const existing = task.links.find((l) => l.url === link.url);
    if (existing) Object.assign(existing, link);
    else {
      task.links.push(link);
      if (task.links.length > MAX_LINKS) task.links.splice(0, task.links.length - MAX_LINKS);
    }
    await task.save();
    results.push({ task, isNew: !existing });
  }
  return results;
}

/** Commits of a push: one link per commit per mentioned task. */
async function linkCommits(project, provider, commits) {
  let linked = 0;
  for (const commit of commits.slice(0, 100)) {
    const title = String(commit.message ?? '').split('\n')[0].slice(0, 200);
    const ref = String(commit.id ?? '').slice(0, 7);
    const results = await upsertLinks(project, mentionedNumbers(project.key, commit.message), {
      kind: 'commit',
      provider,
      url: commit.url,
      title,
      ref,
      state: 'pushed',
      author: commit.author,
      at: commit.at,
    });
    for (const { task, isNew } of results) {
      linked += 1;
      if (isNew) await logActivity({ project, actor: { _id: null, name: commit.author || provider }, task, type: 'git.linked', data: { provider, kind: 'commit', ref, title } });
    }
  }
  return linked;
}

/** A pull request (GitHub) or merge request (GitLab): link it, and finish the task once merged. */
async function linkReview(project, provider, review) {
  const results = await upsertLinks(project, mentionedNumbers(project.key, review.title, review.body, review.branch), {
    kind: 'pr',
    provider,
    url: review.url,
    title: String(review.title ?? '').slice(0, 200),
    ref: review.ref,
    state: review.state,
    author: review.author,
    at: review.at,
  });
  const done = statusesOf(project).find((s) => s.category === 'done');
  const actor = { _id: null, name: review.author || provider };
  for (const { task, isNew } of results) {
    if (isNew) await logActivity({ project, actor, task, type: 'git.linked', data: { provider, kind: 'pr', ref: review.ref, title: review.title } });
    if (review.state === 'merged' && project.git.autoClose && done && !isDoneStatus(project, task.status)) {
      const from = task.status;
      task.status = done.key;
      task.completedAt ??= new Date();
      await task.save();
      await logActivity({ project, actor: { _id: null, name: provider === 'gitlab' ? 'GitLab' : 'GitHub' }, task, type: 'git.closed', data: { provider, ref: review.ref, from } });
    }
  }
  return results.length;
}

/** Loads the project whose integration matches `provider`, or null. */
async function loadProject(projectId, provider) {
  if (!mongoose.isValidObjectId(projectId)) return null;
  const project = await Project.findById(projectId).select('+git.secret');
  return project?.git?.secret && project.git.provider === provider ? project : null;
}

async function saveRepo(project, repo) {
  if (repo && project.git.repo !== repo) await Project.updateOne({ _id: project._id }, { 'git.repo': repo });
}

function parse(body) {
  try {
    return JSON.parse(Buffer.isBuffer(body) ? body.toString('utf8') : '');
  } catch {
    return null;
  }
}

router.post('/github/:projectId', raw, async (req, res) => {
  const project = await loadProject(req.params.projectId, 'github');
  if (!project) return res.status(404).json({ message: 'Not found' });
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  if (!verifyGitHub(project.git.secret, body, req.get('x-hub-signature-256'))) return res.status(401).json({ message: 'Bad signature' });
  const payload = parse(body);
  if (!payload) return res.status(400).json({ message: 'Invalid JSON' });
  const event = req.get('x-github-event');
  await saveRepo(project, payload.repository?.full_name);
  let linked = 0;

  if (event === 'push') {
    const commits = (payload.commits ?? []).map((c) => ({
      id: c.id,
      url: c.url,
      message: c.message,
      author: c.author?.username || c.author?.name || '',
      at: c.timestamp ? new Date(c.timestamp) : new Date(),
    }));
    linked = await linkCommits(project, 'github', commits);
  }
  if (event === 'pull_request' && payload.pull_request) {
    const pr = payload.pull_request;
    linked = await linkReview(project, 'github', {
      url: pr.html_url,
      title: pr.title,
      body: pr.body,
      branch: pr.head?.ref,
      ref: `#${pr.number}`,
      state: pr.merged ? 'merged' : pr.state === 'closed' ? 'closed' : pr.draft ? 'draft' : 'open',
      author: pr.user?.login ?? '',
      at: new Date(pr.updated_at ?? Date.now()),
    });
  }
  if (linked) emitProjectChanged(project._id);
  return res.json({ ok: true, event, linked });
});

router.post('/gitlab/:projectId', raw, async (req, res) => {
  const project = await loadProject(req.params.projectId, 'gitlab');
  if (!project) return res.status(404).json({ message: 'Not found' });
  if (!verifyGitLab(project.git.secret, req.get('x-gitlab-token'))) return res.status(401).json({ message: 'Bad token' });
  const payload = parse(req.body);
  if (!payload) return res.status(400).json({ message: 'Invalid JSON' });
  const event = req.get('x-gitlab-event');
  await saveRepo(project, payload.project?.path_with_namespace);
  let linked = 0;

  if (event === 'Push Hook') {
    const commits = (payload.commits ?? []).map((c) => ({
      id: c.id,
      url: c.url,
      message: c.message,
      author: c.author?.name || payload.user_username || '',
      at: c.timestamp ? new Date(c.timestamp) : new Date(),
    }));
    linked = await linkCommits(project, 'gitlab', commits);
  }
  if (event === 'Merge Request Hook' && payload.object_attributes) {
    const mr = payload.object_attributes;
    const states = { merged: 'merged', closed: 'closed', locked: 'closed' };
    linked = await linkReview(project, 'gitlab', {
      url: mr.url,
      title: mr.title,
      body: mr.description,
      branch: mr.source_branch,
      ref: `!${mr.iid}`,
      state: states[mr.state] ?? (mr.draft || mr.work_in_progress ? 'draft' : 'open'),
      author: payload.user?.username ?? '',
      at: new Date(mr.updated_at ?? Date.now()),
    });
  }
  if (linked) emitProjectChanged(project._id);
  return res.json({ ok: true, event, linked });
});

export default router;
