import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingState from '../../components/LoadingState';


describe('LoadingState', () => {
  it('renders the loading message', () => {
    render(<LoadingState message="Running 3 agents..." />);
    expect(screen.getByText('Running 3 agents...')).toBeInTheDocument();
  });

  it('parses agent count from message', () => {
    const { container } = render(<LoadingState message="Running 5 agents..." />);
    // Should render 5 agent circles (labels 1-5)
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it('defaults to 3 agents when message has no number', () => {
    render(<LoadingState message="Processing..." />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('handles 1 agent', () => {
    render(<LoadingState message="Running 1 agent..." />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('2')).not.toBeInTheDocument();
  });

  it('shows footer hint text', () => {
    render(<LoadingState message="test" />);
    expect(screen.getByText('Agents are thinking independently...')).toBeInTheDocument();
  });
});
