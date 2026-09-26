import { Logo } from './AppLayout';
import { LanguageSwitcher, ThemeToggle } from './Preferences';

/** Centered card layout for the small public pages (forgot / reset password, invitation). */
export default function AuthCard({ children }) {
  return (
    <div className="flex min-h-screen flex-col px-4 py-6 sm:px-10">
      <div className="flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}
