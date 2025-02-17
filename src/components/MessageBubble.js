import React from 'react';
import './MessageBubble.css'; // Create CSS next

function MessageBubble({ sender, text, isStreaming }) {
    // sender will be "user" or AI service name (e.g., "openai", "gemini")
    const isUserMessage = sender === 'user';
    const messageClass = isUserMessage ? 'user-message' : 'ai-message';

    return (
        <div className={`message-bubble ${messageClass}`}>
            <div className="message-sender">{sender}:</div>
            <div className="message-text">
                {text}
                {isStreaming && <span className="typing-indicator">▊</span>}
            </div>
        </div>
    );
}

export default MessageBubble;