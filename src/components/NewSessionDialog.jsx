import React, { useState } from 'react';
import './NewSessionDialog.css';

export default function NewSessionDialog({ campaign, onConfirm, onCancel }) {
  const [instructions, setInstructions] = useState('');

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div
        className="dialog"
        onClick={e => e.stopPropagation()}
        style={{ '--campaign-color': campaign.color }}
      >
        <div className="dialog-header">
          <span className="dialog-icon">{campaign.icon}</span>
          <div>
            <div className="dialog-title">New Session</div>
            <div className="dialog-subtitle">{campaign.name}</div>
          </div>
        </div>

        <div className="dialog-body">
          <div className="field">
            <label>
              Session Instructions{' '}
              <span className="field-hint">(optional)</span>
            </label>
            <textarea
              rows={4}
              placeholder="Pick up where we left off. Focus on the dungeon level 2…"
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              autoFocus
            />
          </div>
          <p className="dialog-note">
            The GM will greet you and set the scene based on the current campaign state.
            Session instructions are one-time notes for this session only.
          </p>
        </div>

        <div className="dialog-footer">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button
            className="btn-confirm"
            onClick={() => onConfirm({ sessionInstructions: instructions.trim() || undefined })}
          >
            Begin Session
          </button>
        </div>
      </div>
    </div>
  );
}
