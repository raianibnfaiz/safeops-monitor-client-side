import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  AlertTriangle,
  Smartphone,
  Radio,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/workers', icon: Users, label: 'Workers' },
  { to: '/devices', icon: Smartphone, label: 'Devices' },
  { to: '/events', icon: Radio, label: 'Events' },
  { to: '/incidents', icon: AlertTriangle, label: 'Incidents' },
];

interface SidebarProps {
  /** Whether the sidebar is open as a mobile overlay. Ignored on desktop (md+), where it's always visible. */
  isMobileOpen: boolean;
  /** Called to close the mobile overlay (backdrop click, nav link click, Escape, etc). */
  onCloseMobile: () => void;
}

export function Sidebar({ isMobileOpen, onCloseMobile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { logout, user } = useAuth();
  const location = useLocation();

  return (
    <>
      {/* Mobile backdrop — clicking it overlaps/dismisses the sidebar without affecting page layout */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          // Mobile: fixed full-height overlay that slides in above the page content (never squeezes it)
          'fixed inset-y-0 left-0 z-40 w-64 flex flex-col bg-gray-900 dark:bg-gray-950 text-white transition-all duration-300',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          // Desktop: back to a normal in-flow, collapsible sidebar
          'md:static md:z-20 md:translate-x-0',
          collapsed && 'md:w-16',
        )}
      >
        {/* Logo */}
        <div className={clsx('flex items-center gap-3 px-4 py-5 border-b border-gray-700/50', collapsed && 'md:justify-center md:px-2')}>
          <div className="flex-shrink-0 w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className={clsx('min-w-0 flex-1', collapsed && 'md:hidden')}>
            <p className="text-sm font-bold text-white truncate">SafeOps</p>
            <p className="text-xs text-gray-400 truncate">Monitor</p>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Collapse toggle — desktop only; mobile uses the overlay open/close instead */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex absolute -right-3 top-14 w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded-full items-center justify-center text-gray-300 shadow-md transition-colors"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  collapsed && 'md:justify-center',
                  isActive || (to !== '/dashboard' && location.pathname.startsWith(to))
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700/50',
                )
              }
              title={collapsed ? label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className={clsx(collapsed && 'md:hidden')}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-700/50 p-3 space-y-2">
          {/* User */}
          {user && (
            <div className={clsx('flex items-center gap-2 px-2 py-1', collapsed && 'md:hidden')}>
              <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-white">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">Admin</p>
              </div>
            </div>
          )}

          {/* Logout */}
          <button
            onClick={logout}
            className={clsx(
              'flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors',
              collapsed && 'md:justify-center',
            )}
            title="Logout"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className={clsx(collapsed && 'md:hidden')}>Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}
