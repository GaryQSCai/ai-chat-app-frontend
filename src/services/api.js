// frontend/src/services/api.js

import axios from 'axios';
import authService from './authService';

const API_BASE_URL = 'http://localhost:8000'; // Adjust if your backend is running on a different port or URL

// Create axios instance with auth header
const api = axios.create({
    baseURL: API_BASE_URL,
});

// Add auth header interceptor
api.interceptors.request.use((config) => {
    const token = authService.getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Add interceptor for handling auth errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            authService.logout();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const sendChatMessage = async (text, service, sessionId = null) => {
    const token = authService.getToken();
    if (!token) {
        throw new Error('No authentication token found');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                text,
                service,
                session_id: sessionId
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to get AI response');
        }

        return response;
    } catch (error) {
        console.error('Error in sendChatMessage:', error);
        throw error;
    }
};

// Add export for fetchSessionHistory
export const fetchSessionHistory = async () => {
    try {
        const response = await api.get('/sessions/');
        return response.data;
    } catch (error) {
        console.error('Error fetching session history:', error);
        throw error;
    }
};

// Add export for deleteSession
export const deleteSession = async (sessionId) => {
    try {
        const response = await api.delete(`/sessions/${sessionId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting session:', error);
        throw error;
    }
};