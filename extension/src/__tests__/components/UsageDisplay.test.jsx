import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UsageDisplay from '../../components/UsageDisplay';


describe('UsageDisplay', () => {
  it('renders count and limit', () => {
    render(<UsageDisplay count={5} limit={20} tier="free" />);
    expect(screen.getByText('5 / 20 uses this month')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('returns null when limit is undefined', () => {
    const { container } = render(<UsageDisplay count={5} limit={undefined} tier="free" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when limit is null', () => {
    const { container } = render(<UsageDisplay count={5} limit={null} tier="free" />);
    expect(container.firstChild).toBeNull();
  });

  it('shows "Monthly limit reached" at limit', () => {
    render(<UsageDisplay count={20} limit={20} tier="free" />);
    expect(screen.getByText('Monthly limit reached')).toBeInTheDocument();
  });

  it('clamps percentage to 100%', () => {
    render(<UsageDisplay count={25} limit={20} tier="free" />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('shows amber color near limit (>=80%)', () => {
    render(<UsageDisplay count={16} limit={20} tier="free" />);
    expect(screen.getByText('80%')).toHaveClass('text-amber-500');
  });
});
