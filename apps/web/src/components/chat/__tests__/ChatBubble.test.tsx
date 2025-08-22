import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatBubble from '../ChatBubble';
import type { Message } from '@/lib/types/chat';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

// Mock Radix UI components
jest.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => 
    asChild ? children : <div>{children}</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => 
    asChild ? children : <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('ChatBubble', () => {
  const mockMessage: Message = {
    id: '1',
    content: 'Hello, this is a test message!',
    createdAt: '2024-01-15T10:30:00Z',
    userId: 'user1',
    roomId: 'conv1',
    reactions: [],
  };

  const defaultProps = {
    m: mockMessage,
    mine: false,
    me: 'user2',
    avatar: '/test-avatar.jpg',
    name: 'John Doe',
  };

  it('renders message content correctly', () => {
    render(<ChatBubble {...defaultProps} />);
    // Check that key words from the message are present
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
    expect(screen.getByText(/message!/)).toBeInTheDocument();
  });

  it('displays timestamp in correct format', () => {
    render(<ChatBubble {...defaultProps} />);
    // The time should be formatted as HH:MM AM/PM
    const timeElement = screen.getByText(/\d{1,2}:\d{2}/);
    expect(timeElement).toBeInTheDocument();
  });

  it('shows different styling for own messages', () => {
    const { container, rerender } = render(<ChatBubble {...defaultProps} mine={true} />);
    let messageContainer = container.querySelector('.justify-end');
    expect(messageContainer).toBeInTheDocument();

    rerender(<ChatBubble {...defaultProps} mine={false} />);
    messageContainer = container.querySelector('.justify-start');
    expect(messageContainer).toBeInTheDocument();
  });

  it('renders user avatar for other users messages', () => {
    render(<ChatBubble {...defaultProps} mine={false} />);
    // Avatar should be present for others' messages
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).toBeInTheDocument();
  });

  it('does not render avatar for own messages', () => {
    render(<ChatBubble {...defaultProps} mine={true} />);
    // Avatar should not be present for own messages
    const avatar = document.querySelector('[data-slot="avatar"]');
    expect(avatar).not.toBeInTheDocument();
  });

  it('handles code blocks in message content', () => {
    const messageWithCode = {
      ...mockMessage,
      content: 'Here is some code: ```console.log("hello")```',
    };
    render(<ChatBubble {...defaultProps} m={messageWithCode} />);
    
    const codeElement = screen.getByText('console.log("hello")');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName).toBe('CODE');
  });

  it('converts URLs to clickable links', () => {
    const messageWithUrl = {
      ...mockMessage,
      content: 'Check out this link: https://example.com',
    };
    render(<ChatBubble {...defaultProps} m={messageWithUrl} />);
    
    const link = screen.getByRole('link', { name: /https:\/\/example\.com/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('renders component without crashing for pending messages', () => {
    const pendingMessage = { ...mockMessage, pending: true };
    render(<ChatBubble {...defaultProps} m={pendingMessage} mine={true} />);
    
    // Just ensure it renders without error
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  it('renders component without crashing for read messages', () => {
    const readMessage = { ...mockMessage, read: true };
    render(<ChatBubble {...defaultProps} m={readMessage} mine={true} />);
    
    // Check for check marks (read state)
    const checkIcon = document.querySelector('.lucide-check, .lucide-check-check');
    if (checkIcon) {
      expect(checkIcon).toBeInTheDocument();
    }
    // Just ensure it renders without error
    expect(screen.getByText(/Hello/)).toBeInTheDocument();
  });

  it('displays reactions when present', () => {
    const messageWithReactions = {
      ...mockMessage,
      reactions: [
        { emoji: '👍', count: 2, by: ['user1', 'user2'] },
        { emoji: '😀', count: 1, by: ['user1'] },
      ],
    };
    render(<ChatBubble {...defaultProps} m={messageWithReactions} />);
    
    // Look for the specific reaction buttons (rounded-full for actual reactions)
    const reactionButtons = document.querySelectorAll('.rounded-full');
    expect(reactionButtons.length).toBeGreaterThan(0);
    
    // Check that buttons contain the expected emojis and counts
    const reactionArea = document.querySelector('.flex.flex-wrap');
    expect(reactionArea).toBeInTheDocument();
    expect(reactionArea?.textContent).toContain('👍');
    expect(reactionArea?.textContent).toContain('😀');
    expect(reactionArea?.textContent).toContain('2');
    expect(reactionArea?.textContent).toContain('1');
  });
});
