// BEGIN ConversationBox.js
import React, { useEffect, useRef } from 'react';
import './ConversationBox.css';

const ConversationBox = ({ 
  history, 
  mode, 
  setMode, 
  onPromptSubmit, 
  continuousPrompt, 
  setContinuousPrompt, 
  onDemandPrompt, 
  setOnDemandPrompt, 
  isRequestPending,
  isGeneratingResponse,
  isGlobalHotkeyEnabled,
  handleGlobalHotkeyToggle
}) => {
  const conversationRef = useRef(null);

  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history, isGeneratingResponse]);

  const handlePromptChange = (e) => {
    if (mode === 'continuous') {
      setContinuousPrompt(e.target.value);
    } else {
      setOnDemandPrompt(e.target.value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const prompt = mode === 'continuous' ? continuousPrompt : onDemandPrompt;
    if (prompt.trim()) {
      onPromptSubmit(prompt);
      if (mode === 'on-demand') setOnDemandPrompt('');
    }
  };

  return (
    <div className="conversation-container">
      <div className="mode-header">
        <div className="mode-buttons">
          <label className="mode-label">Mode:</label>
          <button
            onClick={() => setMode('on-demand')}
            className={`mode-button mode-button-on-demand ${mode === 'on-demand' ? 'active' : ''}`}
          >
            On-Demand
          </button>
          <button
            onClick={() => setMode('continuous')}
            className={`mode-button mode-button-continuous ${mode === 'continuous' ? 'active' : ''}`}
            disabled
          >
            Continuous
          </button>
        </div>
        <label className="hotkey-toggle">
          <input
            type="checkbox"
            checked={isGlobalHotkeyEnabled}
            onChange={handleGlobalHotkeyToggle}
          />
          <span dangerouslySetInnerHTML={{ __html: 'Activate Bounding Box Mode Hotkey <b>`</b>' }} />
        </label>
      </div>
      <div ref={conversationRef} className="conversation-box">
        {history.length === 0 && !isGeneratingResponse ? (
          <div className="empty-conversation">
            Start a conversation...
          </div>
        ) : (
          <>
            {history.map((message, index) => (
              <div
                key={index}
                className={`message ${message.role === 'user' ? 'message-user' : 'message-ai'}`}
              >
                <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
                <span>{message.content}</span>
              </div>
            ))}
            {isGeneratingResponse && (
              <div className="loading-message">
                <strong>AI: </strong>
                <span className="loading-dots">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            )}
          </>
        )}
      </div>
      <form onSubmit={handleSubmit} className="prompt-form">
        <input
          type="text"
          value={mode === 'continuous' ? continuousPrompt : onDemandPrompt}
          onChange={handlePromptChange}
          placeholder={`Type your ${mode} prompt...`}
          className="prompt-input"
        />
        {mode === 'on-demand' && (
          <button
            type="submit"
            disabled={isRequestPending || !onDemandPrompt.trim()}
            className="submit-button"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
};

export default ConversationBox;
// END ConversationBox.js