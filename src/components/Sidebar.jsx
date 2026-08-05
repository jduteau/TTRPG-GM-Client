import React, { useState, useEffect, useCallback } from 'react';
import { apiUrl, getAuthHeaders } from '../api.js';
import { createLogger } from '../logger.js';
import './Sidebar.css';

const log = createLogger('Sidebar');

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
    + ' · '
    + d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

export default function Sidebar({
  campaign,
  activeSession,
  onSelectSession,
  onNewSession,
  onChangeCampaign,
  onHasActiveChange,
  onSettings,
  isOpen,
  onClose,
}) {
  const [sessions, setSessions] = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  const fetchSessions = useCallback(() => {
    log.debug(`Fetching sessions for campaign ${campaign.id}…`);
    fetch(apiUrl(`/campaigns/${campaign.id}/sessions`), { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.sessions || [];
        log.info(`Loaded ${list.length} session(s) for campaign ${campaign.id}`);
        setSessions(list);
        onHasActiveChange?.(list.some(s => s.status === 'active'));
      })
      .catch(err => log.error('Failed to fetch sessions:', err.message));
  }, [campaign.id]);

  useEffect(() => { fetchSessions(); }, [fetchSessions, activeSession?.id]);

  const handleDelete = async (e, session) => {
    e.stopPropagation();
    if (!confirm('Delete this session?')) return;
    log.info(`Deleting session ${session.id} (session #${session.session_number ?? session.sessionNumber})`);
    setDeletingId(session.id);
    try {
      const res = await fetch(apiUrl(`/sessions/${session.id}`), { method: 'DELETE', headers: getAuthHeaders() });
      if (!res.ok) log.warn(`Delete returned status ${res.status} for session ${session.id}`);
      else log.debug(`Session ${session.id} deleted`);
    } catch (err) {
      log.error('Failed to delete session:', err.message);
    }
    setDeletingId(null);
    fetchSessions();
    if (activeSession?.id === session.id) onSelectSession(null);
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`} style={{ '--campaign-color': campaign.color }}>
      <div className="sidebar-header">
        <div className="sidebar-header-top">
          <button className="campaign-back" onClick={onChangeCampaign}>← All Campaigns</button>
          <button className="sidebar-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="sidebar-campaign">
          <span className="sidebar-icon">{campaign.icon}</span>
          <div>
            <div className="sidebar-campaign-name">{campaign.name}</div>
            <div className="sidebar-campaign-sub">{campaign.rules_system || campaign.rulesSystem}</div>
          </div>
        </div>
      </div>

      <div className="sidebar-sessions-header">
        <span>Sessions</span>
        <button
          className="btn-new-session"
          onClick={onNewSession}
          disabled={sessions.some(s => s.status === 'active')}
          title={sessions.some(s => s.status === 'active') ? 'End the current session first' : undefined}
        >
          + New
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 && (
          <div className="session-empty">No sessions yet</div>
        )}
        {sessions.map((session, index) => (
          <div
            key={session.id}
            className={`session-item
              ${activeSession?.id === session.id ? 'active' : ''}
              ${deletingId === session.id ? 'deleting' : ''}
              ${session.status === 'active' ? 'in-progress' : 'ended'}`}
            onClick={() => onSelectSession(session)}
          >
            <div className="session-item-body">
              <span className="session-title">
                Session {session.session_number || session.sessionNumber}
              </span>
              <div className="session-meta">
                <span className="session-date">{formatDate(session.started_at || session.startedAt)}</span>
              </div>
            </div>
            {index === 0 && (
              <button className="session-delete" onClick={e => handleDelete(e, session)} title="Delete">✕</button>
            )}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <button className="btn-settings" onClick={onSettings} title="Settings">
          ⚙️ Settings
        </button>
      </div>
    </aside>
  );
}
