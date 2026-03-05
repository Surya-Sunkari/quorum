import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LoginScreen from '../../components/LoginScreen';

// Mock the auth module
vi.mock('../../utils/auth', () => ({
  signInWithGoogle: vi.fn(),
}));

import { signInWithGoogle } from '../../utils/auth';


describe('LoginScreen', () => {
  it('renders sign-in button', () => {
    render(<LoginScreen onSuccess={() => {}} />);
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
  });

  it('shows free tier info', () => {
    render(<LoginScreen onSuccess={() => {}} />);
    expect(screen.getByText(/20 uses\/month/)).toBeInTheDocument();
  });

  it('calls onSuccess on successful sign-in', async () => {
    const onSuccess = vi.fn();
    const authData = { token: 'jwt', user: { id: 'u1', email: 'a@b.com', tier: 'free' } };
    signInWithGoogle.mockResolvedValue(authData);

    render(<LoginScreen onSuccess={onSuccess} />);
    fireEvent.click(screen.getByText('Sign in with Google'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith(authData);
    });
  });

  it('shows error on sign-in failure', async () => {
    signInWithGoogle.mockRejectedValue(new Error('Network error'));

    render(<LoginScreen onSuccess={() => {}} />);
    fireEvent.click(screen.getByText('Sign in with Google'));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });

  it('shows loading state during sign-in', async () => {
    let resolveSignIn;
    signInWithGoogle.mockReturnValue(new Promise(resolve => {
      resolveSignIn = resolve;
    }));

    render(<LoginScreen onSuccess={() => {}} />);
    fireEvent.click(screen.getByText('Sign in with Google'));

    // Should show loading text
    expect(screen.getByText('Signing in…')).toBeInTheDocument();

    // Resolve to clean up
    resolveSignIn({ token: 'jwt', user: {} });
    await waitFor(() => {});
  });

  it('disables button during loading', async () => {
    signInWithGoogle.mockReturnValue(new Promise(() => {})); // Never resolves

    render(<LoginScreen onSuccess={() => {}} />);
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(button).toBeDisabled();
  });
});
