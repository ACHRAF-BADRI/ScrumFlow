# ScrumFlow

A Monday.com-style workspace for Scrum teams: plan sprints, move work on a Kanban board, track velocity and burndown, and collaborate with your team, in **English or French**, with **light and dark** themes, on desktop and mobile.

![Table view](docs/screenshots/table.png)

| Kanban (dark) | Kanban (français) |
| --- | --- |
| ![Board dark](docs/screenshots/board-dark.png) | ![Board FR](docs/screenshots/board-fr.png) |

| Dashboard | Mobile |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Mobile](docs/screenshots/mobile.png) |

## Features

- **Projects & team**: invite teammates by email, with roles (owner / admin / member) and permission checks on the API
- **Table view (Monday-style)**: tasks grouped by sprint + backlog, colored status/priority cells you edit inline, assignee, story points, due dates, status "battery", and drag & drop to plan work into sprints
- **Kanban board**: the active sprint by status, with drag & drop, quick add, progress and days left
- **Sprints**: create, start (goal and dates), complete (move unfinished work to the backlog or the next sprint), velocity tracking
- **Task details drawer**: shareable URL (`?task=…`), description, labels, type (story / task / bug / epic), comments ("updates")
- **Dashboard**: KPIs, sprint burndown, velocity, status breakdown, team workload
- **Modern UI**: soft badges, toasts (sonner), confirm dialogs, skeletons, responsive layout with a mobile drawer
- **i18n**: English / French (i18next), saved on the user profile; dates formatted per locale
- **Themes**: light / dark / system, saved on the profile, no flash on load
- **Near real-time**: data refreshes on window focus and every 30s, so teammates' changes show up

## Tech stack

| Layer | Tech | Hosting |
| --- | --- | --- |
| Front end | React 18, Vite, Tailwind CSS, React Router, dnd-kit, Recharts, i18next, sonner, lucide | **Netlify** |
| API | Node.js, Express 5, Mongoose, JWT, bcrypt, helmet, rate limiting | **Render** |
| Database | MongoDB | **MongoDB Atlas** |

```
├── client/          React app (Netlify)
│   └── src/
│       ├── components/   ui/ (badges, modal, popover…), tasks/, sprints/, layout/
│       ├── context/      Auth, Theme, Projects, Project (data + optimistic mutations)
│       ├── hooks/        useContainerDnd (shared drag & drop logic)
│       ├── i18n/         en.js, fr.js
│       └── pages/        Auth, Projects, Project + views/ (Table, Board, Dashboard, Team)
├── server/          Express API (Render)
│   └── src/
│       ├── models/       User, Project, Sprint, Task
│       ├── routes/       auth, projects (+members, stats), sprints, tasks
│       └── seed.js       demo data
├── netlify.toml
└── render.yaml
```

## Run locally

Requirements: Node 18+ and a MongoDB database (a free Atlas cluster or a local `mongod`).

```bash
npm run install:all

# server/.env  (copy from server/.env.example)
MONGODB_URI=mongodb+srv://...     # or mongodb://127.0.0.1:27017/scrumflow
JWT_SECRET=some-long-random-string
CLIENT_URL=http://localhost:5173

# client/.env  (copy from client/.env.example)
VITE_API_URL=http://localhost:5000

npm run seed          # optional: demo team → demo@scrumflow.app / demo1234
npm run dev:server    # http://localhost:5000
npm run dev:client    # http://localhost:5173 (in a second terminal)
```

## Deploy

### 1. MongoDB Atlas
1. Create a free **M0** cluster.
2. **Database Access**: add a database user.
3. **Network Access**: allow `0.0.0.0/0` (Render's free tier has no fixed IP).
4. **Connect → Drivers**: copy the connection string and add the database name, e.g. `…mongodb.net/scrumflow?retryWrites=true&w=majority`.

### 2. Render (API)
1. Render dashboard → **New → Blueprint** → select this repo (it reads `render.yaml`).
2. Fill in `MONGODB_URI` (Atlas string) and `CLIENT_URL` (your Netlify URL, which you can set after step 3). `JWT_SECRET` is generated for you.
3. Check `https://<your-service>.onrender.com/api/health` → `{"status":"ok","db":"connected"}`.

> Free Render services sleep after inactivity. The first request can take ~50s, and the app shows a "waking up the server" toast while it waits.

### 3. Netlify (front end)
1. Netlify → **Add new site → Import from Git** → select this repo (it reads `netlify.toml`: base `client`, publish `dist`).
2. **Environment variables**: `VITE_API_URL=https://<your-service>.onrender.com`.
3. Deploy, then put the Netlify URL into `CLIENT_URL` on Render. Several origins can be comma-separated. Netlify deploy previews of that site are allowed automatically.

## API overview

All routes are under `/api`, and everything except auth needs `Authorization: Bearer <token>`.

| Method | Route | Description |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Get a JWT |
| GET/PATCH | `/auth/me` | Profile, language, theme |
| GET/POST | `/projects` | List (with stats) / create |
| GET/PATCH/DELETE | `/projects/:id` | Read / update (admin) / delete (owner) |
| POST/PATCH/DELETE | `/projects/:id/members[/:userId]` | Invite, change role, remove / leave |
| GET | `/projects/:id/stats` | Totals, burndown, velocity, workload |
| GET/POST | `/projects/:id/sprints` | List / create |
| PATCH/DELETE | `/projects/:id/sprints/:sprintId` | Edit / delete (tasks go back to the backlog) |
| POST | `/projects/:id/sprints/:sprintId/start` \| `/complete` | Sprint lifecycle |
| GET/POST | `/projects/:id/tasks` | List (`?sprint=<id>\|backlog`) / create |
| GET/PATCH/DELETE | `/projects/:id/tasks/:taskId` | Task CRUD |
| POST | `/projects/:id/tasks/reorder` | Bulk order/status after drag & drop |
| POST/DELETE | `/projects/:id/tasks/:taskId/comments[/:commentId]` | Comments |

Errors return `{ message, code }`, where `code` is an i18n key (e.g. `errors.sprintAlreadyActive`) that the client translates.

## Reusing this for other Scrum / team apps

The app is built so the same structure works for other work-management tools (bug tracker, content calendar, CRM pipeline…):

- **Workspace → Project → Iteration → Item.** Rename `Sprint`/`Task` and keep the membership check (`requireProject(roles)`) that protects every nested route.
- **Board columns and table groups come from config.** `client/src/lib/constants.js` defines statuses, priorities and types (id + color), and the server enums in `server/src/models/Task.js` must match. Change both to get a different workflow.
- **One drag & drop hook for everything.** `useContainerDnd` moves items between any containers (statuses, sprints, owners…) and returns the new order to save.
- **Optimistic updates in one context.** `ProjectContext` updates the UI first, calls the API, and rolls back with a toast on error.
- **i18n-first errors.** The server sends stable error codes and the client translates them, so adding a language means adding one file in `client/src/i18n/`.
