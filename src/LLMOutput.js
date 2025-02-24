import React from 'react';
import './LLMOutput.css';

const LLMOutput = ({ response }) => (
  <div className="llm-output-container">
    <h3 className="llm-output-title">AI Response:</h3>
    <p className="llm-output-text">
      {response || 'Waiting for your prompt...'}
    </p> 
  </div>
);

export default LLMOutput;