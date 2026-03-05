import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnswerCard from '../../components/AnswerCard';


const defaultResult = {
  status: 'consensus_reached',
  answer: 'The answer is 42',
  agreement_ratio_achieved: 1.0,
  agreement_threshold: 0.67,
  winning_cluster_size: 3,
  n_agents: 3,
  rounds_used: 1,
  confidence: 0.9,
  disagreement_summary: '',
  agent_outputs: [],
};


describe('AnswerCard', () => {
  it('renders the answer text', () => {
    render(<AnswerCard result={defaultResult} showDetails={false} />);
    expect(screen.getByText(/The answer is 42/)).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<AnswerCard result={defaultResult} showDetails={false} />);
    expect(screen.getByText('Consensus Reached')).toBeInTheDocument();
  });

  it('shows meta info', () => {
    const { container } = render(<AnswerCard result={defaultResult} showDetails={false} />);
    // Text is split across child elements, so use textContent
    const metaSection = container.querySelector('.bg-gray-50.border-t');
    expect(metaSection.textContent).toContain('3');
    expect(metaSection.textContent).toContain('agents agreed');
    expect(metaSection.textContent).toContain('round');
    expect(metaSection.textContent).toContain('90%');
  });

  it('shows "rounds" plural for multiple rounds', () => {
    const result = { ...defaultResult, rounds_used: 2 };
    const { container } = render(<AnswerCard result={result} showDetails={false} />);
    const metaSection = container.querySelector('.bg-gray-50.border-t');
    expect(metaSection.textContent).toContain('rounds');
  });

  it('does not show confidence when 0', () => {
    const result = { ...defaultResult, confidence: 0 };
    render(<AnswerCard result={result} showDetails={false} />);
    expect(screen.queryByText(/0% confidence/)).not.toBeInTheDocument();
  });

  it('shows details section when showDetails=true and has agent_outputs', () => {
    const result = {
      ...defaultResult,
      agent_outputs: [
        { agent_id: 0, answer: 'A1', confidence: 0.9, assumptions: [], short_rationale: 'reason', model: 'openai:gpt-4.1-mini' },
      ],
    };
    render(<AnswerCard result={result} showDetails={true} />);
    // Should have a details toggle
    const toggle = screen.getByText(/Details/i);
    expect(toggle).toBeInTheDocument();
  });

  it('does not show details when showDetails=false', () => {
    const result = {
      ...defaultResult,
      agent_outputs: [
        { agent_id: 0, answer: 'A1', confidence: 0.9, assumptions: [], short_rationale: 'reason', model: 'openai:gpt-4.1-mini' },
      ],
    };
    render(<AnswerCard result={result} showDetails={false} />);
    expect(screen.queryByText(/Agent 1/)).not.toBeInTheDocument();
  });

  it('renders best effort status', () => {
    const result = { ...defaultResult, status: 'best_effort' };
    render(<AnswerCard result={result} showDetails={false} />);
    expect(screen.getByText('Best Effort')).toBeInTheDocument();
  });
});
