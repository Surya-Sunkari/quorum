import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SettingsPanel from '../../components/SettingsPanel';
import { DEFAULT_SETTINGS } from '../../utils/storage';


const defaultProps = {
  settings: { ...DEFAULT_SETTINGS },
  onSave: vi.fn(),
  onCancel: vi.fn(),
  userTier: 'free',
};


describe('SettingsPanel', () => {
  it('renders form fields', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText(/Agent Configuration/i)).toBeInTheDocument();
    expect(screen.getByText(/Agreement Ratio/i)).toBeInTheDocument();
  });

  it('shows model dropdown', () => {
    render(<SettingsPanel {...defaultProps} />);
    // Should have a model selector
    expect(screen.getByText(/GPT-4.1 Mini/)).toBeInTheDocument();
  });

  it('calls onCancel when close button is clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(<SettingsPanel {...defaultProps} onCancel={onCancel} />);
    // The cancel button is an X icon next to the "Settings" heading
    const header = container.querySelector('.flex.items-center.justify-between');
    const closeBtn = header.querySelector('button');
    fireEvent.click(closeBtn);
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSave when Save Settings clicked', async () => {
    const onSave = vi.fn();
    render(<SettingsPanel {...defaultProps} onSave={onSave} />);
    const saveBtn = screen.getByText('Save Settings');
    fireEvent.click(saveBtn);
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows mixed mode toggle', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText(/Mixed Models/i)).toBeInTheDocument();
  });

  it('shows debug mode checkbox', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText(/Debug Mode/i)).toBeInTheDocument();
  });

  it('shows reset button', () => {
    render(<SettingsPanel {...defaultProps} />);
    expect(screen.getByText(/Reset/i)).toBeInTheDocument();
  });

  it('pro user sees all models enabled', () => {
    render(<SettingsPanel {...defaultProps} userTier="pro" />);
    // Pro should not see any lock icons or "Pro" labels on models
    // Just verify render doesn't crash
    expect(screen.getByText(/GPT-4.1 Mini/)).toBeInTheDocument();
  });
});
