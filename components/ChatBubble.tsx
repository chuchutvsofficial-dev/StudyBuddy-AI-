import React from 'react';
import { Message, Role } from '../types';
import { MarkdownText } from './MarkdownText';

interface ChatBubbleProps {
  message: Message;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6 animate-fade-in-up`}>
      <div
        className={`
          max-w-[85%] md:max-w-[75%] lg:max-w-[60%]
          rounded-2xl p-4 shadow-sm
          ${isUser 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none shadow-md'
          }
        `}
      >
        {/* Header for Bot */}
        {!isUser && (
          <div className="flex items-center mb-2 border-b border-gray-100 pb-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center mr-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wide">StudyBuddy AI</span>
          </div>
        )}

        {/* Image Display */}
        {message.image && (
          <div className="mb-3">
            <img 
              src={`data:image/jpeg;base64,${message.image}`} 
              alt="Homework Context" 
              className="rounded-lg max-h-60 object-contain bg-black/10 border border-white/20"
            />
          </div>
        )}

        {/* Text Content */}
        <div className={isUser ? 'text-white whitespace-pre-wrap' : ''}>
          {isUser ? (
            message.text
          ) : (
            <MarkdownText content={message.text} />
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-[10px] mt-2 text-right ${isUser ? 'text-indigo-200' : 'text-gray-400'}`}>
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};