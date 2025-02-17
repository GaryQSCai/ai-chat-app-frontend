import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ChatInterface.css';
import { sendChatMessage, fetchSessionHistory as fetchSessionsFromApi, deleteSession } from '../services/api';
import ReactMarkdown from 'react-markdown'; 
import ThemeToggle from './ThemeToggle';
import authService from '../services/authService';
import { useNavigate } from 'react-router-dom';

const API_BASE_URL = 'http://localhost:8000';

// First, create SVG components for each service with the same paths as the CSS
const OpenAIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18.5 12a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const GeminiIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 1.5L9.5 9.5L1.5 12L9.5 14.5L12 22.5L14.5 14.5L22.5 12L14.5 9.5L12 1.5Z" 
          fill="currentColor" 
          stroke="currentColor" 
          strokeWidth="1.5" 
          strokeLinejoin="round"/>
  </svg>
);

const KimiIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Main oval face */}
    <ellipse 
      cx="12" 
      cy="12" 
      rx="10" 
      ry="8" 
      fill="currentColor"
    />
    {/* Left eye */}
    <ellipse 
      cx="8" 
      cy="12" 
      rx="2" 
      ry="2.5" 
      fill="white"
      filter="url(#glow)"
    />
    {/* Right eye */}
    <ellipse 
      cx="16" 
      cy="12" 
      rx="2" 
      ry="2.5" 
      fill="white"
      filter="url(#glow)"
    />
    {/* Add glow effect */}
    <defs>
      <filter id="glow" x="-2" y="-2" width="28" height="28">
        <feGaussianBlur stdDeviation="1" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
    </defs>
  </svg>
);

// Add Doubao icon component
const DoubaoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Face shape - orange circle */}
    <circle cx="12" cy="12" r="10" fill="currentColor"/>
    {/* Eyes - simple dots */}
    <circle cx="8" cy="12" r="1" fill="white"/>
    <circle cx="16" cy="12" r="1" fill="white"/>
  </svg>
);

// Update the serviceIcons mapping to use these SVG components
const serviceIcons = {
    openai: <OpenAIIcon />,
    gemini: <GeminiIcon />,
    kimi: <KimiIcon />,
    doubao: <DoubaoIcon />,
    default: <GeminiIcon /> // Using Gemini icon as default
};

// Add this new component for the welcome message
const WelcomeMessage = ({ username }) => (
    <div className="welcome-message">
        <span className="welcome-text">Hello, <span className="username-text">{username}</span></span>
    </div>
);

function ChatInterface() {
    const serviceOptions = [
        { value: 'gemini', label: 'Gemini' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'kimi', label: 'Kimi' },
        { value: 'doubao', label: 'Doubao' },
    ];
    
    const initialSessionCount = 5;
    
    const [messages, setMessages] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [selectedService, setSelectedService] = useState('gemini');
    const [sessionId, setSessionId] = useState(null);
    const [sessionHistory, setSessionHistory] = useState([]); 
    const messageAreaRef = useRef(null);
    const [isSessionListExpanded, setIsSessionListExpanded] = useState(false);
    const [contextMenuSessionId, setContextMenuSessionId] = useState(null); 
    const [sessionBeingRenamedId, setSessionBeingRenamedId] = useState(null);
    const [renameInputValue, setRenameInputValue] = useState('');
    const renameInputRef = useRef(null); 

    const [isDarkTheme, setIsDarkTheme] = useState(false);
    const [isSidebarVisible, setIsSidebarVisible] = useState(false);

    const navigate = useNavigate();

    // Add username state
    const [username, setUsername] = useState('');
    
    // Add this effect to load username when component mounts
    useEffect(() => {
        const currentUsername = authService.getCurrentUsername();
        console.log('Current username:', currentUsername);
        setUsername(currentUsername);
    }, []);

    useEffect(() => {
        if (!authService.isAuthenticated()) {
            navigate('/login');
        }
    }, [navigate]);

    useEffect(() => {
        document.title = 'Personal AI Chat';
    }, []);

    const handleRenameSession = (sessionIdToRename) => {
        console.log("Rename action initiated for session ID:", sessionIdToRename);
        setSessionBeingRenamedId(sessionIdToRename);
        closeContextMenu();
    };
    
    const handleRenameSessionSubmit = async (sessionIdToRename, newTitle) => {
        try {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionIdToRename}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authService.getToken()}`
                },
                body: JSON.stringify({ new_title: newTitle }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update the session title in the local state
            setSessionHistory(prevHistory => 
                prevHistory.map(session => 
                    session.session_id === sessionIdToRename 
                        ? { ...session, session_title: data.new_title }
                        : session
                )
            );

            // Clear rename state
            setSessionBeingRenamedId(null);
            setRenameInputValue('');
            
            // Refresh session list
            await loadSessionHistoryData();

        } catch (error) {
            console.error("Error during session rename:", error);
            // Show error to user
            setMessages(prev => [...prev, 
                { sender: 'system', text: 'Error: Failed to rename session. Please try again.' }
            ]);
        }
    };

    const handleRenameInputChange = (event) => {
        setRenameInputValue(event.target.value);
    };

    const handleDeleteSession = async (sessionId) => {
        try {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authService.getToken()}`
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Refresh the session list
            loadSessionHistoryData();
            
            // If the deleted session was the current session, clear the messages
            if (sessionId === sessionId) {
                setMessages([]);
                setSessionId(null);
            }
            
        } catch (error) {
            console.error("Error deleting session:", error);
            // Show error message to user
        }
    };

    const handleContextMenuClick = (event, sessionIdForMenu) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenuSessionId(sessionIdForMenu);
    };

    const closeContextMenu = useCallback((event) => {
        if (!event || !event.target.closest('.session-item-context-menu')) {
            setContextMenuSessionId(null);
        }
    }, []);

    useEffect(() => {
        document.addEventListener('click', closeContextMenu);
        return () => {
            document.removeEventListener('click', closeContextMenu);
        };
    }, [closeContextMenu]);

    const handleInputChange = (event) => {
        setUserInput(event.target.value);
    };

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const newMessage = { sender: 'user', text: userInput };
        setMessages(prev => [...prev, newMessage]);
        setUserInput('');

        const aiPlaceholder = { sender: selectedService, text: '', isStreaming: true };
        setMessages(prev => [...prev, aiPlaceholder]);

        try {
            const response = await sendChatMessage(userInput, selectedService, sessionId);
            
            if (!response.ok) {
                throw new Error('Failed to get AI response');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let isFirstChunk = true;
            let accumulatedText = '';

            while (true) {
                try {
                    const { value, done } = await reader.read();
                    if (done) break;

                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.done) {
                                    if (!sessionId && data.session_id) {
                                        setSessionId(data.session_id);
                                        loadSessionHistoryData();
                                    }
                                    setMessages(prev => prev.map((msg, i) => 
                                        i === prev.length - 1 
                                            ? { ...msg, isStreaming: false }
                                            : msg
                                    ));
                                    break;
                                } else if (data.text) {
                                    if (isFirstChunk) {
                                        isFirstChunk = false;
                                    }
                                    accumulatedText += data.text;
                                    setMessages(prev => {
                                        const newMessages = [...prev];
                                        const lastMessage = newMessages[newMessages.length - 1];
                                        if (lastMessage && lastMessage.isStreaming) {
                                            newMessages[newMessages.length - 1] = {
                                                ...lastMessage,
                                                text: accumulatedText,
                                                isStreaming: true
                                            };
                                        }
                                        return newMessages;
                                    });
                                }
                            } catch (e) {
                                console.error('Error parsing SSE data:', e);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error reading stream:', error);
                    break;
                }
            }
        } catch (error) {
            console.error('Error:', error);
            if (error.response?.status === 401) {
                authService.logout();
                navigate('/login');
            }
            setMessages(prev => prev.filter(msg => !msg.isStreaming));
            // Show error message to user
            setMessages(prev => [...prev.filter(msg => !msg.isStreaming), 
                { sender: 'system', text: 'Error: Failed to get AI response. Please try again.' }
            ]);
        }
    };

    const loadSessionMessages = async (sessionIdToLoad) => {
        try {
            const response = await fetch(`${API_BASE_URL}/sessions/${sessionIdToLoad}/messages`, {
                headers: {
                    'Authorization': `Bearer ${authService.getToken()}`
                }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    authService.logout();
                    navigate('/login');
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            const session = sessionHistory.find(s => s.session_id === sessionIdToLoad);
            if (session && session.service_provider) {
                setSelectedService(session.service_provider);
            }
            
            setMessages(data);
            setSessionId(sessionIdToLoad);
        } catch (error) {
            console.error("Error fetching session messages:", error);
        }
    };
   
    const handleNewChat = () => {
        setMessages([]);
        setSessionId(null);
        setUserInput('');
    };

    const handleShowMoreSessions = () => {
        setIsSessionListExpanded(true);
    };

    const handleShowLessSessions = () => {
        setIsSessionListExpanded(false);
    };

    useEffect(() => {
        if (messageAreaRef.current) {
            messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
        }
    }, [messages]);

    const loadSessionHistoryData = async () => {
        try {
            const data = await fetchSessionsFromApi();
            setSessionHistory(data);
        } catch (error) {
            console.error("Error fetching session history:", error);
        }
    };

    useEffect(() => {
        loadSessionHistoryData();
    }, []);

    useEffect(() => {
        const handleClickOutsideRename = (event) => {
            if (sessionBeingRenamedId) {
                const clickedElement = event.target;
                const renameInput = renameInputRef.current;
                const currentSessionItem = renameInput?.closest('.session-list-item');
    
                if (renameInput && !renameInput.contains(clickedElement)) {
                    const clickedSessionItem = clickedElement.closest('.session-list-item');
    
                    if (clickedSessionItem && clickedSessionItem !== currentSessionItem) {
                        setSessionBeingRenamedId(null);
                        setRenameInputValue('');
                        console.log("Rename cancelled due to click on a different session.");
                    }
                }
            }
        };

        const handleEscapeKeyCancel = (event) => {
            if (sessionBeingRenamedId && event.key === 'Escape') {
                setSessionBeingRenamedId(null);
                setRenameInputValue('');
                console.log("Rename cancelled due to Escape key press.");
            }
        };
    
        document.addEventListener('mousedown', handleClickOutsideRename);
        document.addEventListener('keydown', handleEscapeKeyCancel);
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideRename);
            document.removeEventListener('keydown', handleEscapeKeyCancel);
        };
    }, [sessionBeingRenamedId]);
    
    const handleThemeToggle = () => {
        setIsDarkTheme(!isDarkTheme);
    };

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    }, [isDarkTheme]);

    const toggleSidebar = () => {
        setIsSidebarVisible(!isSidebarVisible);
    };

    useEffect(() => {
        if (sessionId) {
            loadSessionHistoryData();
        }
    }, [sessionId]);

    const TypingIndicator = () => (
        <span className="typing-indicator">▊</span>
    );

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    return (
        <div className="chat-interface-container">
            <button 
                className="sidebar-toggle" 
                onClick={toggleSidebar}
                aria-label="Toggle sidebar"
            >
                ☰
            </button>

            <aside className={`chat-sidebar ${isSidebarVisible ? 'show' : ''}`}>
                <div className="sidebar-header">
                    <button className="new-chat-button" onClick={handleNewChat}>
                        + New Chat
                    </button>
                </div>
                <div className="session-history">
                    <h3 className='session-history-header'>RECENT</h3>
                    <ul className="session-list">
                        {sessionHistory && sessionHistory
                            .slice(0, isSessionListExpanded ? undefined : initialSessionCount)
                            .map(sessionItem => (
                                <li
                                    key={sessionItem.session_id}
                                    className="session-list-item"
                                    onClick={() => loadSessionMessages(sessionItem.session_id)}
                                >
                                    {sessionBeingRenamedId === sessionItem.session_id ? (
                                        <input
                                            type="text"
                                            className="session-rename-input"
                                            value={renameInputValue}
                                            onChange={handleRenameInputChange}
                                            onKeyDown={(event) => {
                                                if (event.key === 'Enter') {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    handleRenameSessionSubmit(sessionItem.session_id, renameInputValue);
                                                }
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            ref={renameInputRef}
                                            autoFocus
                                        />
                                    ) : (
                                        <span 
                                            className="session-title"
                                            data-service={sessionItem.service_provider?.toLowerCase()}
                                        >
                                            {serviceIcons[sessionItem.service_provider?.toLowerCase()] || serviceIcons.default}
                                            &nbsp;&nbsp;&nbsp;&nbsp;{sessionItem.session_title}
                                        </span>
                                    )}
                                    
                                    <button
                                        className={`session-item-context-menu-icon ${
                                            contextMenuSessionId === sessionItem.session_id ? 'active' : ''
                                        }`}
                                        onClick={(e) => handleContextMenuClick(e, sessionItem.session_id)}
                                        title="More options"
                                    >
                                        &#8230;
                                    </button>

                                    {contextMenuSessionId === sessionItem.session_id && (
                                        <div 
                                            className="session-item-context-menu"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                className="session-context-menu-button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRenameSession(sessionItem.session_id);
                                                    setRenameInputValue(sessionItem.session_title);
                                                }}
                                            >
                                                Rename
                                            </button>
                                            <button
                                                className="session-context-menu-button session-context-delete-button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteSession(sessionItem.session_id);
                                                }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    )}
                                </li>
                            ))}
                        {sessionHistory && sessionHistory.length > initialSessionCount && (
                            !isSessionListExpanded ? (
                                <button onClick={handleShowMoreSessions} className="session-history-more-button">
                                    More <span className="arrow-icon">&#9660;</span>
                                </button>
                            ) : (
                                <button onClick={handleShowLessSessions} className="session-history-less-button">
                                    Less <span className="arrow-icon">&#9650;</span>
                                </button>
                            )
                        )}
                    </ul>
                </div>
                
                <div className="sidebar-footer">
                    <ThemeToggle 
                        isDark={isDarkTheme}
                        onToggle={handleThemeToggle}
                    />
                    <button className="logout-button" onClick={handleLogout}>
                        Logout ({username})
                    </button>
                </div>
            </aside>
            <div className="chat-content">
                <div className="service-selection">
                    <select
                        id="service-select-main-area"
                        className="service-select"
                        value={selectedService}
                        onChange={(event) => {
                            setMessages([]);
                            setSelectedService(event.target.value);
                        }}
                    >
                        {serviceOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
                <main className="main-chat-area">
                    <div className="message-display-area" ref={messageAreaRef}>
                        {messages.length === 0 ? (
                            <WelcomeMessage username={username} />
                        ) : (
                            messages.map((msg, index) => (
                                <div 
                                    key={index} 
                                    className={`message ${msg.sender === 'user' ? 'user' : msg.sender}`}
                                >
                                    <div className="message-content">
                                        <ReactMarkdown>
                                            {msg.text}
                                        </ReactMarkdown>
                                        {msg.isStreaming && <TypingIndicator />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    <div className="input-area">
                        <textarea
                            className="chat-input"
                            placeholder="Type your message..."
                            value={userInput}
                            onChange={handleInputChange}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.shiftKey) {
                                    event.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />
                        <button className="send-button" onClick={handleSendMessage}>Send</button>
                    </div>
                </main>
            </div>
        </div>
    );
}

export default ChatInterface;