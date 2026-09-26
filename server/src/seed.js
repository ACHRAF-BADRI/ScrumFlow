/**
 * Creates a sample team, project, sprints and tasks for LOCAL development.
 *   npm run seed
 * Log in with demo@scrumflow.app / demo1234 (teammates use the same password).
 * Running it again resets the sample data only. Refuses Atlas databases unless --force.
 */
import mongoose from 'mongoose';
import { config } from './config.js';
import User from './models/User.js';
import Project from './models/Project.js';
import Sprint from './models/Sprint.js';
import Task from './models/Task.js';

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'demo1234';
const TEAM = [
  { name: 'Demo User', email: 'demo@scrumflow.app', avatarColor: '#6161ff' },
  { name: 'Sara Benali', email: 'sara@scrumflow.app', avatarColor: '#00c875' },
  { name: 'Lucas Martin', email: 'lucas@scrumflow.app', avatarColor: '#fdab3d' },
  { name: 'Yasmine Idrissi', email: 'yasmine@scrumflow.app', avatarColor: '#a25ddc' },
];

async function seed() {
  // Safety: sample data is for local databases, never for the production cluster
  if (config.mongoUri.startsWith('mongodb+srv://') && !process.argv.includes('--force')) {
    console.error('Refusing to seed a MongoDB Atlas (mongodb+srv) database: it looks like production.');
    console.error('Use a local database, or run `node src/seed.js --force` if you really mean it.');
    process.exit(1);
  }
  await mongoose.connect(config.mongoUri);

  const emails = TEAM.map((u) => u.email);
  const oldUsers = await User.find({ email: { $in: emails } }).select('_id');
  const oldProjects = await Project.find({ owner: { $in: oldUsers.map((u) => u._id) } }).select('_id');
  const oldIds = oldProjects.map((p) => p._id);
  await Promise.all([
    Task.deleteMany({ project: { $in: oldIds } }),
    Sprint.deleteMany({ project: { $in: oldIds } }),
    Project.deleteMany({ _id: { $in: oldIds } }),
    User.deleteMany({ email: { $in: emails } }),
  ]);

  // create() one by one so the password hashing hook runs
  const users = [];
  for (const u of TEAM) users.push(await User.create({ ...u, password: PASSWORD }));
  const [demo, sara, lucas, yasmine] = users;

  const project = await Project.create({
    name: 'Website Redesign',
    key: 'WEB',
    description: 'New marketing website and customer portal',
    color: '#6161ff',
    owner: demo._id,
    members: [
      { user: demo._id, role: 'owner' },
      { user: sara._id, role: 'admin' },
      { user: lucas._id, role: 'member' },
      { user: yasmine._id, role: 'member' },
    ],
  });

  const now = Date.now();
  const s1 = await Sprint.create({
    project: project._id,
    name: 'Sprint 1',
    goal: 'Design system & foundations',
    status: 'completed',
    startDate: new Date(now - 20 * DAY),
    endDate: new Date(now - 6 * DAY),
    completedAt: new Date(now - 6 * DAY),
    committedPoints: 21,
    completedPoints: 18,
  });
  const s2 = await Sprint.create({
    project: project._id,
    name: 'Sprint 2',
    goal: 'Ship the home page and authentication',
    status: 'active',
    startDate: new Date(now - 5 * DAY),
    endDate: new Date(now + 9 * DAY),
  });
  const s3 = await Sprint.create({ project: project._id, name: 'Sprint 3', goal: 'Customer portal', status: 'planned' });

  const tasks = [
    // Sprint 1 (done)
    { sprint: s1, title: 'Define color palette and typography', type: 'story', status: 'done', points: 5, assignee: yasmine, done: 15 },
    { sprint: s1, title: 'Set up CI pipeline', type: 'task', status: 'done', points: 3, assignee: lucas, done: 12 },
    { sprint: s1, title: 'Build button & input components', type: 'story', status: 'done', points: 8, assignee: sara, done: 8 },
    { sprint: s1, title: 'Fix font loading flicker', type: 'bug', status: 'done', points: 2, assignee: lucas, done: 7 },
    // Sprint 2 (active)
    { sprint: s2, title: 'Hero section with animated illustration', type: 'story', status: 'done', points: 5, assignee: yasmine, priority: 'high', done: 3 },
    { sprint: s2, title: 'Sign up / login pages', type: 'story', status: 'done', points: 5, assignee: sara, priority: 'high', done: 1 },
    { sprint: s2, title: 'JWT authentication API', type: 'task', status: 'review', points: 3, assignee: lucas, priority: 'critical' },
    { sprint: s2, title: 'Pricing table responsive layout', type: 'story', status: 'in_progress', points: 3, assignee: yasmine },
    { sprint: s2, title: 'Newsletter form returns 500', type: 'bug', status: 'stuck', points: 2, assignee: lucas, priority: 'critical', labels: ['api'] },
    { sprint: s2, title: 'SEO meta tags & sitemap', type: 'task', status: 'todo', points: 2, assignee: demo, priority: 'low' },
    { sprint: s2, title: 'Footer with language switcher', type: 'task', status: 'in_progress', points: 1, assignee: sara, labels: ['i18n'] },
    // Sprint 3 (planned)
    { sprint: s3, title: 'Customer dashboard layout', type: 'story', points: 8, assignee: yasmine },
    { sprint: s3, title: 'Invoices list with filters', type: 'story', points: 5, assignee: sara },
    // Backlog
    { title: 'Customer portal', type: 'epic', points: 0, priority: 'high' },
    { title: 'Dark mode for the marketing site', type: 'story', points: 3, priority: 'low', labels: ['ui'] },
    { title: 'Blog with CMS integration', type: 'story', points: 8 },
    { title: 'Accessibility audit (WCAG AA)', type: 'task', points: 3, priority: 'medium', labels: ['a11y'] },
  ];

  await Task.insertMany(
    tasks.map((t, i) => ({
      project: project._id,
      sprint: t.sprint?._id ?? null,
      number: i + 1,
      title: t.title,
      type: t.type,
      status: t.status ?? 'todo',
      priority: t.priority ?? 'medium',
      points: t.points,
      assignee: t.assignee?._id ?? null,
      reporter: demo._id,
      labels: t.labels ?? [],
      order: i + 1,
      dueDate: t.sprint === s2 ? new Date(now + (i % 3 === 0 ? -1 : 6) * DAY) : null,
      completedAt: t.done !== undefined ? new Date(now - t.done * DAY) : null,
      comments:
        i === 8
          ? [
              { author: lucas._id, text: 'Looks like the SMTP provider rejects our requests.' },
              { author: sara._id, text: 'I can pair on this tomorrow morning.' },
            ]
          : [],
    }))
  );
  project.taskCounter = tasks.length;
  await project.save();

  console.log(`Seeded project "${project.name}" with ${tasks.length} tasks.`);
  console.log(`Log in with ${TEAM[0].email} / ${PASSWORD}`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
