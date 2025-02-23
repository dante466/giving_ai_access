// BEGIN ConversationBox.js
import React, { useEffect, useRef } from 'react';

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
  isGlobalHotkeyEnabled,
  handleGlobalHotkeyToggle
}) => {
  const conversationRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [history]);

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
      if (mode === 'on-demand') setOnDemandPrompt(''); // Clear only for on-demand
    }
  };

  return (
    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ float: 'left', display: 'flex', gap: '10px' }}>
          <label style={{ fontSize: '14px', fontWeight: 'bold' }}>Mode:</label>
          <button
            onClick={() => setMode('on-demand')}
            style={{
              padding: '5px 10px',
              backgroundColor: mode === 'on-demand' ? '#007bff' : '#e9ecef',
              color: mode === 'on-demand' ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
          >
            On-Demand
          </button>
          <button
            onClick={() => setMode('continuous')}
            style={{
              padding: '5px 10px',
              backgroundColor: mode === 'continuous' ? '#007bff' : '#e9ecef',
              color: mode === 'continuous' ? '#fff' : '#000',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'line-through',
            }}
            disabled
          >
            Continuous
          </button>
        </div>
        <label style={{ float: 'right', fontSize: '14px' }}>
          <input
            type="checkbox"
            checked={isGlobalHotkeyEnabled}
            onChange={handleGlobalHotkeyToggle}
          />
          <span dangerouslySetInnerHTML={{ __html: '<b>`</b> Hotkey' }} />
        </label>
      </div>
      <div
        ref={conversationRef}
        style={{
          border: '1px solid #ccc',
          padding: '10px',
          backgroundColor: '#fff',
          flex: 1,
          overflowY: 'auto',
          borderRadius: '5px',
          boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
          width: '100%', // Ensure it takes full width
        }}
      >
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            Start a conversation...
          </div>
        ) : (
          history.map((message, index) => (
            <div
              key={index}
              style={{
                margin: '10px 0',
                padding: '10px',
                backgroundColor: message.role === 'user' ? '#f1f3f5' : '#e9ecef',
                borderRadius: '5px',
                width: '70%', // 70% of container width
                float: message.role === 'user' ? 'right' : 'left', // Float right for user, left for AI
                textAlign: message.role === 'user' ? 'right' : 'left',
                clear: 'both', // Prevent overlap with previous messages
              }}
            >
              <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
              <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ marginTop: '10px' }}>
        <input
          type="text"
          value={mode === 'continuous' ? continuousPrompt : onDemandPrompt}
          onChange={handlePromptChange}
          placeholder={`Type your ${mode} prompt...`}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            boxSizing: 'border-box',
            height: '40px',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        />
        {mode === 'on-demand' && (
          <button
            type="submit"
            disabled={isRequestPending || !onDemandPrompt.trim()}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#007bff',
              color: '#fff',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer',
              fontSize: '14px',
            }}
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