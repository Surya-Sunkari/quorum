import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MathText from '../../components/MathText';


describe('MathText', () => {
  it('renders plain text without LaTeX', () => {
    render(<MathText text="Hello World" />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders with className', () => {
    const { container } = render(<MathText text="test" className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles empty text', () => {
    const { container } = render(<MathText text="" />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it('handles null/undefined text', () => {
    const { container } = render(<MathText text={null} />);
    expect(container).toBeTruthy();
  });

  it('renders text with inline LaTeX delimiters', () => {
    const { container } = render(<MathText text="The answer is $x^2$" />);
    // KaTeX is mocked, so we check that the component renders without error
    expect(container.textContent).toContain('The answer is');
  });

  it('renders text with display LaTeX delimiters', () => {
    const { container } = render(<MathText text="Result: $$x = 5$$" />);
    expect(container).toBeTruthy();
  });

  it('handles multiple LaTeX segments', () => {
    const { container } = render(<MathText text="$a$ and $b$ are vars" />);
    expect(container.textContent).toContain('and');
  });
});
