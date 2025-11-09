# Shopify Monitor Frontend - High-Level Implementation Plan

## Overview
A web application to monitor Shopify store product prices with analytics and historical tracking.

---

## Tech Stack Recommendation

### Core
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS

### Data & State
- **API Client**: Axios
- **State Management**: React Query (for server state) + Context API (for UI state)

### Visualization
- **Charts**: Recharts or Chart.js
- **Date Picker**: react-datepicker

### UI Components
- **Component Library**: shadcn/ui or Ant Design
- **Icons**: Lucide React

---

## Project Structure

```
frontend/
├── src/
│   ├── pages/              # Page components
│   │   ├── StoresPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── DashboardPage.tsx
│   │   └── ChangelogPage.tsx
│   ├── components/         # Reusable components
│   │   ├── layout/
│   │   ├── stores/
│   │   ├── products/
│   │   ├── charts/
│   │   └── common/
│   ├── services/          # API integration
│   │   └── api.ts
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript types
│   ├── utils/             # Helper functions
│   └── App.tsx
├── public/                # Static assets
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## Pages & Routes

### 1. **Stores Page** (`/stores`)
- **Purpose**: Manage monitored stores
- **Features**:
  - List all stores with status
  - Add new store (form modal)
  - Click store → navigate to products

### 2. **Products Page** (`/stores/:storeId/products`)
- **Purpose**: View products from a specific store
- **Features**:
  - Product grid/list view
  - Display: image, name, current price, price change indicator
  - Click product → view price history

### 3. **Dashboard Page** (`/dashboard`)
- **Purpose**: Analytics and insights
- **Features**:
  - Date range picker (global)
  - Three chart sections:
    - Average price by Tag (line chart)
    - Average price by Store (line chart)
    - Average price by Store & Tag (line chart with filters)

### 4. **Changelog Page** (`/changelog`)
- **Purpose**: Historical price change logs
- **Features**:
  - Tabbed interface:
    - Products tab
    - Stores tab
    - Tags tab
  - Filters: date range, store, tag
  - Display: timeline/table of price changes

---

## Core Components

### Layout Components
- `MainLayout`: Sidebar navigation + content area
- `Navbar`: App header with title
- `Sidebar`: Navigation links

### Store Components
- `StoreList`: Grid of store cards
- `StoreCard`: Individual store display
- `AddStoreModal`: Form to add new store

### Product Components
- `ProductGrid`: Grid layout of products
- `ProductCard`: Product display with image and price
- `PriceChange`: Badge showing +/- price change
- `PriceHistoryModal`: Chart showing product price history

### Chart Components
- `LineChart`: Reusable time-series chart
- `DateRangePicker`: Date selection component
- `ChartFilters`: Dropdown filters for charts

### Changelog Components
- `ChangelogTable`: Table view of changes
- `ChangelogFilters`: Filter controls
- `PriceChangeRow`: Individual changelog entry

---

## API Integration Strategy

### Service Layer (`services/api.ts`)
Create typed API functions for each endpoint:

```typescript
// Stores
- getStores()
- addStore(data)

// Products
- getStoreProducts(storeId)

// Price History
- getProductPriceHistory(productId, params)

// Analytics
- getAveragePriceByStore(storeId, params)
- getAveragePriceByTag(tag, params)
- getAveragePriceByStoreAndTag(storeId, tag, params)

// Changelogs
- getProductChangelogs(params)
- getStoreChangelogs(params)
- getTagChangelogs(params)
- getStoreTagChangelogs(storeId, tag, params)
```

### React Query Hooks
Custom hooks for data fetching:
- `useStores()`
- `useStoreProducts(storeId)`
- `usePriceHistory(productId, dateRange)`
- `useAnalytics(type, filters)`
- `useChangelog(type, filters)`

---

## Key Features Implementation

### 1. Add Store Flow
1. User clicks "Add Store" button
2. Modal opens with form (name, URL, polling interval)
3. Submit → POST /stores
4. Success → refresh store list
5. Navigate to new store's products

### 2. Product Price Display
- Show current price prominently
- Calculate change: `current - previous`
- Display with color coding:
  - Green (decrease): good for buyer
  - Red (increase): price went up
  - Gray (no change): same price

### 3. Dashboard Analytics
- Single date range picker affects all charts
- Default: last 30 days
- Window hours: user selectable (1h, 24h, 168h)
- Charts update in real-time when filters change

### 4. Changelog View
- Default sort: most recent first
- Pagination for large datasets
- Export option (CSV) - future enhancement
- Visual diff: old price → new price with arrow

---

## State Management

### Server State (React Query)
- All API data
- Automatic caching
- Background refetching
- Loading/error states

### UI State (Context)
- Date range selection
- Active filters
- Selected store/tag
- Modal open/close states

---

## User Experience Enhancements

### Loading States
- Skeleton loaders for cards/tables
- Spinner for charts
- Optimistic updates for add store

### Error Handling
- Toast notifications for errors
- Retry buttons for failed requests
- Fallback UI for empty states

### Responsive Design
- Mobile-first approach
- Collapsible sidebar on mobile
- Responsive charts
- Touch-friendly product cards

---

## Development Phases

### Phase 1: Setup & Core Layout (Day 1)
- Initialize React + TypeScript project
- Install dependencies (including Vitest + React Testing Library)
- Create routing structure
- Build main layout components
- **Unit Tests**:
  - `MainLayout.test.tsx` - renders correctly, navigation links work
  - `Navbar.test.tsx` - displays title
  - `Sidebar.test.tsx` - renders navigation items, active state

### Phase 2: Stores & Products (Day 2-3)
- Implement stores page
- Add store functionality
- Build products page
- Product card with price display
- **Unit Tests**:
  - `StoreCard.test.tsx` - displays store info, handles click
  - `AddStoreModal.test.tsx` - form validation, submit behavior
  - `ProductCard.test.tsx` - displays product data, image fallback
  - `PriceChange.test.tsx` - color coding logic (green/red/gray)
  - `api.test.ts` - mock API calls for stores/products

### Phase 3: Dashboard Analytics (Day 4-5)
- Chart components
- Date range picker
- API integration for analytics
- Three chart views
- **Unit Tests**:
  - `LineChart.test.tsx` - renders with data, handles empty state
  - `DateRangePicker.test.tsx` - date selection, validation
  - `ChartFilters.test.tsx` - filter changes emit correct values
  - `useAnalytics.test.ts` - hook returns correct data format

### Phase 4: Changelog & Polish (Day 6-7)
- Changelog page implementation
- Price history modals
- Error handling
- Responsive design tweaks
- **Unit Tests**:
  - `ChangelogTable.test.tsx` - displays data, pagination
  - `ChangelogFilters.test.tsx` - filter combinations work
  - `PriceHistoryModal.test.tsx` - displays chart, handles loading
  - `ErrorBoundary.test.tsx` - catches errors, displays fallback

---

## Testing Strategy

### Test Setup
- **Framework**: Vitest (fast, Vite-native)
- **Testing Library**: React Testing Library
- **Mocking**: MSW (Mock Service Worker) for API
- **Coverage Goal**: 80%+ for critical paths

### Test Types

#### Unit Tests
- Component rendering
- User interactions (click, input)
- Conditional logic
- Props handling
- Custom hooks

#### Integration Tests
- API calls with mocked responses
- React Query cache behavior
- Form submission flows
- Multi-component interactions

#### E2E Tests (Future)
- Full user flows
- Cross-page navigation
- Critical business logic

### Running Tests
```bash
npm run test          # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```
