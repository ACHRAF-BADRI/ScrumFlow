# ScrumFlow

ScrumFlow is a workspace for Scrum teams. Plan your sprints, organize the backlog, move tasks across a board, follow progress with burndown and velocity charts, and discuss work directly on each task. It works in **English and French**, in **light and dark** mode, on desktop and mobile.

### 🔗 Live demo: [scrumflow-board.netlify.app](https://scrumflow-board.netlify.app/login)

Sign in with the demo account **`demo@scrumflow.app`** / **`demo1234`**, or create your own account.

> The API runs on Render's free plan and sleeps when idle, so the first sign-in can take up to a minute.

![Table view](docs/screenshots/table.png)

| Board (dark mode) | Board (in French) |
| --- | --- |
| ![Board in dark mode](docs/screenshots/board-dark.png) | ![Board in French](docs/screenshots/board-fr.png) |

| Dashboard | Sprint history |
| --- | --- |
| ![Dashboard](docs/screenshots/dashboard.png) | ![Sprint history](docs/screenshots/history.png) |

| Task details | Sign in |
| --- | --- |
| ![Task details](docs/screenshots/task.png) | ![Sign in](docs/screenshots/login.png) |

### On phones

The whole app is responsive. Here it is on a phone (390 px wide, dark mode):

![ScrumFlow on phones: projects, table, board and task details](docs/screenshots/mobile.png)

<p align="center"><sub>Projects list · Table view · Board · Task details</sub></p>

## How it works

A **project** holds your team, your backlog and your sprints. Every task has a type (story, task, bug, epic), a status, a priority, story points, an assignee, a due date and labels.

1. **Build the backlog**: add tasks to the backlog as ideas and requests come in.
2. **Plan a sprint**: create a sprint and drag tasks from the backlog into it.
3. **Start the sprint**: set its goal and dates. It becomes the *active* sprint and appears on the board.
4. **Work on the board**: move tasks from *To do* to *Working on it*, *In review* and *Done*. Mark blocked work as *Stuck*.
5. **Complete the sprint**: unfinished tasks move to the next sprint or back to the backlog. The results (committed vs delivered points) are saved and the sprint moves to the **History** tab.

## Features

- **Projects & team**: invite teammates by email, with roles (owner / admin / member) checked by the API
- **Table view**: tasks grouped by sprint and backlog. Status, priority, assignee, points and due date are edited directly in the row. Each group shows a status bar and its total points. Drag tasks between groups to plan sprints.
- **Board**: the active sprint by status, with drag & drop, quick add, sprint goal, progress and days left
- **Sprints**: create, start (goal and dates), complete (choose where open tasks go). Completed sprints can't be deleted, so the team's velocity history stays accurate.
- **History**: every completed sprint with its dates, goal, committed and delivered points, completion rate and delivered tasks, plus the team's average velocity and commitment reliability
- **Task details**: a side panel with its own shareable link (`?task=…`), description, labels and comments
- **Dashboard**: key numbers, sprint burndown, velocity, tasks by status and team workload
- **Search & filters**: by keyword, task key, label or person ("My tasks")
- **Interface**: colored status badges, toasts, themed tooltips, illustrated empty states, confirmation dialogs, collapsible sidebar (`Ctrl/⌘ + B`) and a mobile menu
- **Languages**: English / French (i18next), saved on the user profile, dates formatted for each language
- **Themes**: light / dark / system, saved on the profile, no flash on load
- **Team sync**: data refreshes when you come back to the tab and every 30 seconds, so teammates' changes show up

## Logo

The logo is a stack of three task cards, each with its status dot: red (stuck), orange (working on it) and green (done), the same colors as the app's statuses. It lives in `client/src/components/ui/LogoMark.jsx` (in-app) and `client/public/favicon.svg` (browser tab); keep both in sync.

## Tech stack

| Layer | Tech | Hosting |
| --- | --- | --- |
| Front end | React 18, Vite, Tailwind CSS, React Router, dnd-kit, Recharts, i18next, sonner, lucide | **Netlify** |
| API | Node.js, Express 5, Mongoose, JWT, bcrypt, helmet, rate limiting | **Render** |
| Database | MongoDB | **MongoDB Atlas** |

```
├── client/          React app (Netlify)
│   └── src/
│       ├── components/   ui/ (badges, modal, popover, tooltip, toaster, illustrations, logo…),
│       │                 tasks/, sprints/, layout/
│       ├── context/      Auth, Theme, Projects, Project (data + optimistic mutations)
│       ├── hooks/        useContainerDnd (shared drag & drop logic)
│       ├── i18n/         en.js, fr.js
│       └── pages/        Auth, Projects, Project + views/ (Table, Board, Dashboard, History, Team)
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
2. Fill in `MONGODB_URI` (Atlas string), `CLIENT_URL` (your Netlify URL, which you can set after step 3) and `RESEND_API_KEY` (for emails, optional). `JWT_SECRET` is generated for you, and `EMAIL_FROM` defaults to `onboarding@resend.dev` until you verify a domain in Resend.
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
| PATCH/DELETE | `/projects/:id/sprints/:sprintId` | Edit / delete a planned sprint (its tasks go back to the backlog; completed sprints are kept) |
| POST | `/projects/:id/sprints/:sprintId/start` \| `/complete` | Sprint lifecycle |
| GET/POST | `/projects/:id/tasks` | List (`?sprint=<id>\|backlog`) / create |
| GET/PATCH/DELETE | `/projects/:id/tasks/:taskId` | Task CRUD |
| POST | `/projects/:id/tasks/reorder` | Bulk order/status after drag & drop |
| POST/DELETE | `/projects/:id/tasks/:taskId/comments[/:commentId]` | Comments |

Errors return `{ message, code }`, where `code` is an i18n key (e.g. `errors.sprintAlreadyActive`) that the client translates.

## Reusing this for other team apps

The same structure works for other work-management tools (bug tracker, content calendar, sales pipeline…):

- **Workspace → Project → Iteration → Item.** Rename `Sprint`/`Task` and keep the membership check (`requireProject(roles)`) that protects every nested route.
- **Board columns and table groups come from config.** `client/src/lib/constants.js` defines statuses, priorities and types (id + color), and the server enums in `server/src/models/Task.js` must match. Change both to get a different workflow.
- **One drag & drop hook for everything.** `useContainerDnd` moves items between any containers (statuses, sprints, owners…) and returns the new order to save.
- **Optimistic updates in one context.** `ProjectContext` updates the UI first, calls the API, and rolls back with a toast on error.
- **i18n-first errors.** The server sends stable error codes and the client translates them, so adding a language means adding one file in `client/src/i18n/`.

## Author

**ACHRAF EL BADRI** · [github.com/ACHRAF-BADRI](https://github.com/ACHRAF-BADRI)
