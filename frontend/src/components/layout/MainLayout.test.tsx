import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './MainLayout';

describe('MainLayout', () => {
  it('renders correctly', () => {
    render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<div>Test Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    // Should render the navbar with app title
    expect(screen.getByText('Shopify Monitor')).toBeInTheDocument();
    
    // Should render the sidebar navigation
    expect(screen.getByText('Stores')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Changelog')).toBeInTheDocument();
    
    // Should render the outlet content
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('has proper layout structure', () => {
    const { container } = render(
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<div>Test</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );

    // Should have main container
    const main = container.querySelector('main');
    expect(main).toBeInTheDocument();
    
    // Should have aside for sidebar
    const aside = container.querySelector('aside');
    expect(aside).toBeInTheDocument();
    
    // Should have nav for navbar
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
  });
});

