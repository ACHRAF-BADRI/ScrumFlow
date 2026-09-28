import Project from '../models/Project.js';

/**
 * Small data migrations, run at startup. Each one is safe to run again.
 */
export async function runMigrations() {
  // The GitHub-only "github" setting became "git" (GitHub or GitLab)
  const { modifiedCount } = await Project.collection.updateMany({ github: { $exists: true }, git: { $exists: false } }, [
    { $set: { git: { $mergeObjects: ['$github', { provider: 'github' }] } } },
    { $unset: 'github' },
  ]);
  if (modifiedCount) console.log(`[migrations] moved the Git settings of ${modifiedCount} project(s)`);
}
