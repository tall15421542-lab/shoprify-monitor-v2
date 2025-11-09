import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Navbar from './Navbar';

describe('Navbar', () => {
  it('displays the title', () => {
    render(<Navbar />);
    
    const title = screen.getByText('Shopify Monitor');
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H1');
  });

  it('renders the store icon', () => {
    const { container } = render(<Navbar />);
    
    // Check for SVG icon (Lucide icons are SVGs)
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('has proper navigation styling', () => {
    const { container } = render(<Navbar />);
    
    const nav = container.querySelector('nav');
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass('bg-white');
  });
});

