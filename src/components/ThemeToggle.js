import React from 'react';
import './ThemeToggle.css';

const ThemeToggle = ({ isDark, onToggle }) => {
    return (
        <div className="theme-toggle-container">
            <div className="theme-toggle-label">
                <span className="theme-icon">🌙</span>
                Dark theme
            </div>
            <label className="switch">
                <input
                    type="checkbox"
                    checked={isDark}
                    onChange={onToggle}
                />
                <span className="slider round"></span>
            </label>
        </div>
    );
};

export default ThemeToggle; 