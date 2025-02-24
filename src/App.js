import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import VideoStream from './VideoStream';
import PromptInput from './PromptInput';
import ConversationBox from './ConversationBox';
import useMemory from './memoryManager';
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import './App.css';
import './FileExplorer.css';
import './JsonViewer.css';

function App() {
  const [conversationHistory, setConversationHistory] = useState([]);
  const [fullConversationData, setFullConversationData] = useState([]);
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
  const [isFileExplorerOpen, setIsFileExplorerOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);
  const [isVideoFeedEnabled, setIsVideoFeedEnabled] = useState(true);
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
      console.log('Capture error:', err);
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
        console.log('BoundingBoxFrame updated:', dataUrl.substring(0, 50) + '...');

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

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const existingFileNames = new Set(uploadedFiles.map(file => file.name));
    const newFiles = files.filter(file => !existingFileNames.has(file.name));

    const filePromises = newFiles.map(file => 
      new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          const wordCount = content.split(/\s+/).length;
          const messageId = Date.now() + Math.random().toString(36).substr(2, 9);
          resolve({ name: file.name, content, tokenCount: wordCount, messageId });
        };
        reader.readAsText(file);
      })
    );

    Promise.all(filePromises).then(fileData => {
      if (fileData.length > 0) {
        setUploadedFiles(prev => [...prev, ...fileData]);
        const fileMessages = fileData.map(file => ({
          role: 'system',
          content: `File Uploaded: ${file.name}\nContent: ${file.content}`,
          id: file.messageId,
        }));
        setConversationHistory(prev => [...prev, ...fileMessages]);
        console.log('Uploaded files added to history:', fileData);
      } else {
        console.log('No new files added; duplicates ignored.');
      }
    });
  };

  const handleFileDelete = (fileName) => {
    const fileToDelete = uploadedFiles.find(file => file.name === fileName);
    if (!fileToDelete) return;

    const messageId = fileToDelete.messageId;
    setUploadedFiles(prev => prev.filter(file => file.name !== fileName));
    setConversationHistory(prev => {
      const updatedHistory = prev.filter(msg => msg.id !== messageId);
      console.log(`Deleted file message with ID ${messageId} from conversation history: ${fileName}`);
      return updatedHistory;
    });
    setFullConversationData(prev => prev.map(entry => ({
      ...entry,
      conversationHistory: entry.conversationHistory.filter(msg => msg.id !== messageId),
    })));
    console.log(`Deleted file with message ID ${messageId} from full conversation data: ${fileName}`);
  };

  const handlePrompt = async (systemPrompt, userPrompt, promptMode) => {
    let frameToSend = isVideoFeedEnabled ? (boundingBoxFrame || croppedFrame || latestFrame) : null;
    let usedFullFrame = false;

    // Removed the check that forces a frame or file upload
    // if (!frameToSend && uploadedFiles.length === 0) {
    //   setConversationHistory([...conversationHistory, { role: 'assistant', content: 'No frame or files available. Please select a video source or upload files.' }]);
    //   return;
    // }

    if (isVideoFeedEnabled && !boundingBoxFrame && !croppedFrame && latestFrame) {
      frameToSend = latestFrame;
      usedFullFrame = true;
      console.log('No bounding box set; defaulting to full video input:', frameToSend?.substring(0, 50) + '...');
    }

    const apiKey = selectedModel === 'gpt-4o' ? openAiApiKey : anthropicApiKey;
    if (!apiKey) {
      setConversationHistory([...conversationHistory, { role: 'assistant', content: `Please enter your ${selectedModel === 'gpt-4o' ? 'OpenAI' : 'Anthropic'} API key.` }]);
      return;
    }

    setConversationHistory(prev => [...prev, { role: 'user', content: userPrompt }]);
    setIsGeneratingResponse(true);
    setIsRequestPending(true);

    const relevantMemories = getRelevantMemories(userPrompt);
    console.log('Request pending set to true, using frame:', frameToSend?.substring(0, 50) + '...');

    const fullData = {
      systemPrompt,
      conversationHistory: [...conversationHistory, { role: 'user', content: userPrompt }],
      memories: relevantMemories,
      userPrompt,
      frame: frameToSend ? frameToSend.substring(0, 50) + '...' : null,
      usedFullFrame,
    };

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      {
        role: 'user',
        content: frameToSend ? [
          { type: 'text', text: `Memories: ${JSON.stringify(relevantMemories)}\n${userPrompt}${usedFullFrame ? '\n(Note: Using full video input as no bounding box is set)' : ''}` },
          { type: 'image_url', image_url: { url: frameToSend } },
        ] : [
          { type: 'text', text: `Memories: ${JSON.stringify(relevantMemories)}\n${userPrompt}` },
        ],
      },
    ];
    const totalLength = JSON.stringify(messages).length;
    console.log('Sending to OpenAI:', { messages, totalLength });

    try {
      let res;
      if (selectedModel === 'gpt-4o') {
        res = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          { model: 'gpt-4o', messages },
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
                content: frameToSend ? [
                  { type: 'text', text: `${systemPrompt}\nMemories: ${JSON.stringify(relevantMemories)}\n${userPrompt}${usedFullFrame ? '\n(Note: Using full video input as no bounding box is set)' : ''}` },
                  { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: frameToSend.split(',')[1] } },
                ] : [
                  { type: 'text', text: `${systemPrompt}\nMemories: ${JSON.stringify(relevantMemories)}\n${userPrompt}` },
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
      
      setConversationHistory(prev => [...prev, { role: 'assistant', content: llmResponse }]);
      setFullConversationData(prev => [...prev, { ...fullData, response: llmResponse }]);

      if (llmResponse.toLowerCase().includes('advice')) {
        saveMemory({ description: userPrompt, response: llmResponse });
      }
      if (isVoiceEnabled) {
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(llmResponse));
      }
    } catch (error) {
      console.error('API Error:', error.response?.data || error.message);
      setConversationHistory(prev => [...prev, { role: 'assistant', content: `Error: ${error.response?.data?.error?.message || error.message}` }]);
      setFullConversationData(prev => [...prev, { ...fullData, response: `Error: ${error.response?.data?.error?.message || error.message}` }]);
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

  const handleVideoFeedToggle = (e) => {
    const enabled = e.target.checked;
    setIsVideoFeedEnabled(enabled);
    console.log('Video feed enabled:', enabled);
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
    return <div className="loading-screen">Loading screen size...</div>;
  }

  return (
    <div className="app-container">
      <h1 className="app-header">
        Desktop AI Assistant {isBoundingBoxMode ? '(Bounding Box Mode)' : ''}
      </h1>
      <div className="app-content">
        <div className="video-section">
          <div className="video-feed-header">
            <h3 className="video-feed-title">Video Feed:</h3>
            <label>
              <input
                type="checkbox"
                checked={isVideoFeedEnabled}
                onChange={handleVideoFeedToggle}
              />
              Enable
            </label>
          </div>
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
            <div className="preview-container">
              <div className="preview-header">
                <h3 className="preview-title">Bounding Box Preview:</h3>
                <button
                  onClick={clearBoundingBoxPreview}
                  className="clear-button"
                  title="Clear Bounding Box Preview"
                >
                  X
                </button>
              </div>
              <img
                src={boundingBoxFrame}
                alt="Bounding Box Preview"
                className="preview-image"
                onClick={openLightbox}
              />
            </div>
          )}
        </div>
        <div className="conversation-section">
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
          <PromptInput onSubmit={(systemPrompt) => handlePrompt(mode === 'continuous' ? continuousPrompt : onDemandPrompt, 'manual')} ref={promptInputRef} />
        </div>
      </div>

      {/* Bottom Section */}
      <div className="app-bottom">
        {/* File Access Tool */}
        <div className="file-explorer-container">
          <div 
            className={`file-explorer-header ${isFileExplorerOpen ? 'open' : ''}`} 
            onClick={() => setIsFileExplorerOpen(!isFileExplorerOpen)}
          >
            <h3 className="file-explorer-title">File Access Tool</h3>
            <span className="file-explorer-arrow">{isFileExplorerOpen ? '▲' : '▼'}</span>
          </div>
          {isFileExplorerOpen && (
            <div className="file-explorer-content">
              <div className="file-upload-section">
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileUpload} 
                />
                <span className="file-count">{uploadedFiles.length} Files Selected</span>
              </div>
              {uploadedFiles.length === 0 ? (
                <p className="no-files-message">No files uploaded yet.</p>
              ) : (
                <div className="file-list">
                  {uploadedFiles.map((file, index) => (
                    <div key={index} className="file-item">
                      <div className="file-icon">📄</div>
                      <button
                        onClick={() => handleFileDelete(file.name)}
                        className="delete-button"
                        title={`Remove ${file.name}`}
                      >
                        -
                      </button>
                      <p className="file-name">{file.name}</p>
                      <p className="file-token-count">{file.tokenCount} tokens</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Full Conversation in JSON Tool */}
        <div className="json-viewer-container">
          <div 
            className={`json-viewer-header ${isJsonViewerOpen ? 'open' : ''}`} 
            onClick={() => setIsJsonViewerOpen(!isJsonViewerOpen)}
          >
            <h3 className="json-viewer-title">Full Conversation in JSON</h3>
            <span className="json-viewer-arrow">{isJsonViewerOpen ? '▲' : '▼'}</span>
          </div>
          {isJsonViewerOpen && (
            <div className="json-viewer-content">
              <JSONPretty 
                data={fullConversationData} 
                theme="monikai" 
                className="json-viewer"
              />
            </div>
          )}
        </div>

        <div className="api-section">
          <label className="api-label">Select Model:</label>
          <select
            value={selectedModel}
            onChange={handleModelChange}
            className="model-select"
          >
            <option value="gpt-4o">OpenAI GPT-4o</option>
            <option value="claude-sonnet">Claude Sonnet</option>
            <option value="claude-opus">Claude Opus</option>
          </select>
        </div>
        <div className="api-section">
          <label className="api-label">OpenAI API Key:</label>
          <input 
            value={openAiApiKey} 
            onChange={handleOpenAiApiKeyChange} 
            placeholder="Enter your OpenAI API key" 
            className="api-input"
          />
        </div>
        <div className="api-section">
          <label className="api-label">Anthropic API Key:</label>
          <input 
            value={anthropicApiKey} 
            onChange={handleAnthropicApiKeyChange} 
            placeholder="Enter your Anthropic API key" 
            className="api-input"
          />
        </div>
        <div className="voice-toggle">
          <label>
            <input type="checkbox" checked={isVoiceEnabled} onChange={(e) => setIsVoiceEnabled(e.target.checked)} /> 
            Enable Voice
          </label>
        </div>
      </div>

      {isLightboxOpen && (
        <div className="lightbox" onClick={closeLightbox}>
          <img
            src={boundingBoxFrame}
            alt="Full-size Bounding Box"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={closeLightbox}
            className="lightbox-close"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

export default App;