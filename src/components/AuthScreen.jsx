import React, { useState } from 'react';
import { apiUrl } from '../api.js';
import { createLogger } from '../logger.js';
import './AuthScreen.css';

const log = createLogger('AuthScreen');

export default function AuthScreen({ onAuthenticated }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    log.info('Authentication attempt…');

    try {
      const response = await fetch(apiUrl('/health'), {
        headers: { 'Authorization': `Bearer ${token.trim()}` },
      });

      if (response.ok) {
        log.info('Authentication successful');
        localStorage.setItem('auth-token', token.trim());
        onAuthenticated();
      } else {
        log.warn('Authentication failed — server returned', response.status);
        setError('Invalid token — check your server AUTH_TOKEN');
      }
    } catch (err) {
      log.error('Could not reach server:', err.message);
      setError('Could not reach server — is it running?');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-container">
        <div className="auth-header">
          <span className="auth-icon">🎲</span>
          <h1>TTRPG Game Master</h1>
          <p>Enter your server token to connect</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="auth-field">
            <label htmlFor="token">Bearer Token</label>
            <input
              id="token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="your-secret-token"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button
            type="submit"
            className="auth-submit"
            disabled={!token.trim() || isLoading}
          >
            {isLoading ? 'Connecting…' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}
