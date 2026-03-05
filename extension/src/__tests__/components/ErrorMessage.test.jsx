import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorMessage from '../../components/ErrorMessage';


describe('ErrorMessage', () => {
  it('renders error message', () => {
    render(<ErrorMessage message="Something went wrong" onDismiss={() => {}} />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorMessage message="Error" onDismiss={onDismiss} />);
    // Find the close button (last button with X svg)
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('shows upgrade button when onUpgrade provided', () => {
    const onUpgrade = vi.fn();
    render(<ErrorMessage message="Error" onDismiss={() => {}} onUpgrade={onUpgrade} />);
    const upgradeBtn = screen.getByText('Upgrade to Pro');
    expect(upgradeBtn).toBeInTheDocument();
    fireEvent.click(upgradeBtn);
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('shows details toggle when details provided (no onUpgrade)', () => {
    render(
      <ErrorMessage
        message="Error"
        details={{ code: 'TEST' }}
        onDismiss={() => {}}
      />
    );
    const toggle = screen.getByText('Show details');
    expect(toggle).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByText('Hide details')).toBeInTheDocument();
    // Details should be visible
    expect(screen.getByText(/"code": "TEST"/)).toBeInTheDocument();
  });

  it('does not show details toggle when onUpgrade is provided', () => {
    render(
      <ErrorMessage
        message="Error"
        details={{ code: 'TEST' }}
        onDismiss={() => {}}
        onUpgrade={() => {}}
      />
    );
    expect(screen.queryByText('Show details')).not.toBeInTheDocument();
    expect(screen.getByText('Upgrade to Pro')).toBeInTheDocument();
  });

  it('handles string details', () => {
    render(
      <ErrorMessage message="Error" details="String detail" onDismiss={() => {}} />
    );
    fireEvent.click(screen.getByText('Show details'));
    expect(screen.getByText('String detail')).toBeInTheDocument();
  });
});
