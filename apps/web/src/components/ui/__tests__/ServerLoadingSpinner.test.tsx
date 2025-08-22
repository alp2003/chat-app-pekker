import { render, screen } from '@testing-library/react';
import { ServerLoadingSpinner } from '../ServerLoadingSpinner';

describe('ServerLoadingSpinner', () => {
  it('renders with default medium size', () => {
    render(<ServerLoadingSpinner />);
    const spinner = document.querySelector('.h-8.w-8');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with small size when specified', () => {
    render(<ServerLoadingSpinner size="sm" />);
    const spinner = document.querySelector('.h-4.w-4');
    expect(spinner).toBeInTheDocument();
  });

  it('renders with large size when specified', () => {
    render(<ServerLoadingSpinner size="lg" />);
    const spinner = document.querySelector('.h-12.w-12');
    expect(spinner).toBeInTheDocument();
  });

  it('renders children when provided', () => {
    render(
      <ServerLoadingSpinner>
        <p>Loading...</p>
      </ServerLoadingSpinner>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('applies custom className when provided', () => {
    render(<ServerLoadingSpinner className="custom-class" />);
    const container = document.querySelector('.custom-class');
    expect(container).toBeInTheDocument();
  });

  it('has spinning animation class', () => {
    render(<ServerLoadingSpinner />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
