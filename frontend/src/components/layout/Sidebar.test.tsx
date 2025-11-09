import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('Stores')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Changelog')).toBeInTheDocument();
  });

  it('renders navigation links with correct paths', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    const storesLink = screen.getByText('Stores').closest('a');
    const dashboardLink = screen.getByText('Dashboard').closest('a');
    const changelogLink = screen.getByText('Changelog').closest('a');

    expect(storesLink).toHaveAttribute('href', '/stores');
    expect(dashboardLink).toHaveAttribute('href', '/dashboard');
    expect(changelogLink).toHaveAttribute('href', '/changelog');
  });

  it('applies active state to current route', () => {
    render(
      <MemoryRouter initialEntries={['/stores']}>
        <Sidebar />
      </MemoryRouter>
    );

    const storesLink = screen.getByText('Stores').closest('a');
    expect(storesLink).toHaveClass('bg-primary-50');
    expect(storesLink).toHaveClass('text-primary-700');
  });

  it('renders icons for each navigation item', () => {
    const { container } = render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    // Should have 3 SVG icons (one for each nav item)
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(3);
  });
});

