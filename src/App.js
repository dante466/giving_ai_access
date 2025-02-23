import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import VideoStream from './VideoStream';
import PromptInput from './PromptInput';
import ConversationBox from './ConversationBox';
import useMemory from './memoryManager';

function App() {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [latestFrame, setLatestFrame] = useState(null);
  const [boundingBoxFrame, setBoundingBoxFrame] = useState(null);
  const [openAiApiKey, setOpenAiApiKey] = useState('');
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [continuousPrompt, setContinuousPrompt] = useState('');
  const [onDemandPrompt, setOnDemandPrompt] = useState('');
  const [isRequestPending, setIsRequestPending] = useState(false);
  const [isGeneratingResponse, setIsGeneratingResponse] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isBoundingBoxMode, setIsBoundingBoxMode] = useState(false);
  const [boundingBox, setBoundingBox] = useState(null);
  const [croppedFrame, setCroppedFrame] = useState(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [isGlobalHotkeyEnabled, setIsGlobalHotkeyEnabled] = useState(true);
  const { saveMemory, getRelevantMemories } = useMemory();
  const continuousInterval = useRef(null);
  const promptInputRef = useRef(null);
  const [mode, setMode] = useState('on-demand');
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [isLoadingScreenSize, setIsLoadingScreenSize] = useState(true);

  const removeListeners = () => {
    console.log('Removing IPC listeners');
    window.electronAPI.on('captured-frame', () => {});
    window.electronAPI.on('capture-error', () => {});
    window.electronAPI.on('disable-bounding-box', () => {});
    window.electronAPI.on('toggle-bounding-box', () => {});
    window.electronAPI.on('perform-capture', () => {});
    window.electronAPI.on('reset-state', () => {});
  };

  useEffect(() => {
    const savedOpenAiKey = localStorage.getItem('openai_api_key');
    const savedAnthropicKey = localStorage.getItem('anthropic_api_key');
    if (savedOpenAiKey) setOpenAiApiKey(savedOpenAiKey);
    if (savedAnthropicKey) setAnthropicApiKey(savedAnthropicKey);

    const fetchScreenSize = async () => {
      try {
        const size = await window.electronAPI.getScreenSize();
        if (!size || size.width <= 0 || size.height <= 0) throw new Error('Invalid screen size');
        setScreenSize(size);
        console.log('Screen size fetched:', size);
      } catch (err) {
        console.error('Error fetching screen size:', err);
        setScreenSize({ width: 3440, height: 1440 });
      } finally {
        setIsLoadingScreenSize(false);
      }
    };
    fetchScreenSize();

    window.electronAPI.send('toggle-global-hotkey', true);

    removeListeners();

    window.electronAPI.on('captured-frame', (frame) => {
      console.log('Captured frame received:', frame.substring(0, 50) + '...');
      setLatestFrame(frame);
      setCroppedFrame(frame);
    });

    window.electronAPI.on('capture-error', (err) => {
      setConversationHistory(prev => [...prev, { role: 'assistant', content: `Capture error: ${err}` }]);
    });

    window.electronAPI.on('disable-bounding-box', () => {
      console.log('Disabling bounding box mode from overlay');
      setIsBoundingBoxMode(false);
      setBoundingBox(null);
      setBoundingBoxFrame(null);
      window.electronAPI.toggleOverlay(false);
    });

    window.electronAPI.on('toggle-bounding-box', () => {
      setIsBoundingBoxMode((prev) => {
        const newMode = !prev;
        console.log('Toggling bounding box mode:', newMode, 'with mode:', mode);
        window.electronAPI.toggleOverlay(newMode);
        if (newMode) {
          window.electronAPI.startBoundingBox(mode);
        }
        return newMode;
      });
    });

    window.electronAPI.on('perform-capture', async ({ sourceId, x, y, width, height, mode, displayWidth, displayHeight }) => {
      try {
        const sources = await window.electronAPI.getDesktopSources();
        const source = sources.find(s => s.id === sourceId);
        if (!source) throw new Error(`Source not found: ${sourceId}`);

        console.log('Capture params:', { sourceId, x, y, width, height, mode, displayWidth, displayHeight });

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: displayWidth,
              maxWidth: displayWidth,
              minHeight: displayHeight,
              maxHeight: displayHeight,
            },
          },
        });

        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise(resolve => {
          video.oncanplay = () => {
            console.log('Video can play');
            resolve();
          };
        });
        await video.play();
        console.log('Stream video dimensions:', video.videoWidth, video.videoHeight);

        const adjustedX = Math.max(0, Math.min(x, video.videoWidth - width));
        const adjustedY = Math.max(0, Math.min(y, video.videoHeight - height));
        console.log('Adjusted capture coordinates:', { adjustedX, adjustedY, width, height });

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, adjustedX, adjustedY, width, height, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        console.log('Bounding box frame captured:', dataUrl.substring(0, 50) + '...');

        console.log('Capture coordinates before adjustment:', { x, y, width, height });
        setBoundingBox({ x: adjustedX, y: adjustedY, width, height });
        console.log('Bounding box set:', { x: adjustedX, y: adjustedY, width, height });
        setBoundingBoxFrame(dataUrl);
        console.log('Preview should display with boundingBoxFrame:', dataUrl.substring(0, 50) + '...');

        if (mode === 'on-demand') {
          stream.getTracks().forEach(track => track.stop());
        } else if (mode === 'continuous') {
          const interval = setInterval(() => {
            ctx.drawImage(video, adjustedX, adjustedY, width, height, 0, 0, width, height);
            const newDataUrl = canvas.toDataURL('image/jpeg', 0.5);
            setBoundingBoxFrame(newDataUrl);
            console.log('Continuous bounding box frame updated:', newDataUrl.substring(0, 50) + '...');
          }, 2000);
          window.electronAPI.on('disable-bounding-box', () => {
            clearInterval(interval);
            stream.getTracks().forEach(track => track.stop());
          });
        }
      } catch (err) {
        console.error('Capture failed:', err);
        setConversationHistory(prev => [...prev, { role: 'assistant', content: `Capture error: ${err.message}` }]);
      }
    });

    window.electronAPI.on('reset-state', () => {
      console.log('Resetting app state on reload');
      setLatestFrame(null);
      setBoundingBoxFrame(null);
      setBoundingBox(null);
      setIsBoundingBoxMode(false);
      window.electronAPI.toggleOverlay(false);
    });

    return () => {
      removeListeners();
      window.electronAPI.toggleOverlay(false);
      if (continuousInterval.current) clearInterval(continuousInterval.current);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'continuous' || !continuousPrompt.trim() || !boundingBox) {
      if (continuousInterval.current) clearInterval(continuousInterval.current);
      return;
    }

    const apiKey = selectedModel === 'gpt-4o' ? openAiApiKey : anthropicApiKey;
    if (!apiKey || isRequestPending) return;

    continuousInterval.current = setInterval(() => {
      if (isRequestPending) return;
      const systemPrompt = getPromptInputValue();
      handlePrompt(systemPrompt, continuousPrompt, 'continuous');
    }, 2000);

    return () => continuousInterval.current && clearInterval(continuousInterval.current);
  }, [mode, continuousPrompt, selectedModel, openAiApiKey, anthropicApiKey, isRequestPending, boundingBox]);

  const handleFrame = (frame) => {
    setLatestFrame(frame);
    if (boundingBox && mode === 'continuous' && continuousPrompt.trim() && !boundingBoxFrame) {
      cropFrame(frame, boundingBox);
    }
  };

  const cropFrame = (frame, box) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = box.width;
      canvas.height = box.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
      const cropped = canvas.toDataURL('image/jpeg', 0.5);
      setCroppedFrame(cropped);
    };
    img.src = frame;
  };

  const handlePrompt = async (systemPrompt, userPrompt, promptMode) => {
    let frameToSend = boundingBoxFrame || croppedFrame || latestFrame;
    let usedFullFrame = false;

    if (!frameToSend) {
      setConversationHistory([...conversationHistory, { role: 'assistant', content: 'No frame available yet. Please ensure a video source is selected.' }]);
      return;
    }

    if (!boundingBoxFrame && !croppedFrame && latestFrame) {
      frameToSend = latestFrame;
      usedFullFrame = true;
      console.log('No bounding box set; defaulting to full video input:', frameToSend.substring(0, 50) + '...');
    }

    const apiKey = selectedModel === 'gpt-4o' ? openAiApiKey : anthropicApiKey;
    if (!apiKey) {
      setConversationHistory([...conversationHistory, { role: 'assistant', content: `Please enter your ${selectedModel === 'gpt-4o' ? 'OpenAI' : 'Anthropic'} API key.` }]);
      return;
    }

    // Add user message immediately and set loading state
    setConversationHistory([...conversationHistory, { role: 'user', content: userPrompt }]);
    setIsGeneratingResponse(true);
    setIsRequestPending(true);
    console.log('Request pending set to true, using frame:', frameToSend.substring(0, 50) + '...');
    const relevantMemories = getRelevantMemories(userPrompt);

    try {
      let res;
      if (selectedModel === 'gpt-4o') {
        res = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              ...conversationHistory,
              {
                role: 'user',
                content: [
                  { type: 'text', text: `Memories: ${JSON.stringify(relevantMemories)}\nUser Prompt: ${userPrompt}${usedFullFrame ? '\n(Note: Using full video input as no bounding box is set)' : ''}` },
                  { type: 'image_url', image_url: { url: frameToSend } },
                ],
              },
            ],
          },
          { headers: { Authorization: `Bearer ${openAiApiKey}` } }
        );
      } else {
        res = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: selectedModel === 'claude-sonnet' ? 'claude-3-sonnet-20240229' : 'claude-3-opus-20240229',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: `${systemPrompt}\nMemories: ${JSON.stringify(relevantMemories)}\nUser Prompt: ${userPrompt}${usedFullFrame ? '\n(Note: Using full video input as no bounding box is set)' : ''}` },
                  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameToSend.split(',')[1] } },
                ],
              },
            ],
          },
          {
            headers: {
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
          }
        );
      }

      const llmResponse = selectedModel === 'gpt-4o' ? res.data.choices[0].message.content : res.data.content[0].text;
      console.log('LLM response:', llmResponse);
      setConversationHistory(prev => [
        ...prev,
        { role: 'assistant', content: llmResponse },
      ]);
      if (llmResponse.toLowerCase().includes('advice')) {
        saveMemory({ description: userPrompt, response: llmResponse });
      }
      if (isVoiceEnabled) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(llmResponse));
      }
    } catch (error) {
      setConversationHistory(prev => [...prev, { role: 'assistant', content: `Error: ${error.response?.data?.error?.message || error.message}` }]);
    } finally {
      setIsGeneratingResponse(false);
      setIsRequestPending(false);
      console.log('Request pending reset to false');
    }
  };

  const handleOpenAiApiKeyChange = (e) => {
    const newKey = e.target.value;
    setOpenAiApiKey(newKey);
    localStorage.setItem('openai_api_key', newKey);
  };

  const handleAnthropicApiKeyChange = (e) => {
    const newKey = e.target.value;
    setAnthropicApiKey(newKey);
    localStorage.setItem('anthropic_api_key', newKey);
  };

  const handleModelChange = (e) => {
    setSelectedModel(e.target.value);
    console.log('Selected model:', e.target.value);
  };

  const handlePromptSubmit = (prompt) => {
    console.log('Prompt submitted:', { mode, prompt, boundingBox, isBoundingBoxMode });
    if (mode === 'on-demand' && prompt.trim()) {
      if (boundingBox && !isBoundingBoxMode && !boundingBoxFrame) {
        console.log('Submitting on-demand prompt with bounding box to capture new frame:', prompt);
        window.electronAPI.captureArea(boundingBox, 'on-demand');
      } else if (boundingBoxFrame) {
        console.log('Using existing boundingBoxFrame for prompt:', prompt);
      } else {
        console.log('Submitting on-demand prompt with full video input:', prompt);
      }
      const systemPrompt = getPromptInputValue();
      handlePrompt(systemPrompt, prompt, 'on-demand');
    } else if (mode === 'continuous') {
      handlePrompt(prompt, 'continuous');
    }
  };

  const handleGlobalHotkeyToggle = (e) => {
    const enabled = e.target.checked;
    setIsGlobalHotkeyEnabled(enabled);
    window.electronAPI.send('toggle-global-hotkey', enabled);
  };

  const getPromptInputValue = () => promptInputRef.current?.value || 'You are an AI assistant viewing a desktop area. Make observations or answer queries based on the captured frame.';

  const openLightbox = () => {
    if (boundingBoxFrame) {
      setIsLightboxOpen(true);
    }
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
  };

  const clearBoundingBoxPreview = () => {
    console.log('Clearing bounding box preview');
    setBoundingBoxFrame(null);
    setBoundingBox(null);
  };

  if (isLoadingScreenSize) {
    return <div>Loading screen size...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        Desktop AI Assistant {isBoundingBoxMode ? '(Bounding Box Mode)' : ''}
      </h1>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ marginRight: '20px', width: '300px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '16px', marginBottom: '5px' }}>Video Feed:</h3>
          <VideoStream 
            onFrame={handleFrame} 
            isBoundingBoxMode={isBoundingBoxMode} 
            onBoundingBoxDrawn={(box) => {
              console.log('Bounding box drawn in VideoStream:', box);
              setBoundingBox(box);
              if (latestFrame) cropFrame(latestFrame, box);
            }} 
          />
          {boundingBoxFrame && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '5px' }}>Bounding Box Preview:</h3>
                <button
                  onClick={clearBoundingBoxPreview}
                  style={{
                    fontSize: '16px',
                    padding: '2px 8px',
                    backgroundColor: '#ff4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '3px',
                    cursor: 'pointer',
                  }}
                  title="Clear Bounding Box Preview"
                >
                  X
                </button>
              </div>
              <img
                src={boundingBoxFrame}
                alt="Bounding Box Preview"
                style={{ width: '100%', border: '2px solid #333', objectFit: 'contain', cursor: 'pointer' }}
                onClick={openLightbox}
              />
            </div>
          )}
        </div>
        <ConversationBox 
          history={conversationHistory}
          mode={mode}
          setMode={setMode}
          onPromptSubmit={handlePromptSubmit}
          continuousPrompt={continuousPrompt}
          setContinuousPrompt={setContinuousPrompt}
          onDemandPrompt={onDemandPrompt}
          setOnDemandPrompt={setOnDemandPrompt}
          isRequestPending={isRequestPending}
          isGeneratingResponse={isGeneratingResponse}
          isGlobalHotkeyEnabled={isGlobalHotkeyEnabled}
          handleGlobalHotkeyToggle={handleGlobalHotkeyToggle}
        />
      </div>
      <div style={{ marginTop: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Select Model:</label>
        <select
          value={selectedModel}
          onChange={handleModelChange}
          style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }}
        >
          <option value="gpt-4o">OpenAI GPT-4o</option>
          <option value="claude-sonnet">Claude Sonnet</option>
          <option value="claude-opus">Claude Opus</option>
        </select>
      </div>
      <div style={{ marginTop: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>OpenAI API Key:</label>
        <input 
          value={openAiApiKey} 
          onChange={handleOpenAiApiKeyChange} 
          placeholder="Enter your OpenAI API key" 
          style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} 
        />
      </div>
      <div style={{ marginTop: '10px' }}>
        <label style={{ display: 'block', marginBottom: '5px' }}>Anthropic API Key:</label>
        <input 
          value={anthropicApiKey} 
          onChange={handleAnthropicApiKeyChange} 
          placeholder="Enter your Anthropic API key" 
          style={{ width: '100%', padding: '8px', borderRadius: '5px', border: '1px solid #ccc' }} 
        />
      </div>
      <div style={{ marginTop: '10px' }}>
        <label>
          <input type="checkbox" checked={isVoiceEnabled} onChange={(e) => setIsVoiceEnabled(e.target.checked)} /> 
          Enable Voice
        </label>
      </div>
      <PromptInput onSubmit={(systemPrompt) => handlePrompt(mode === 'continuous' ? continuousPrompt : onDemandPrompt, 'manual')} ref={promptInputRef} />

      {isLightboxOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%', 
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
          }}
          onClick={closeLightbox}
        >
          <img
            src={boundingBoxFrame}
            alt="Full-size Bounding Box"
            style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={closeLightbox}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '5px 10px',
              backgroundColor: '#fff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;