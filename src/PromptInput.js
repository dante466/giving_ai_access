// BEGIN PromptInput.js
import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';

const PromptInput = forwardRef(({ onSubmit }, ref) => {
  const defaultPrompt = 'You are an AI assistant that is viewing a video output stream of the user\'s selected window/application/etc. Make observations about what you see.';
  
  const [prompt, setPrompt] = useState(() => {
    const savedPrompt = localStorage.getItem('system_prompt');
    return savedPrompt || defaultPrompt;
  });

  useEffect(() => {
    localStorage.setItem('system_prompt', prompt);
    console.log('System prompt updated and saved:', prompt);
  }, [prompt]);

  useImperativeHandle(ref, () => ({ 
    value: prompt,
  }));

  const handleChange = (e) => {
    setPrompt(e.target.value);
  };

  const handleSubmit = () => {
    console.log('Submitting system prompt:', prompt);
    onSubmit(prompt);
  };

  return (
    <div style={{ marginTop: '20px' }}>
      <label htmlFor="prompt-input" style={{ display: 'block', marginBottom: '5px', fontSize: '16px', fontWeight: 'bold' }}>
        System Prompt:
      </label>
      <input
        id="prompt-input"
        type="text"
        value={prompt}
        onChange={handleChange}
        placeholder="Set the AI's system prompt (e.g., 'Critique my gameplay')"
        style={{ width: '1000px', padding: '8px', fontSize: '16px' }}
      />
      <button
        onClick={handleSubmit}
        style={{ marginTop: '10px', padding: '8px 16px', fontSize: '16px' }}
      >
        Submit
      </button>
    </div>
  );
});

export default PromptInput;
// END PromptInput.js