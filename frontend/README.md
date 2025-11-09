# Shopify Monitor Frontend

A modern React application for monitoring Shopify store product prices with analytics and historical tracking.

## ✨ Features

- 🏪 **Store Management**: Add and monitor multiple Shopify stores
- 📦 **Product Tracking**: View products with real-time price updates
- 📊 **Analytics Dashboard**: Visualize price trends with interactive charts
- 📝 **Change History**: Track all price changes with detailed logs
- 🎨 **Modern UI**: Built with Tailwind CSS for a beautiful, responsive design
- ✅ **Fully Tested**: 54 passing unit tests with high coverage

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query) + Context API
- **Charts**: Recharts
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library
- **HTTP Client**: Axios

## 📁 Project Structure

```
frontend/
├── src/
│   ├── pages/              # Page components
│   │   ├── StoresPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── ChangelogPage.tsx
│   ├── components/         # Reusable components
│   │   ├── layout/         # Layout components (Navbar, Sidebar)
│   │   ├── stores/         # Store-related components
│   │   ├── products/       # Product-related components
│   │   ├── charts/         # Chart and analytics components
│   │   ├── changelog/      # Changelog components
│   │   └── common/         # Shared UI components
│   ├── services/          # API integration
│   │   └── api.ts
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript type definitions
│   ├── utils/             # Helper functions
│   ├── styles/            # Global styles
│   └── test/              # Test setup
├── public/                # Static assets
└── index.html             # Entry HTML file
```

## 🚀 Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Installation

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

### Development

```bash
# Start development server
npm run dev

# Server will start at http://localhost:5173
```

### Building for Production

```bash
# Build the application
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📱 Pages & Features

### 1. Stores Page (`/stores`)
- View all monitored stores
- Add new stores with a modal form
- See store status (active/paused/error)
- Quick navigation to store products
- **Tests**: StoreCard, StoreList, AddStoreModal

### 2. Products Page (`/stores/:storeId/products`)
- Grid view of all products from a store
- Display product images and current prices
- Visual price change indicators (↑ increase, ↓ decrease)
- Click to view price history modal with chart
- **Tests**: ProductCard, ProductGrid, PriceChange

### 3. Dashboard Page (`/dashboard`)
- Date range picker (default: last 30 days)
- Filter by store and/or tag
- Configurable aggregation window (1h, 24h, 1 week)
- Three chart types:
  - Average price by store
  - Average price by tag
  - Combined store + tag analysis
- **Tests**: LineChart, DateRangePicker, ChartFilters

### 4. Changelog Page (`/changelog`)
- Comprehensive price change history
- Filter by store, tag, and date range
- Table view with:
  - Timestamp
  - Product name
  - Store name
  - Old/new prices
  - Price change amount and percentage
  - Product tags
- **Tests**: ChangelogTable, ChangelogFilters

## 🎨 UI Components

### Common Components
- `LoadingSpinner`: Reusable loading indicator
- `ErrorMessage`: Error display with retry button
- `EmptyState`: Empty state placeholder
- `Modal`: Customizable modal dialog

### Layout Components
- `MainLayout`: App shell with sidebar and content area
- `Navbar`: Top navigation bar
- `Sidebar`: Left navigation menu

## 🔌 API Integration

The frontend connects to the backend API at `/api`. Key endpoints:

- `GET /api/stores` - List all stores
- `POST /api/stores` - Add new store
- `GET /api/stores/:id/products` - Get store products
- `GET /api/products/:id/price-history` - Get price history
- `GET /api/analytics/*` - Various analytics endpoints
- `GET /api/changelogs/*` - Changelog data

## 🧪 Testing

The project uses Vitest with React Testing Library for comprehensive testing:

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **Test Coverage**: 54+ passing tests
- **Test Files**: 12 test suites

```bash
# Run all tests
npm test

# View test results
✓ 12 test files passed
✓ 54 tests passed
```

## 🎯 Key Features

### Error Handling
- Graceful error states with retry functionality
- Toast notifications for user actions
- Fallback UI for loading and error states

### Responsive Design
- Mobile-first approach
- Responsive grid layouts
- Touch-friendly interactions
- Collapsible sidebar on mobile

### Performance
- React Query caching
- Automatic background refetching
- Optimistic updates
- Lazy loading

## 📝 Environment Variables

Create a `.env` file in the frontend directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3000/api
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related

- Backend API: `../src/`
- Documentation: `../docs/`

---

Built with ❤️ using React + TypeScript + Vite

