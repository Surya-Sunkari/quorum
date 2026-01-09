import React, { useMemo } from 'react';
import katex from 'katex';

// Common LaTeX commands that indicate math content
const LATEX_COMMANDS = /\\(frac|sqrt|sum|prod|int|lim|infty|alpha|beta|gamma|delta|theta|pi|sigma|omega|left|right|cdot|times|div|pm|leq|geq|neq|approx|equiv|subset|supset|cup|cap|in|notin|forall|exists|partial|nabla|vec|hat|bar|dot|ddot|text|mathrm|mathbf|mathit|binom|choose)/;

/**
 * Renders text with LaTeX math expressions.
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 * - Raw LaTeX (auto-detected by common commands)
 */
function MathText({ text, className = '' }) {
  const rendered = useMemo(() => {
    if (!text) return '';

    // Pattern to match LaTeX delimiters
    // $$...$$ (display), $...$ (inline), \[...\] (display), \(...\) (inline)
    const pattern = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

    // Check if text has delimited LaTeX
    const hasDelimitedLatex = pattern.test(text);
    pattern.lastIndex = 0; // Reset regex state

    // If no delimiters but contains LaTeX commands, try to render segments
    if (!hasDelimitedLatex && LATEX_COMMANDS.test(text)) {
      return parseRawLatex(text);
    }

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        // Check if the text segment contains raw LaTeX
        if (LATEX_COMMANDS.test(textBefore)) {
          parts.push(...parseRawLatex(textBefore));
        } else {
          parts.push({
            type: 'text',
            content: textBefore,
          });
        }
      }

      const mathStr = match[0];
      let latex = '';
      let displayMode = false;

      // Determine the type and extract LaTeX content
      if (mathStr.startsWith('$$') && mathStr.endsWith('$$')) {
        latex = mathStr.slice(2, -2);
        displayMode = true;
      } else if (mathStr.startsWith('$') && mathStr.endsWith('$')) {
        latex = mathStr.slice(1, -1);
        displayMode = false;
      } else if (mathStr.startsWith('\\[') && mathStr.endsWith('\\]')) {
        latex = mathStr.slice(2, -2);
        displayMode = true;
      } else if (mathStr.startsWith('\\(') && mathStr.endsWith('\\)')) {
        latex = mathStr.slice(2, -2);
        displayMode = false;
      }

      parts.push({
        type: 'math',
        content: latex,
        displayMode,
        original: mathStr,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      const remaining = text.slice(lastIndex);
      if (LATEX_COMMANDS.test(remaining)) {
        parts.push(...parseRawLatex(remaining));
      } else {
        parts.push({
          type: 'text',
          content: remaining,
        });
      }
    }

    return parts;
  }, [text]);

  // Parse text that contains raw LaTeX (without delimiters)
  function parseRawLatex(text) {
    const parts = [];
    // Split by newlines to handle multi-line content
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i > 0) {
        parts.push({ type: 'text', content: '\n' });
      }

      if (LATEX_COMMANDS.test(line)) {
        // Try to identify math segments vs regular text
        // Look for patterns like (a) or (b) followed by LaTeX
        const labelPattern = /^(\([a-z]\)\s*)/i;
        const labelMatch = line.match(labelPattern);

        if (labelMatch) {
          parts.push({ type: 'text', content: labelMatch[1] });
          const mathPart = line.slice(labelMatch[1].length).trim();
          if (mathPart) {
            parts.push({
              type: 'math',
              content: mathPart,
              displayMode: false,
              original: mathPart,
            });
          }
        } else {
          // Entire line might be math
          parts.push({
            type: 'math',
            content: line.trim(),
            displayMode: false,
            original: line,
          });
        }
      } else {
        parts.push({ type: 'text', content: line });
      }
    }

    return parts;
  }

  // If no LaTeX found, just return the text
  if (typeof rendered === 'string' || rendered.length === 0) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={className}>
      {rendered.map((part, index) => {
        if (part.type === 'text') {
          return <span key={index}>{part.content}</span>;
        }

        // Render math
        try {
          const html = katex.renderToString(part.content, {
            displayMode: part.displayMode,
            throwOnError: false,
            strict: false,
          });

          if (part.displayMode) {
            return (
              <span
                key={index}
                className="block my-2 text-center overflow-x-auto"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            );
          }

          return (
            <span
              key={index}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch (e) {
          // If KaTeX fails, show original text
          return <span key={index}>{part.original}</span>;
        }
      })}
    </span>
  );
}

export default MathText;
