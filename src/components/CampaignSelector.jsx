import React, { useState, useEffect } from 'react';
import { apiUrl, getAuthHeaders, getCampaignStyle } from '../api.js';
import CreateCampaignDialog from './CreateCampaignDialog.jsx';
import { createLogger } from '../logger.js';
import './CampaignSelector.css';

const log = createLogger('CampaignSelector');

export default function CampaignSelector({ onSelect, activeCampaign }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const fetchCampaigns = () => {
    log.debug('Fetching campaigns…');
    setLoading(true);
    fetch(apiUrl('/campaigns'), { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : data.campaigns || [];
        log.info(`Loaded ${list.length} campaign(s)`);
        setCampaigns(list);
      })
      .catch(err => log.error('Failed to fetch campaigns:', err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleCreated = (campaign) => {
    log.info(`Campaign created: "${campaign.name}" (id=${campaign.id})`);
    setShowCreate(false);
    fetchCampaigns();
    const style = getCampaignStyle(campaign);
    onSelect({ ...campaign, ...style });
  };

  return (
    <div className="selector-screen">
      <div className="selector-bg" />
      <div className="selector-content">
        <header className="selector-header">
          <div className="selector-rule" />
          <h1>GM Screen</h1>
          <div className="selector-rule" />
        </header>
        <p className="selector-subtitle">Choose your campaign</p>

        {loading && <div className="selector-loading">Loading campaigns…</div>}

        {!loading && campaigns.length === 0 && (
          <div className="selector-empty">
            <p>No campaigns yet.</p>
            <p>Create a campaign to get started.</p>
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <div className="campaign-grid">
            {campaigns.map(c => {
              const { icon, color } = getCampaignStyle(c);
              const isActive = activeCampaign?.id === c.id;
              return (
                <button
                  key={c.id}
                  className={`campaign-card ${isActive ? 'active' : ''}`}
                  onClick={() => onSelect({ ...c, icon, color })}
                  style={{ '--campaign-color': color }}
                >
                  <div className="card-glow" />
                  <span className="card-icon">{icon}</span>
                  <div className="card-text">
                    <span className="card-name">{c.name}</span>
                    <span className="card-sub">{c.rules_system || c.rulesSystem}</span>
                    {c.setting && <span className="card-setting">{c.setting}</span>}
                  </div>
                  <div className="card-arrow">→</div>
                </button>
              );
            })}
          </div>
        )}

        <button className="btn-new-campaign" onClick={() => setShowCreate(true)}>
          + New Campaign
        </button>
      </div>

      {showCreate && (
        <CreateCampaignDialog
          onCreated={handleCreated}
          onCancel={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
