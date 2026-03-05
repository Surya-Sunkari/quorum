import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Header from '../../components/Header';


const defaultProps = {
  onSettingsClick: vi.fn(),
  onSidebarClick: vi.fn(),
  onSignOut: vi.fn(),
  onUpgrade: vi.fn(),
  auth: { token: 'jwt', user: { id: 'u1', email: 'test@example.com', tier: 'free' } },
};


describe('Header', () => {
  it('renders logo text', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('Quo')).toBeInTheDocument();
    expect(screen.getByText('rum')).toBeInTheDocument();
  });

  it('shows upgrade button for free tier', () => {
    render(<Header {...defaultProps} />);
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('shows upgrade button for standard tier', () => {
    const auth = { ...defaultProps.auth, user: { ...defaultProps.auth.user, tier: 'standard' } };
    render(<Header {...defaultProps} auth={auth} />);
    expect(screen.getByText('Upgrade')).toBeInTheDocument();
  });

  it('hides upgrade button for pro tier', () => {
    const auth = { ...defaultProps.auth, user: { ...defaultProps.auth.user, tier: 'pro' } };
    render(<Header {...defaultProps} auth={auth} />);
    expect(screen.queryByText('Upgrade')).not.toBeInTheDocument();
  });

  it('calls onUpgrade when upgrade button clicked', () => {
    const onUpgrade = vi.fn();
    render(<Header {...defaultProps} onUpgrade={onUpgrade} />);
    fireEvent.click(screen.getByText('Upgrade'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('opens and closes user menu', () => {
    render(<Header {...defaultProps} />);
    // Click avatar button (shows first letter of email)
    const avatar = screen.getByText('T');
    fireEvent.click(avatar);
    // Menu should appear with email
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Free tier')).toBeInTheDocument();
  });

  it('calls onSignOut from menu', () => {
    const onSignOut = vi.fn();
    render(<Header {...defaultProps} onSignOut={onSignOut} />);
    // Open menu
    fireEvent.click(screen.getByText('T'));
    // Click sign out
    fireEvent.click(screen.getByText('Sign out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  it('calls onSettingsClick', () => {
    const onSettingsClick = vi.fn();
    render(<Header {...defaultProps} onSettingsClick={onSettingsClick} />);
    fireEvent.click(screen.getByTitle('Settings'));
    expect(onSettingsClick).toHaveBeenCalledTimes(1);
  });

  it('calls onSidebarClick', () => {
    const onSidebarClick = vi.fn();
    render(<Header {...defaultProps} onSidebarClick={onSidebarClick} />);
    fireEvent.click(screen.getByTitle('Open in sidebar'));
    expect(onSidebarClick).toHaveBeenCalledTimes(1);
  });

  it('shows Pro badge in menu for pro user', () => {
    const auth = { ...defaultProps.auth, user: { ...defaultProps.auth.user, tier: 'pro' } };
    render(<Header {...defaultProps} auth={auth} />);
    fireEvent.click(screen.getByText('T'));
    expect(screen.getByText('Pro')).toBeInTheDocument();
  });
});
