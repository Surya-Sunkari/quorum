import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QuestionInput from '../../components/QuestionInput';


const defaultProps = {
  value: '',
  onChange: vi.fn(),
  image: null,
  onImageChange: vi.fn(),
  onSubmit: vi.fn(),
  onKeyDown: vi.fn(),
  disabled: false,
};


describe('QuestionInput', () => {
  it('renders textarea', () => {
    render(<QuestionInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/question/i)).toBeInTheDocument();
  });

  it('shows current value', () => {
    render(<QuestionInput {...defaultProps} value="Hello" />);
    expect(screen.getByDisplayValue('Hello')).toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<QuestionInput {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText(/question/i), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders Ask button', () => {
    render(<QuestionInput {...defaultProps} />);
    expect(screen.getByText('Ask')).toBeInTheDocument();
  });

  it('disables Ask button when empty and no image', () => {
    render(<QuestionInput {...defaultProps} value="" image={null} />);
    expect(screen.getByText('Ask')).toBeDisabled();
  });

  it('enables Ask button when question has text', () => {
    render(<QuestionInput {...defaultProps} value="question" />);
    expect(screen.getByText('Ask')).not.toBeDisabled();
  });

  it('enables Ask button when image is present', () => {
    render(<QuestionInput {...defaultProps} image="data:image/png;base64,abc" />);
    expect(screen.getByText('Ask')).not.toBeDisabled();
  });

  it('shows image preview when image is set', () => {
    render(<QuestionInput {...defaultProps} image="data:image/png;base64,abc" />);
    expect(screen.getByRole('img')).toBeInTheDocument();
  });

  it('calls onSubmit when Ask clicked', () => {
    const onSubmit = vi.fn();
    render(<QuestionInput {...defaultProps} value="test" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByText('Ask'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('shows "Asking..." when disabled', () => {
    render(<QuestionInput {...defaultProps} value="test" disabled={true} />);
    expect(screen.getByText('Asking...')).toBeInTheDocument();
  });

  it('calls onKeyDown on key press', () => {
    const onKeyDown = vi.fn();
    render(<QuestionInput {...defaultProps} onKeyDown={onKeyDown} />);
    fireEvent.keyDown(screen.getByPlaceholderText(/question/i), { key: 'Enter', ctrlKey: true });
    expect(onKeyDown).toHaveBeenCalled();
  });
});
