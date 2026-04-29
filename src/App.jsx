import React, { useState, useEffect } from 'react';
import AuthScreen from './components/AuthScreen.jsx';
import CampaignSelector from './components/CampaignSelector.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import NewSessionDialog from './components/NewSessionDialog.jsx';
import { apiUrl, getAuthHeaders, getCampaignStyle } from './api.js';
import { createLogger } from './logger.js';
import './App.css';

const log = createLogger('App');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [showSelector, setShowSelector] = useState(true);
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [hasActiveSession, setHasActiveSession] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('auth-token');
    if (token) {
      log.debug('Verifying stored token…');
      fetch(apiUrl('/health'), {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => {
          if (r.ok) {
            log.info('Token valid — authenticated');
            setIsAuthenticated(true);
          } else {
            log.warn('Stored token rejected (status', r.status, ') — clearing');
            localStorage.removeItem('auth-token');
          }
        })
        .catch(err => {
          log.error('Health check failed:', err.message);
          localStorage.removeItem('auth-token');
        })
        .finally(() => setAuthChecked(true));
    } else {
      log.debug('No stored token — showing auth screen');
      setAuthChecked(true);
    }
  }, []);

  const handleSelectCampaign = (campaign) => {
    log.info(`Campaign selected: "${campaign.name}" (id=${campaign.id})`);
    const style = getCampaignStyle(campaign);
    setActiveCampaign({ ...campaign, ...style });
    setActiveSession(null);
    setShowSelector(false);
    setSidebarOpen(false);
  };

  const handleNewSession = () => setShowNewDialog(true);

  const handleDialogConfirm = async ({ sessionInstructions }) => {
    log.info(`Starting new session for campaign ${activeCampaign.id}`);
    log.debug('Session instructions:', sessionInstructions ?? '(none)');
    setShowNewDialog(false);
    const res = await fetch(apiUrl('/sessions'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        campaignId: activeCampaign.id,
        sessionInstructions: sessionInstructions || undefined,
      }),
    });
    const data = await res.json();
    log.info(`Session started: id=${data.sessionId} number=${data.sessionNumber}`);
    log.debug('Session start output:', data.output?.slice(0, 120));
    setActiveSession({
      id: data.sessionId,
      campaignId: activeCampaign.id,
      sessionNumber: data.sessionNumber,
      status: 'active',
      startedAt: new Date().toISOString(),
      _opening: data.output,
    });
    setSidebarOpen(false);
  };

  const handleChangeCampaign = () => {
    log.info('Returning to campaign selector');
    setShowSelector(true);
    setActiveSession(null);
    setSidebarOpen(false);
    setHasActiveSession(false);
  };

  const handleSelectSession = (session) => {
    setActiveSession(session);
    setSidebarOpen(false);
  };

  if (!authChecked) {
    return (
      <div className="auth-screen">
        <div className="auth-container">
          <div className="auth-header">
            <span className="auth-icon">🎲</span>
            <h1>TTRPG Game Master</h1>
            <p>Loading…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  if (showSelector || !activeCampaign) {
    return (
      <CampaignSelector
        onSelect={handleSelectCampaign}
        activeCampaign={activeCampaign}
      />
    );
  }

  return (
    <div className="app-layout">
      <div
        className={`sidebar-scrim ${sidebarOpen ? 'open' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden={!sidebarOpen}
      />

      <Sidebar
        campaign={activeCampaign}
        activeSession={activeSession}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onChangeCampaign={handleChangeCampaign}
        onHasActiveChange={setHasActiveSession}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="app-main">
        {activeSession ? (
          <ChatWindow
            session={activeSession}
            campaign={activeCampaign}
            onOpenSidebar={() => setSidebarOpen(true)}
          />
        ) : (
          <div className="empty-state">
            <button
              className="mobile-sidebar-toggle"
              type="button"
              onClick={() => setSidebarOpen(o => !o)}
              aria-expanded={sidebarOpen}
              aria-label={sidebarOpen ? 'Close campaign drawer' : 'Open campaign drawer'}
            >
              <span className="mobile-sidebar-toggle-icon">☰</span>
              <span className="mobile-sidebar-toggle-text">Sessions</span>
            </button>
            <div className="empty-state-inner">
              <span className="empty-icon">{activeCampaign.icon}</span>
              <h2>{activeCampaign.name}</h2>
              <p>{activeCampaign.setting || activeCampaign.rules_system}</p>
              <button
                className="btn-primary"
                onClick={handleNewSession}
                disabled={hasActiveSession}
                title={hasActiveSession ? 'End the current session before starting a new one' : undefined}
              >
                Begin New Session
              </button>
            </div>
          </div>
        )}
      </main>

      {showNewDialog && (
        <NewSessionDialog
          campaign={activeCampaign}
          onConfirm={handleDialogConfirm}
          onCancel={() => setShowNewDialog(false)}
        />
      )}
    </div>
  );
}
