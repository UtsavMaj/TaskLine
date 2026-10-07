import { FolderKanban, History, LayoutDashboard, ListChecks, LogOut, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Banner } from '@/components/ui/States';

import { Logo } from './Logo';
import styles from './AppShell.module.css';

const links = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban, end: false },
  { to: '/tasks', label: 'All tasks', icon: ListChecks, end: false },
  { to: '/activity', label: 'Activity', icon: History, end: false },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const location = useLocation();
  const online = useOnlineStatus();

  // Close the mobile drawer after navigating.
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout();
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar} data-open={menuOpen} aria-label="Main navigation">
        <Link to="/" className={styles.brand}>
          <Logo />
          Taskline
        </Link>

        <nav className={styles.nav}>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={styles.navLink}>
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden>
              {initials(user.fullName)}
            </span>
            <div className={styles.who}>
              <strong>{user.fullName}</strong>
              <span>{user.email}</span>
            </div>
            <Button
              variant="ghost"
              size="small"
              iconOnly
              aria-label="Sign out"
              title="Sign out"
              loading={signingOut}
              onClick={handleLogout}
            >
              <LogOut size={16} />
            </Button>
          </div>
        )}
      </aside>

      <div className={styles.scrim} data-open={menuOpen} onClick={() => setMenuOpen(false)} aria-hidden />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <Link to="/" className={styles.brand}>
            <Logo />
            Taskline
          </Link>
          <Button
            variant="ghost"
            iconOnly
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </header>

        {!online && (
          <div style={{ padding: '12px clamp(16px, 4vw, 48px) 0' }}>
            <Banner tone="error">You’re offline. Changes can’t be saved until the connection is back.</Banner>
          </div>
        )}

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
