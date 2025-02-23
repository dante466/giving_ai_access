// BEGIN ConversationBox.js
import React, { useState, useEffect, useRef } from 'react';

const ConversationBox = ({ 
  history, 
  mode, 
  setMode, 
  onPromptSubmit, 
  continuousPrompt, 
  setContinuousPrompt, 
  onDemandPrompt, 
  setOnDemandPrompt, 
  isRequestPending 
}) => {
  const [isExpanded, setIsExpanded] = useState(true); // Default to expanded for modern chat feel
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const expandedRef = useRef(null);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  // Auto-scroll to bottom unless user is scrolling
  useEffect(() => {
    if (isExpanded && expandedRef.current && !isUserScrolling) {
      expandedRef.current.scrollTop = expandedRef.current.scrollHeight;
    }
  }, [history, isExpanded, isUserScrolling]);

  // Detect user scrolling
  const handleScroll = () => {
    if (isExpanded && expandedRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = expandedRef.current;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10; // 10px tolerance
      setIsUserScrolling(!isAtBottom);
    }
  };

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
    <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
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
            }}
          >
            Continuous
          </button>
        </div>
        <button
          onClick={toggleExpand}
          style={{ padding: '5px 10px', fontSize: '14px', backgroundColor: '#e9ecef', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {isExpanded && (
        <div
          ref={expandedRef}
          onScroll={handleScroll}
          style={{
            border: '1px solid #ccc',
            padding: '10px',
            backgroundColor: '#fff',
            flex: 1,
            overflowY: 'auto',
            maxWidth: '1000px',
            borderRadius: '5px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
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
                  maxWidth: '80%',
                  alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                  textAlign: message.role === 'user' ? 'right' : 'left',
                }}
              >
                <strong>{message.role === 'user' ? 'You: ' : 'AI: '}</strong>
                <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
              </div>
            ))
          )}
        </div>
      )}
      <form onSubmit={handleSubmit} style={{ marginTop: '10px' }}>
        <input
          type="text"
          value={mode === 'continuous' ? continuousPrompt : onDemandPrompt}
          onChange={handlePromptChange}
          placeholder={`Type your ${mode} prompt...`}
          style={{
            width: '100%',
            maxWidth: '1000px',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.1)',
            boxSizing: 'border-box',
            height: '40px', // Sentence height
            overflowX: 'auto', // Horizontal scroll for long text
            whiteSpace: 'nowrap', // Keeps it single-line with scrolling
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