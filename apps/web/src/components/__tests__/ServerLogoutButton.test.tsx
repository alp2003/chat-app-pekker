import { render, screen } from '@testing-library/react';
import { ServerLogoutBtn } from '../ServerLogoutButton';

// Mock Next.js functions
jest.mock('next/navigation', () => ({
  redirect: jest.fn(),
}));

jest.mock('@/app/(auth)/logout/actions', () => ({
  logoutAction: jest.fn().mockResolvedValue({ ok: true }),
}));

describe('ServerLogoutButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders logout button with correct text', () => {
    render(<ServerLogoutBtn />);
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });

  it('renders as a form with submit button', () => {
    render(<ServerLogoutBtn />);
    const form = screen.getByRole('button').closest('form');
    const button = screen.getByRole('button');
    
    expect(form).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'submit');
  });

  it('has correct styling classes', () => {
    render(<ServerLogoutBtn />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveClass('w-full justify-start');
  });

  it('should include proper form action attribute', () => {
    render(<ServerLogoutBtn />);
    const form = screen.getByRole('button').closest('form');
    
    // The form should have an action pointing to our server action
    expect(form).toHaveAttribute('action');
  });
});
