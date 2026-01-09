import React, { useMemo } from 'react';
import katex from 'katex';

/**
 * Renders text with LaTeX math expressions.
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 */
function MathText({ text, className = '' }) {
  const rendered = useMemo(() => {
    if (!text) return '';

    // Pattern to match LaTeX delimiters
    // $$...$$ (display), $...$ (inline), \[...\] (display), \(...\) (inline)
    const pattern = /(\$\$[\s\S]*?\$\$|\$[^\$\n]+?\$|\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g;

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: 'text',
          content: text.slice(lastIndex, match.index),
        });
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
      parts.push({
        type: 'text',
        content: text.slice(lastIndex),
      });
    }

    return parts;
  }, [text]);

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
