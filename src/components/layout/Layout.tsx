import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const PAGE_TITLES: Record<string, { title: string; subtitle?: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'System overview and real-time status' },
  '/workers': { title: 'Workers', subtitle: 'Field worker management' },
  '/incidents': { title: 'Incidents', subtitle: 'Safety incident tracking' },
};

export function Layout() {
  const { pathname } = useLocation();
  const basePath = '/' + pathname.split('/')[1];
  const pageInfo = PAGE_TITLES[basePath] ?? { title: 'SafeOps Monitor' };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
