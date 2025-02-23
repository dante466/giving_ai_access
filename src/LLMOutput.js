// BEGIN LLMOutput.js
import React from 'react';

const LLMOutput = ({ response }) => (
  <div style={{ marginBottom: '20px' }}>
    <h3 style={{ fontSize: '20px', marginBottom: '10px' }}>AI Response:</h3>
    <p
      style={{
        whiteSpace: 'pre-wrap',
        border: '2px solid #333',
        padding: '10px',
        fontSize: '16px',
        backgroundColor: '#f9f9f9',
        minHeight: '100px',
        maxWidth: '1000px',
      }}
    >
      {response || 'Waiting for your prompt...'}
    </p> 
  </div>
);
 
export default LLMOutput;
// END LLMOutput.js