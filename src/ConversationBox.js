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
  isGeneratingResponse,
  isGlobalHotkeyEnabled,
  handleGlobalHotkeyToggle
}) => {
  const conversationRef = useRef(null);

  // Auto-scroll to bottom
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
          <span dangerouslySetInnerHTML={{ __html: 'Activate Bounding Box Mode Hotkey <b>`</b>' }} />
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
          width: '100%',
        }}
      >
        {history.length === 0 && !isGeneratingResponse ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            Start a conversation...
          </div>
        ) : (
          <React.Fragment>
            {history.map((message, index) => (
              <div
                key={index}
                style={{
                  margin: '10px 0',
                  padding: '10px',
                  backgroundColor: message.role === 'user' ? '#f1f3f5' : '#e9ecef',
                  borderRadius: '5px',
                  width: '70%',
                  float: message.role === 'user' ? 'right' : 'left',
                  textAlign: message.role === 'user' ? 'right' : 'left',
                  clear: 'both',
                }}
              >
                <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
              </div>
            ))}
            {isGeneratingResponse && (
              <div
                style={{
                  margin: '10px 0',
                  padding: '10px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '5px',
                  width: '70%',
                  float: 'left',
                  textAlign: 'left',
                  clear: 'both',
                }}
              >
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
          </React.Fragment>
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

      {/* Inline CSS for the loading animation */}
      <style>{`
        .loading-dots {
          display: inline-block;
          font-size: 16px;
          letter-spacing: 2px;
        }
        .loading-dots span {
          animation: bounce 1s infinite;
          display: inline-block;
        }
        .loading-dots span:nth-child(1) { animation-delay: 0s; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        .loading-dots span:nth-child(4) { animation-delay: 0.6s; }
        .loading-dots span:nth-child(5) { animation-delay: 0.8s; }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

export default ConversationBox;
// END ConversationBox.js