/*
 * Test setup: an in-memory MongoDB, the Express app (no network server) and
 * small helpers. Emails are disabled (no Resend key) and realtime is a no-op.
 */
import { after, before } from 'node:test';
import crypto from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
// Generated for each run: no credential is written in the code
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
export const PASSWORD = `pw-${crypto.randomUUID()}`;
export const NEW_PASSWORD = `pw-${crypto.randomUUID()}`;
process.env.MONGODB_URI = 'mongodb://placeholder'; // replaced below, config only checks it exists
process.env.RESEND_API_KEY = '';
process.env.CLIENT_URL = 'http://localhost:5173';
// Fake Cloudinary account: uploads are signed locally, nothing is sent
export const CLOUDINARY_SECRET = crypto.randomBytes(12).toString('hex');
process.env.CLOUDINARY_URL = `cloudinary://${crypto.randomBytes(6).toString('hex')}:${CLOUDINARY_SECRET}@demo-cloud`;
// Fake GitHub OAuth app (Google stays off): provider calls are stubbed in the tests
process.env.GITHUB_CLIENT_ID = crypto.randomBytes(6).toString('hex');
process.env.GITHUB_CLIENT_SECRET = crypto.randomBytes(12).toString('hex');
process.env.GOOGLE_CLIENT_ID = '';
process.env.GITLAB_CLIENT_ID = crypto.randomBytes(6).toString('hex');
process.env.GITLAB_CLIENT_SECRET = crypto.randomBytes(12).toString('hex');
process.env.BITBUCKET_CLIENT_ID = crypto.randomBytes(6).toString('hex');
process.env.BITBUCKET_CLIENT_SECRET = crypto.randomBytes(12).toString('hex');
process.env.MICROSOFT_CLIENT_ID = crypto.randomBytes(6).toString('hex');
process.env.MICROSOFT_CLIENT_SECRET = crypto.randomBytes(12).toString('hex');

let mongo;
let mongoose;
export let request;

before(async () => {
  mongo = await MongoMemoryServer.create();
  ({ default: mongoose } = await import('mongoose'));
  await mongoose.connect(mongo.getUri());
  const [{ default: app }, { default: supertest }] = await Promise.all([import('../src/app.js'), import('supertest')]);
  request = supertest(app);
  // Skipped-email logs are noise here
  console.info = () => {};
});

after(async () => {
  await mongoose?.disconnect();
  await mongo?.stop();
});

let counter = 0;
/** Creates an account and returns { token, user, auth } where auth is the header value. */
export async function signUp(name = 'User') {
  counter += 1;
  const res = await request.post('/api/auth/register').send({ name, email: `u${counter}.${Date.now()}@test.io`, password: PASSWORD });
  if (res.status !== 201) throw new Error(`sign up failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...res.body, auth: `Bearer ${res.body.token}` };
}

/** Shorthand for authenticated calls: api(user).post('/api/...').send(...) */
export const api = (user) => ({
  get: (url) => request.get(url).set('Authorization', user.auth),
  post: (url) => request.post(url).set('Authorization', user.auth),
  patch: (url) => request.patch(url).set('Authorization', user.auth),
  delete: (url) => request.delete(url).set('Authorization', user.auth),
});

/** A project owned by `owner`, optionally with members added. */
export async function createProject(owner, name = 'Apollo', members = []) {
  const { body } = await api(owner).post('/api/projects').send({ name });
  for (const m of members) await api(owner).post(`/api/projects/${body.project._id}/members`).send({ email: m.user.email });
  return body.project;
}

export const createTask = async (user, projectId, data) => (await api(user).post(`/api/projects/${projectId}/tasks`).send(data)).body.task;
