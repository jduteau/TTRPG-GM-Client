import React, { useState, useEffect } from 'react';
import { apiUrl, getAuthHeaders, getRulesSystems } from '../api.js';
import { createLogger } from '../logger.js';
import './CreateCampaignDialog.css';

const log = createLogger('CreateCampaignDialog');

const STEPS = ['Basics', 'Wiki', 'Templates', 'Instructions'];

const DEFAULT_STATE_TEMPLATE =
  `Party:\n{partyLines}\n\nLocation: {location}\n\nSituation: {situation}\n\nActive Threads:\n{threads}\n\nLast Session: {lastSession}`;
const DEFAULT_PARTY_LINE =
  `- [[{wikiPath}]] — {hp_current}/{hp_max} HP`;

export default function CreateCampaignDialog({ onCreated, onCancel }) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [rulesSystems, setRulesSystems] = useState([]);

  useEffect(() => {
    getRulesSystems()
      .then(data => setRulesSystems(Array.isArray(data) ? data : []))
      .catch(() => setRulesSystems([]));
  }, []);
  const [form, setForm] = useState({
    name: '',
    rulesSystem: '',
    githubRepo: '',
    statePageTemplate: DEFAULT_STATE_TEMPLATE,
    partyLineTemplate: DEFAULT_PARTY_LINE,
    campaignInstructions: '',
    rulesInstructions: '',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const canAdvance = () => {
    if (step === 0) return form.name.trim() && form.rulesSystem.trim();
    if (step === 1) return /^[^/]+\/[^/]+$/.test(form.githubRepo.trim());
    if (step === 2) return form.statePageTemplate.trim() && form.partyLineTemplate.trim();
    return true;
  };

  const handleSubmit = async () => {
    log.info(`Creating campaign "${form.name}" (rulesSystem="${form.rulesSystem}")`);
    log.debug('Campaign form data:', { name: form.name, rulesSystem: form.rulesSystem, githubRepo: form.githubRepo });
    setSaving(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/campaigns'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          name: form.name.trim(),
          rulesSystem: form.rulesSystem.trim(),
          githubRepo: form.githubRepo.trim(),
          statePageTemplate: form.statePageTemplate.trim(),
          partyLineTemplate: form.partyLineTemplate.trim(),
          campaignInstructions: form.campaignInstructions.trim() || undefined,
          rulesInstructions: form.rulesInstructions.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }
      const campaign = await res.json();
      log.info(`Campaign created: "${campaign.name}" id=${campaign.id}`);
      onCreated(campaign);
    } catch (e) {
      log.error('Failed to create campaign:', e.message);
      setError(e.message);
      setSaving(false);
    }
  };

  return (
    <div className="cc-overlay" onClick={onCancel}>
      <div className="cc-dialog" onClick={e => e.stopPropagation()}>
        <div className="cc-header">
          <span className="cc-title">New Campaign</span>
          <div className="cc-steps">
            {STEPS.map((s, i) => (
              <span key={s} className={`cc-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                {i < step ? '✓' : i + 1}
              </span>
            ))}
          </div>
        </div>

        <div className="cc-step-label">{STEPS[step]}</div>

        <div className="cc-body">
          {step === 0 && (
            <>
              <Field label="Campaign Name" required>
                <input value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="The Caves of Chaos" autoFocus />
              </Field>
              <Field label="Rules System" required>
                <select value={form.rulesSystem} onChange={e => {
                  const slug = e.target.value;
                  const rs = rulesSystems.find(s => s.slug === slug);
                  setForm(f => ({
                    ...f,
                    rulesSystem: slug,
                    ...(rs?.defaults?.statePageTemplate ? { statePageTemplate: rs.defaults.statePageTemplate } : {}),
                    ...(rs?.defaults?.partyLinesTemplate ? { partyLineTemplate: rs.defaults.partyLinesTemplate } : {}),
                  }));
                }}>
                  <option value="">— Select a rules system —</option>
                  {rulesSystems.map(s => (
                    <option key={s.slug} value={s.slug}>{s.slug}</option>
                  ))}
                </select>
              </Field>

            </>
          )}

          {step === 1 && (
            <>
              <Field label="GitHub Repository" required hint="owner/repo — the wiki source repository">
                <input value={form.githubRepo} onChange={e => set('githubRepo', e.target.value)}
                  placeholder="my-org/my-campaign-wiki" />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="State Page Template" required hint="Use {partyLines}, {location}, {situation}, {threads}, {lastSession}">
                <textarea rows={5} value={form.statePageTemplate}
                  onChange={e => set('statePageTemplate', e.target.value)} />
              </Field>
              <Field label="Party Line Template" required hint="Use {wikiPath} and any PC frontmatter field like {hp_current}, {level}">
                <input value={form.partyLineTemplate}
                  onChange={e => set('partyLineTemplate', e.target.value)}
                  placeholder="- [[{wikiPath}]] — {hp_current}/{hp_max} HP" />
              </Field>
            </>
          )}

          {step === 3 && (
            <>
              <Field label="Campaign Instructions" hint="Persistent GM guidance — tone, behaviour, house rules (optional)">
                <textarea rows={4} value={form.campaignInstructions}
                  onChange={e => set('campaignInstructions', e.target.value)}
                  placeholder="This campaign is gritty and dangerous. Maintain tension…" />
              </Field>
              <Field label="Rules Instructions" hint="Interpretive guidance for the Rules Agent (optional)">
                <textarea rows={4} value={form.rulesInstructions}
                  onChange={e => set('rulesInstructions', e.target.value)}
                  placeholder="Use strict RAW for combat. For ambiguous situations…" />
              </Field>
            </>
          )}

          {error && <div className="cc-error">{error}</div>}
        </div>

        <div className="cc-footer">
          <button className="cc-btn-cancel" onClick={onCancel}>Cancel</button>
          <div className="cc-footer-right">
            {step > 0 && (
              <button className="cc-btn-back" onClick={() => setStep(s => s - 1)}>← Back</button>
            )}
            {step < STEPS.length - 1 ? (
              <button className="cc-btn-next" onClick={() => setStep(s => s + 1)} disabled={!canAdvance()}>
                Next →
              </button>
            ) : (
              <button className="cc-btn-create" onClick={handleSubmit} disabled={saving || !canAdvance()}>
                {saving ? 'Creating…' : 'Create Campaign'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div className="cc-field">
      <label>
        <span className="cc-label">{label}</span>
        {hint && <span className="cc-hint">{hint}</span>}
        {required && <span className="cc-required">*</span>}
      </label>
      {children}
    </div>
  );
}
