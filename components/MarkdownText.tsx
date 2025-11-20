import React from 'react';

interface MarkdownTextProps {
  content: string;
}

/**
 * A simple renderer to handle newlines, bolding (**text**), and bullet points
 * to avoid heavy dependencies like react-markdown for this specific demo.
 */
export const MarkdownText: React.FC<MarkdownTextProps> = ({ content }) => {
  if (!content) return null;

  // Split by newlines to handle paragraphs
  const lines = content.split('\n');

  return (
    <div className="text-gray-800 leading-relaxed space-y-2 text-sm md:text-base">
      {lines.map((line, index) => {
        // Handle headers (lines starting with #)
        if (line.startsWith('### ')) {
            return <h4 key={index} className="text-lg font-bold text-indigo-700 mt-4 mb-2">{line.replace('### ', '')}</h4>
        }
        if (line.startsWith('## ')) {
            return <h3 key={index} className="text-xl font-bold text-indigo-800 mt-5 mb-2">{line.replace('## ', '')}</h3>
        }
        if (line.startsWith('# ')) {
            return <h2 key={index} className="text-2xl font-bold text-indigo-900 mt-6 mb-3">{line.replace('# ', '')}</h2>
        }

        // Handle bullet points
        if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
             const cleanLine = line.trim().substring(2);
             return (
                <div key={index} className="flex items-start ml-4">
                    <span className="mr-2 text-indigo-500">•</span>
                    <p dangerouslySetInnerHTML={{ __html: formatBold(cleanLine) }} />
                </div>
             )
        }

        // Empty lines
        if (line.trim() === '') {
            return <div key={index} className="h-2"></div>;
        }

        // Regular paragraphs with bold parsing
        return (
          <p key={index} dangerouslySetInnerHTML={{ __html: formatBold(line) }} />
        );
      })}
    </div>
  );
};

// Helper to replace **text** with <b>text</b>
const formatBold = (text: string) => {
  // Escape HTML first to prevent XSS (basic)
  let safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Replace **bold**
  safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<b class="font-semibold text-gray-900">$1</b>');
  // Replace `code`
  safeText = safeText.replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-rose-600 font-mono text-sm">$1</code>');
  return safeText;
};