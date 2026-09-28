import { GitCommitHorizontal, GitMerge, GitPullRequest, GitPullRequestClosed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { relativeTime } from '../../lib/format';
import Tooltip from '../ui/Tooltip';

const STATES = {
  open: { color: '#00c875', icon: GitPullRequest },
  draft: { color: '#a1a3b8', icon: GitPullRequest },
  merged: { color: '#a25ddc', icon: GitMerge },
  closed: { color: '#e2445c', icon: GitPullRequestClosed },
};

/** Commits and pull / merge requests that mention this task (GitHub or GitLab integration). */
export default function DevLinks({ task }) {
  const { t } = useTranslation();
  const links = [...(task.links ?? [])].sort((a, b) => (a.kind === b.kind ? new Date(b.at) - new Date(a.at) : a.kind === 'pr' ? -1 : 1));
  if (!links.length) return null;

  return (
    <section data-testid="dev-links">
      <h3 className="label">{t('git.development')}</h3>
      <ul className="space-y-1.5">
        {links.map((link) => {
          const style = link.kind === 'pr' ? STATES[link.state] ?? STATES.open : { color: '#579bfc', icon: GitCommitHorizontal };
          const Icon = style.icon;
          return (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 text-sm hover:border-brand/50">
                <Tooltip label={t(`git.kind.${link.provider ?? 'github'}.${link.kind}`)}>
                  <Icon className="h-4 w-4 shrink-0" style={{ color: style.color }} />
                </Tooltip>
                <span className="shrink-0 font-mono text-xs text-muted">{link.ref}</span>
                <span className="min-w-0 flex-1 truncate">{link.title}</span>
                {link.kind === 'pr' && (
                  <span className="badge shrink-0" style={{ '--c': style.color }}>
                    {t(`git.state.${link.state}`, { defaultValue: link.state })}
                  </span>
                )}
                <span className="hidden shrink-0 text-[11px] text-muted sm:inline">
                  {link.author}, {relativeTime(link.at)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
