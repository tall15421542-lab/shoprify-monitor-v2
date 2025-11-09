import { Store } from 'lucide-react';

function Navbar() {
  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center gap-3">
          <Store className="w-8 h-8 text-primary-600" />
          <h1 className="text-2xl font-bold text-gray-900">Shopify Monitor</h1>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;

