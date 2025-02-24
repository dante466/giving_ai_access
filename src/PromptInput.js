import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import './PromptInput.css';

const PromptInput = forwardRef(({ onSubmit }, ref) => {
  const defaultPrompt = 'You are an AI assistant viewing a desktop area. Make observations or answer queries based on the captured frame.';
  
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
    <div className="prompt-container">
      <label htmlFor="prompt-input" className="prompt-label">
        System Prompt:
      </label>
      <input
        id="prompt-input"
        type="text"
        value={prompt}
        onChange={handleChange}
        placeholder="Set the AI's system prompt (e.g., 'Critique my gameplay')"
        className="prompt-input"
      />
      <button onClick={handleSubmit} className="submit-button">
        Submit
      </button>
    </div>
  );
});

export default PromptInput;