import axios from 'axios';

const API_URL = 'http://localhost:8000';

class AuthService {
    async login(email, password) {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await axios.post(`${API_URL}/token`, formData);
            console.log('Full login response:', response);
            console.log('Login response data:', response.data);
            console.log('Username from response:', response.data.username);

            if (response.data.access_token) {
                // Store token and user info
                const userData = {
                    access_token: response.data.access_token,
                    email: email,
                    username: response.data.username // Remove the fallback to email
                };
                console.log('Storing user data:', userData);
                localStorage.setItem('user', JSON.stringify(userData));
            }
            return response.data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async register(username, email, password) {
        try {
            const response = await axios.post(`${API_URL}/register`, {
                username,
                email,
                password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                throw new Error(error.response.data.detail || 'Registration failed');
            } else if (error.request) {
                // The request was made but no response was received
                throw new Error('No response from server');
            } else {
                // Something happened in setting up the request that triggered an Error
                throw new Error('Error setting up the request');
            }
        }
    }

    logout() {
        localStorage.removeItem('user');
    }

    getCurrentUser() {
        return JSON.parse(localStorage.getItem('user'));
    }

    getToken() {
        const user = this.getCurrentUser();
        return user?.access_token;
    }

    isAuthenticated() {
        return !!this.getToken();
    }

    getCurrentUsername() {
        const user = this.getCurrentUser();
        console.log('Full user data from storage:', user);
        
        if (!user) return '';
        
        // Simply return the username
        return user.username || 'User';
    }
}

export default new AuthService(); 