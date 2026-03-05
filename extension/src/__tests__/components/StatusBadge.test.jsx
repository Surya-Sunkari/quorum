import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../../components/StatusBadge';


describe('StatusBadge', () => {
  it('renders "Consensus Reached" for consensus status', () => {
    render(<StatusBadge status="consensus_reached" ratio={0.67} threshold={0.67} />);
    expect(screen.getByText('Consensus Reached')).toBeInTheDocument();
  });

  it('renders "Best Effort" for best_effort status', () => {
    render(<StatusBadge status="best_effort" ratio={0.33} threshold={0.67} />);
    expect(screen.getByText('Best Effort')).toBeInTheDocument();
  });

  it('renders "Processing" for unknown status', () => {
    render(<StatusBadge status="unknown" ratio={0} threshold={0.5} />);
    expect(screen.getByText('Processing')).toBeInTheDocument();
  });

  it('shows ratio and threshold percentages', () => {
    render(<StatusBadge status="consensus_reached" ratio={0.67} threshold={0.67} />);
    expect(screen.getByText(/67% agreed/)).toBeInTheDocument();
    expect(screen.getByText(/threshold: 67%/)).toBeInTheDocument();
  });

  it('rounds ratio percentage', () => {
    render(<StatusBadge status="consensus_reached" ratio={0.666} threshold={0.5} />);
    expect(screen.getByText(/67% agreed/)).toBeInTheDocument();
  });
});
