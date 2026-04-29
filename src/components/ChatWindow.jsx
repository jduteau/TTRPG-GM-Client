import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { apiUrl, getAuthHeaders } from '../api.js';
import { createLogger } from '../logger.js';
import './ChatWindow.css';

const log = createLogger('ChatWindow');

// ── Sub-components ──────────────────────────────────────────────────────────────

function DiceRollBlock({ rolls }) {
  if (!rolls || rolls.length === 0) return null;
  return (
    <div className="dice-roll-area">
      {rolls.map((r, i) => (
        <div key={i} className="dice-roll-block">
          {r.reason && <span className="dice-roll-label">{r.reason}</span>}
          <span className="dice-roll-result">
            {r.expression} = <strong>{r.total}</strong>
          </span>
        </div>
      ))}
    </div>
  );
}

function InlineDiceRoll({ roll }) {
  return (
    <div className="dice-roll-block inline">
      {roll.reason && <span className="dice-roll-label">{roll.reason}</span>}
      <span className="dice-roll-result">
        {roll.expression} = <strong>{roll.total}</strong>
      </span>
    </div>
  );
}

function RecapModal({ sessionId, onClose }) {
  const [recap, setRecap] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl(`/sessions/${sessionId}/recap`), { headers: getAuthHeaders() })
      .then(r => r.text())
      .then(text => { setRecap(text); setLoading(false); })
      .catch(() => { setRecap('Failed to load recap.'); setLoading(false); });
  }, [sessionId]);

  return (
    <div className="recap-overlay" onClick={onClose}>
      <div className="recap-dialog" onClick={e => e.stopPropagation()}>
        <div className="recap-header">
          <span className="recap-title">Session Recap</span>
          <button className="recap-close" onClick={onClose}>✕</button>
        </div>
        <div className="recap-body">
          {loading ? (
            <p className="recap-loading">Loading recap…</p>
          ) : (
            <ReactMarkdown>{recap}</ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

function EndSessionConfirm({ onConfirm, onCancel }) {
  return (
    <div className="end-overlay" onClick={onCancel}>
      <div className="end-dialog" onClick={e => e.stopPropagation()}>
        <div className="end-dialog-title">End Session?</div>
        <p className="end-dialog-body">
          The GM will generate a session recap and retire all active NPC agents.
          A recap document will be available after the session ends.
        </p>
        <div className="end-dialog-footer">
          <button className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button className="btn-end-confirm" onClick={onConfirm}>End Session</button>
        </div>
      </div>
    </div>
  );
}

// ── Message rendering ───────────────────────────────────────────────────────────

function Message({ msg }) {
  if (msg.role === 'user') {
    return (
      <div className="message message-user">
        <div className="message-label">You</div>
        <div className="message-content">{msg.content}</div>
      </div>
    );
  }

  if (msg.role === 'gm') {
    return (
      <div className="message message-assistant">
        <div className="message-label">GM</div>
        {msg.rolls && msg.rolls.length > 0 && <DiceRollBlock rolls={msg.rolls} />}
        <div className="message-content">
          <ReactMarkdown>{msg.content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  return null;
}

// Build message list from transcript turns
function transcriptToMessages(turns) {
  const msgs = [];
  for (const turn of turns) {
    const playerInput = turn.player_input ?? turn.playerInput;
    const gmOutput = turn.gm_output ?? turn.gmOutput;
    const rolls = turn.rolls || [];
    if (playerInput) {
      msgs.push({ id: `p-${turn.id}`, role: 'user', content: playerInput });
    }
    if (gmOutput) {
      msgs.push({ id: `g-${turn.id}`, role: 'gm', content: gmOutput, rolls });
    }
  }
  return msgs;
}

// ── Main component ──────────────────────────────────────────────────────────────

export default function ChatWindow({ session, campaign, onOpenSidebar }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState('');
  const [liveRolls, setLiveRolls] = useState([]);
  const [ending, setEnding] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showRecap, setShowRecap] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Load transcript (or opening message) when session changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setStreaming(false);
    setStreamBuffer('');
    setLiveRolls([]);
    setEnding(false);
    setShowEndConfirm(false);

    const ended = !!(session.ended_at || session.endedAt || session.status === 'completed');
    setSessionEnded(ended);

    // If we just started the session and have an opening message
    if (session._opening) {
      log.info(`Session ${session.id} opened — using opening message`);
      setMessages([{
        id: 'opening',
        role: 'gm',
        content: session._opening,
        rolls: session.rolls || [],
      }]);
      return;
    }

    // Otherwise load the transcript
    log.debug(`Loading transcript for session ${session.id}…`);
    fetch(apiUrl(`/sessions/${session.id}/transcript`), { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => {
        const turns = Array.isArray(data) ? data : data.turns || [];
        log.info(`Transcript loaded: ${turns.length} turn(s) for session ${session.id}`);
        setMessages(transcriptToMessages(turns));
      })
      .catch(err => log.error('Failed to load transcript:', err.message));
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamBuffer, liveRolls]);

  const sendTurn = async (text) => {
    log.info(`Sending turn for session ${session.id}: "${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`);
    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages(m => [...m, userMsg]);
    setStreaming(true);
    setStreamBuffer('');
    setLiveRolls([]);

    try {
      const res = await fetch(apiUrl(`/sessions/${session.id}/turns`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ input: text }),
      });

      if (res.headers.get('content-type')?.includes('text/event-stream')) {
        log.debug('Receiving streaming response…');
        await consumeStream(res);
      } else {
        const data = await res.json();
        log.info(`Turn complete (non-streaming): turnId=${data.turnId} rolls=${data.rolls?.length ?? 0}`);
        setMessages(m => [...m, {
          id: data.turnId,
          role: 'gm',
          content: data.output,
          rolls: data.rolls || [],
        }]);
        setStreaming(false);
      }
    } catch (err) {
      log.error('sendTurn failed:', err.message);
      setMessages(m => [...m, { id: Date.now(), role: 'gm', content: `[Error: ${err.message}]`, rolls: [] }]);
      setStreaming(false);
    }
  };

  const consumeStream = async (res) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let textBuffer = '';
    let rollsBuffer = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'token') {
            textBuffer += data.content;
            setStreamBuffer(textBuffer);
          }

          if (data.type === 'roll') {
            const roll = { expression: data.expression, total: data.total, reason: data.reason };
            log.debug(`Roll: ${roll.expression} = ${roll.total}${roll.reason ? ` (${roll.reason})` : ''}`);
            rollsBuffer = [...rollsBuffer, roll];
            setLiveRolls(rollsBuffer);
          }

          if (data.type === 'done') {
            log.info(`Stream complete: turnId=${data.turnId} rolls=${rollsBuffer.length} chars=${textBuffer.length}`);
            setMessages(m => [...m, {
              id: data.turnId || Date.now(),
              role: 'gm',
              content: textBuffer,
              rolls: rollsBuffer,
            }]);
            setStreamBuffer('');
            setLiveRolls([]);
            setStreaming(false);
          }

          if (data.type === 'error') {
            log.error('Stream error from server:', data.message);
            setMessages(m => [...m, { id: Date.now(), role: 'gm', content: `[Error: ${data.message}]`, rolls: [] }]);
            setStreaming(false);
          }
        } catch {}
      }
    }
  };

  const send = async () => {
    if (!input.trim() || streaming || ending || sessionEnded) return;
    const text = input.trim();
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    await sendTurn(text);
  };

  const handleEndSession = async () => {
    log.info(`Ending session ${session.id}…`);
    setShowEndConfirm(false);
    setEnding(true);
    try {
      const res = await fetch(apiUrl(`/sessions/${session.id}/end`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        log.info(`Session ${session.id} ended successfully`);
        setSessionEnded(true);
      } else {
        const err = await res.json().catch(() => ({}));
        log.error(`Failed to end session ${session.id}:`, err.error || res.status);
        setMessages(m => [...m, { id: Date.now(), role: 'gm', content: `[Error ending session: ${err.error || res.status}]`, rolls: [] }]);
      }
    } catch (err) {
      log.error('End session request failed:', err.message);
      setMessages(m => [...m, { id: Date.now(), role: 'gm', content: `[Error: ${err.message}]`, rolls: [] }]);
    } finally {
      setEnding(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px';
  };

  const busy = streaming || ending;
  const sessionNum = session.session_number || session.sessionNumber;

  return (
    <div className="chat-window" style={{ '--campaign-color': campaign.color }}>
      <div className="chat-header">
        <button
          className="chat-sessions-toggle"
          type="button"
          onClick={onOpenSidebar}
          aria-label="Open sessions drawer"
        >
          <span className="chat-sessions-toggle-icon">☰</span>
          <span>Sessions</span>
        </button>

        <span className="chat-session-title">
          Session {sessionNum}
          {sessionEnded && <span className="session-ended-badge">Ended</span>}
        </span>

        <div className="chat-header-actions">
          <span className="chat-campaign-tag">{campaign.icon} {campaign.name}</span>
          {sessionEnded ? (
            <button className="btn-recap" onClick={() => setShowRecap(true)}>
              View Recap
            </button>
          ) : (
            <button
              className="btn-end-session"
              onClick={() => setShowEndConfirm(true)}
              disabled={busy}
              title="End session"
            >
              End Session
            </button>
          )}
        </div>
      </div>

      <div className="messages">
        {messages.length === 0 && !streaming && !ending && (
          <div className="messages-empty">
            <span className="messages-empty-icon">{campaign.icon}</span>
            <p>The session begins…</p>
          </div>
        )}

        {messages.map((msg, i) => <Message key={msg.id ?? i} msg={msg} />)}

        {/* Live streaming roll blocks */}
        {streaming && liveRolls.length > 0 && (
          <div className="dice-roll-area live" style={{ padding: '0 32px', maxWidth: '880px', width: '100%', margin: '0 auto' }}>
            {liveRolls.map((r, i) => <InlineDiceRoll key={i} roll={r} />)}
          </div>
        )}

        {/* Streaming GM text */}
        {streaming && streamBuffer && (
          <div className="message message-assistant streaming">
            <div className="message-label">GM</div>
            <div className="message-content">
              <ReactMarkdown>{streamBuffer}</ReactMarkdown>
              <span className="cursor" />
            </div>
          </div>
        )}
        {streaming && !streamBuffer && (
          <div className="message message-assistant">
            <div className="message-label">GM</div>
            <div className="message-content thinking"><span /><span /><span /></div>
          </div>
        )}

        {ending && (
          <div className="message message-assistant">
            <div className="message-label">GM</div>
            <div className="message-content thinking"><span /><span /><span /></div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {!sessionEnded && (
        <div className="input-row">
          <div className="input-area">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Describe your action… (Enter to send, Shift+Enter for newline)"
              rows={2}
              disabled={busy}
            />
            <button className="send-btn" onClick={send} disabled={busy || !input.trim()}>
              {streaming ? '…' : '→'}
            </button>
          </div>
        </div>
      )}

      {sessionEnded && (
        <div className="session-ended-bar">
          Session ended — recap available above.
        </div>
      )}

      {showEndConfirm && (
        <EndSessionConfirm
          onConfirm={handleEndSession}
          onCancel={() => setShowEndConfirm(false)}
        />
      )}

      {showRecap && (
        <RecapModal sessionId={session.id} onClose={() => setShowRecap(false)} />
      )}
    </div>
  );
}
