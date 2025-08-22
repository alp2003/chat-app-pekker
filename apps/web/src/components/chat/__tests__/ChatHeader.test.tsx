import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatHeader from '../ChatHeader';

// Mock the Radix UI components to avoid issues with portals in tests
jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({
    children,
    asChild,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => (asChild ? children : <div>{children}</div>),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('ChatHeader', () => {
  const defaultProps = {
    name: 'John Doe',
    online: true,
    avatar: '/test-avatar.jpg',
  };

  it('renders user name correctly', () => {
    render(<ChatHeader {...defaultProps} />);
    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('shows online status when user is online', () => {
    render(<ChatHeader {...defaultProps} online={true} />);
    expect(screen.getByText('online')).toBeInTheDocument();
  });

  it('shows offline status when user is offline', () => {
    render(<ChatHeader {...defaultProps} online={false} />);
    expect(screen.getByText('last seen recently')).toBeInTheDocument();
  });

  it('displays avatar fallback when no avatar provided', () => {
    render(<ChatHeader {...defaultProps} avatar={null} />);
    // Avatar fallback should show first 2 letters of name
    expect(screen.getByText('JO')).toBeInTheDocument();
  });

  it('renders action buttons (phone, video, info)', async () => {
    const user = userEvent.setup();
    render(<ChatHeader {...defaultProps} />);

    // Check if all buttons are present
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3); // phone, video, info buttons
  });

  it('renders rightSlot content when provided', () => {
    const rightSlotContent = <button data-testid="logout-btn">Logout</button>;
    render(<ChatHeader {...defaultProps} rightSlot={rightSlotContent} />);

    expect(screen.getByTestId('logout-btn')).toBeInTheDocument();
  });

  it('applies correct online indicator styling', () => {
    const { rerender } = render(<ChatHeader {...defaultProps} online={true} />);

    // Check online indicator has correct classes
    const onlineIndicator = document.querySelector('.bg-emerald-500');
    expect(onlineIndicator).toBeInTheDocument();

    rerender(<ChatHeader {...defaultProps} online={false} />);

    // Check offline indicator has correct classes
    const offlineIndicator = document.querySelector('.bg-zinc-400');
    expect(offlineIndicator).toBeInTheDocument();
  });
});
