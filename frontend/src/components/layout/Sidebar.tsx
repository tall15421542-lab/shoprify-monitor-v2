import { NavLink } from 'react-router-dom';
import { Store, Package, BarChart3, History } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { path: '/stores', label: 'Stores', icon: Store },
  { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { path: '/changelog', label: 'Changelog', icon: History },
];

function Sidebar() {
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
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default Sidebar;

