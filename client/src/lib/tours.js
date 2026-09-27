/**
 * Onboarding tours. Each step points at an element marked with
 * `data-tour="<target>"`; steps without a target are centered cards.
 * Steps whose element isn't on screen (e.g. the sidebar on mobile, or a
 * button only admins see) are skipped automatically.
 * Texts live in i18n under `tour.<tourId>.<stepId>.title|text`.
 */
export const TOURS = {
  home: [
    { id: 'welcome' },
    { id: 'newProject', target: 'new-project' },
    { id: 'sidebar', target: 'sidebar-projects', placement: 'right' },
    { id: 'myWork', target: 'nav-my-work', placement: 'right' },
    { id: 'language', target: 'language' },
    { id: 'theme', target: 'theme' },
    { id: 'account', target: 'user-menu' },
  ],
  project: [
    { id: 'views', target: 'view-tabs' },
    { id: 'newTask', target: 'new-task' },
    { id: 'addRow', target: 'add-row' },
    { id: 'status', target: 'status-cell' },
    { id: 'sprint', target: 'new-sprint' },
    { id: 'filters', target: 'filters' },
    { id: 'board', target: 'tab-board' },
    { id: 'team', target: 'tab-team' },
    { id: 'done' },
  ],
};
