import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Store, Package, BarChart3, History, Bell } from 'lucide-react';
import { useMonitoringSubscriptions } from '../../hooks/useMonitoringSubscriptions';
import { useMonitoringChangeLogs } from '../../hooks/useMonitoringChangeLogs';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/stores', label: 'Stores', icon: Store },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/changelog', label: 'Changelog', icon: History },
  { path: '/subscriptions', label: 'Subscriptions', icon: Bell },
];

function Sidebar() {
  const { data: monitoringSubscriptions } = useMonitoringSubscriptions();
  const { data: unreadChangeLogsResponse } = useMonitoringChangeLogs(
    { readState: 'unread', limit: 1, offset: 0 },
    true
  );

  const subscriptionUnreadTotal = useMemo(
    () =>
      (monitoringSubscriptions ?? []).reduce(
        (total, subscription) => total + (subscription.unreadCount ?? 0),
        0
      ),
    [monitoringSubscriptions]
  );

  const unreadChangeLogCount = unreadChangeLogsResponse?.count ?? 0;
  const totalUnread = Math.max(subscriptionUnreadTotal, unreadChangeLogCount);

  const [showUnreadPulse, setShowUnreadPulse] = useState(false);
  const previousUnreadRef = useRef<number | null>(null);
  const pulseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const previousValue = previousUnreadRef.current;
    previousUnreadRef.current = totalUnread;

    if (previousValue !== null && totalUnread > previousValue) {
      setShowUnreadPulse(true);
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
      pulseTimeoutRef.current = window.setTimeout(() => {
        setShowUnreadPulse(false);
        pulseTimeoutRef.current = null;
      }, 2000);
    }

    if (totalUnread === 0) {
      setShowUnreadPulse(false);
    }
  }, [totalUnread]);

  useEffect(() => {
    return () => {
      if (pulseTimeoutRef.current) {
        window.clearTimeout(pulseTimeoutRef.current);
      }
    };
  }, []);

  const hasUnreadChangelog = totalUnread > 0;
  const unreadBadgeLabel = totalUnread > 99 ? '99+' : totalUnread.toString();

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shadow-sm">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <span className="relative">
                <Icon className="w-5 h-5" />
                {item.path === '/changelog' && hasUnreadChangelog && (
                  <>
                    <span
                      className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500 ring-2 ring-white"
                      aria-hidden="true"
                    />
                    {showUnreadPulse && (
                      <span
                        className="absolute -top-1 -right-1 inline-flex h-2.5 w-2.5 rounded-full bg-red-400 opacity-75 animate-ping"
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.path === '/changelog' && hasUnreadChangelog && (
                <span
                  className={`ml-auto inline-flex items-center justify-center rounded-full bg-primary-600 px-2 py-0.5 text-xs font-semibold text-white${
                    showUnreadPulse ? ' animate-bounce' : ''
                  }`}
                >
                  {unreadBadgeLabel}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;

