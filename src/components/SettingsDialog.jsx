import React, { useState, useEffect } from 'react';
import { getSettingsModels, updateSettings } from '../api.js';
import { createLogger } from '../logger.js';
import './SettingsDialog.css';

const log = createLogger('SettingsDialog');

export default function SettingsDialog({ hasActiveSession, onClose }) {
  const [providers, setProviders] = useState(null);
  const [gmModel, setGmModel] = useState('');
  const [rulesModel, setRulesModel] = useState('');
  const [initialGmModel, setInitialGmModel] = useState('');
  const [initialRulesModel, setInitialRulesModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedNote, setSavedNote] = useState(null);

  useEffect(() => {
    log.debug('Loading available models…');
    getSettingsModels()
      .then(data => {
        log.info('Models loaded, currentProvider:', data.currentProvider);
        setProviders(data.providers ?? {});
        setGmModel(data.currentGmModel ?? '');
        setRulesModel(data.currentRulesModel ?? '');
        setInitialGmModel(data.currentGmModel ?? '');
        setInitialRulesModel(data.currentRulesModel ?? '');      })
      .catch(err => {
        log.error('Failed to load models:', err.message);
        setError('Failed to load available models.');
      });
  }, []);

  const handleSave = async () => {
    const payload = {};
    if (gmModel !== initialGmModel) payload.gmModel = gmModel;
    if (rulesModel !== initialRulesModel) payload.rulesModel = rulesModel;

    setSaving(true);
    setError(null);
    try {
      const result = await updateSettings(payload);
      log.info('Settings saved:', result.updated);
      setSavedNote(result.note ?? 'Settings saved.');
    } catch (err) {
      log.error('Failed to save settings:', err.message);
      setError('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const isDirty = gmModel !== initialGmModel || rulesModel !== initialRulesModel;
  const canSave = !saving && providers !== null && isDirty;

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog settings-dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog-header">
          <span className="dialog-icon">⚙️</span>
          <div>
            <div className="dialog-title">Settings</div>
            <div className="dialog-subtitle">AI Model Configuration</div>
          </div>
        </div>

        <div className="dialog-body">
          {hasActiveSession && !savedNote && (
            <div className="settings-warning">
              A session is currently active. Changes will take effect on the next session.
            </div>
          )}

          {savedNote && (
            <div className="settings-saved">{savedNote}</div>
          )}

          {error && <div className="settings-error">{error}</div>}

          {providers === null && !error ? (
            <div className="settings-loading">Loading…</div>
          ) : !savedNote && (
            <>
              <div className="field">
                <label>GM Model</label>
                <ModelSelect
                  value={gmModel}
                  onChange={setGmModel}
                  providers={providers}
                  role="gm"
                />
              </div>

              <div className="field">
                <label>Rules Model</label>
                <ModelSelect
                  value={rulesModel}
                  onChange={setRulesModel}
                  providers={providers}
                  role="rules"
                />
              </div>

              <p className="settings-legend">★ recommended for role ◆ suitable for either hover for description</p>
            </>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onClose}>{savedNote ? 'Close' : 'Cancel'}</button>
          {!savedNote && (
            <button className="btn-confirm" onClick={handleSave} disabled={!canSave}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ModelSelect({ value, onChange, providers, role }) {
  const entries = Object.entries(providers ?? {});

  function sortedModels(models) {
    return [...models].sort((a, b) => {
      const aMatch = a.suggestedFor === role || a.suggestedFor === 'either';
      const bMatch = b.suggestedFor === role || b.suggestedFor === 'either';
      return bMatch - aMatch;
    });
  }

  function modelLabel(m) {
    const tag = m.suggestedFor === role ? '★ ' : m.suggestedFor === 'either' ? '◆ ' : '';
    return `${tag}${m.id}`;
  }

  return (
    <select
      className="settings-select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">— select a model —</option>
      {entries.map(([provider, { models }]) => (
        <optgroup key={provider} label={provider}>
          {sortedModels(models).map(m => (
            <option key={m.id} value={m.id} title={m.description}>
              {modelLabel(m)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
