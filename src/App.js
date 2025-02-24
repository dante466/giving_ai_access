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
    window.electronAPI.on('log', () => {});
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
        console.log('Screen size fetched: Width=' + size.width + ', Height=' + size.height);
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

    window.electronAPI.on('log', (label, data) => {
      console.log(label + ':');
      console.log('  Bounding Box (overlay): x=' + data.boundingBox.x + ', y=' + data.boundingBox.y + 
                  ', width=' + data.boundingBox.width + ', height=' + data.boundingBox.height);
      console.log('  Capture Area (display): x=' + data.captureArea.x + ', y=' + data.captureArea.y + 
                  ', width=' + data.captureArea.width + ', height=' + data.captureArea.height);
      console.log('  Metadata: cursor=(' + data.metadata.cursor.x + ', ' + data.metadata.cursor.y + 
                  '), overlayOrigin=(' + data.metadata.overlayOrigin.x + ', ' + data.metadata.overlayOrigin.y + 
                  '), displayBounds=(' + data.metadata.display.bounds.x + ', ' + data.metadata.display.bounds.y + 
                  ', ' + data.metadata.display.bounds.width + ', ' + data.metadata.display.bounds.height + 
                  '), scaleFactor=' + data.metadata.display.scaleFactor);
    });

    window.electronAPI.on('perform-capture', async (captureParams) => {
      console.log('=== Starting perform-capture handler ===');
      try {
        const sources = await window.electronAPI.getDesktopSources();
        const source = sources.find(s => s.id === captureParams.sourceId);
        if (!source) throw new Error(`Source not found: ${captureParams.sourceId}`);

        console.log('Selected source ID:', captureParams.sourceId);
        console.log('Requested displayWidth:', captureParams.displayWidth, 'displayHeight:', captureParams.displayHeight);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              minWidth: captureParams.displayWidth,
              maxWidth: captureParams.displayWidth,
              minHeight: captureParams.displayHeight,
              maxHeight: captureParams.displayHeight,
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
        console.log('Actual video dimensions: width=' + video.videoWidth + ', height=' + video.videoHeight);

        const scaleX = video.videoWidth / captureParams.displayWidth;
        const scaleY = video.videoHeight / captureParams.displayHeight;
        const scaledX = captureParams.x * scaleX;
        const scaledY = captureParams.y * scaleY;
        const captureWidth = captureParams.width * scaleX;
        const captureHeight = captureParams.height * scaleY;

        const finalX = Math.max(0, Math.min(scaledX, video.videoWidth - captureWidth));
        const finalY = Math.max(0, Math.min(scaledY, video.videoHeight - captureHeight));

        const outputScaleFactor = 2;
        const outputWidth = captureParams.width * outputScaleFactor;
        const outputHeight = captureParams.height * outputScaleFactor;

        console.log('Capture Coordinate Validation:');
        console.log('  Requested (from Main.js): x=' + captureParams.x + ', y=' + captureParams.y + ', width=' + captureParams.width + ', height=' + captureParams.height);
        console.log('  Scaled for capture: x=' + scaledX + ', y=' + scaledY + ', width=' + captureWidth + ', height=' + captureHeight);
        console.log('  Actual (clamped for capture): x=' + finalX + ', y=' + finalY + ', width=' + captureWidth + ', height=' + captureHeight);
        console.log('  Output dimensions: width=' + outputWidth + ', height=' + outputHeight);
        console.log('  Video dimensions: width=' + video.videoWidth + ', height=' + video.videoHeight);

        const canvas = document.createElement('canvas');
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const ctx = canvas.getContext('2d');

        ctx.drawImage(video, finalX, finalY, captureWidth, captureHeight, 0, 0, outputWidth, outputHeight);

        const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
        const data = imageData.data;
        const sharpenedData = applySharpening(data, outputWidth, outputHeight);
        ctx.putImageData(new ImageData(sharpenedData, outputWidth, outputHeight), 0, 0);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        console.log('Bounding box frame captured: ' + dataUrl.substring(0, 50) + '...');

        setBoundingBox({ x: finalX, y: finalY, width: captureWidth, height: captureHeight });
        setBoundingBoxFrame(dataUrl);

        if (isVideoFeedEnabled) {
          setIsVideoFeedEnabled(false);
          console.log('Video feed disabled after bounding box capture');
        }

        if (captureParams.mode === 'on-demand') {
          stream.getTracks().forEach(track => track.stop());
        } else if (captureParams.mode === 'continuous') {
          const interval = setInterval(() => {
            ctx.drawImage(video, finalX, finalY, captureWidth, captureHeight, 0, 0, outputWidth, outputHeight);
            const continuousImageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
            const continuousData = continuousImageData.data;
            const continuousSharpened = applySharpening(continuousData, outputWidth, outputHeight);
            ctx.putImageData(new ImageData(continuousSharpened, outputWidth, outputHeight), 0, 0);
            const newDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            setBoundingBoxFrame(newDataUrl);
          }, 2000);
          window.electronAPI.on('disable-bounding-box', () => {
            clearInterval(interval);
            stream.getTracks().forEach(track => track.stop());
          });
        }
        console.log('=== Perform-capture handler completed ===');
      } catch (err) {
        console.error('Capture failed:', err);
        setConversationHistory(prev => [...prev, { role: 'assistant', content: `Capture error: ${err.message}` }]);
      }
    });

    window.electronAPI.on('reset-state', () => {
      console.log('Resetting app state on reload');
      setLatestFrame(null);
      if (!boundingBoxFrame) setBoundingBoxFrame(null);
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

  const applySharpening = (data, width, height) => {
    const sharpened = new Uint8ClampedArray(data.length);
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    const kernelSum = 1;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let r = 0, g = 0, b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4;
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            r += data[idx] * weight;
            g += data[idx + 1] * weight;
            b += data[idx + 2] * weight;
          }
        }
        const outIdx = (y * width + x) * 4;
        sharpened[outIdx] = Math.min(255, Math.max(0, r / kernelSum));
        sharpened[outIdx + 1] = Math.min(255, Math.max(0, g / kernelSum));
        sharpened[outIdx + 2] = Math.min(255, Math.max(0, b / kernelSum));
        sharpened[outIdx + 3] = data[outIdx + 3];
      }
    }
    for (let x = 0; x < width; x++) {
      const topIdx = x * 4;
      const bottomIdx = ((height - 1) * width + x) * 4;
      for (let i = 0; i < 4; i++) {
        sharpened[topIdx + i] = data[topIdx + i];
        sharpened[bottomIdx + i] = data[bottomIdx + i];
      }
    }
    for (let y = 0; y < height; y++) {
      const leftIdx = (y * width) * 4;
      const rightIdx = (y * width + width - 1) * 4;
      for (let i = 0; i < 4; i++) {
        sharpened[leftIdx + i] = data[leftIdx + i];
        sharpened[rightIdx + i] = data[rightIdx + i];
      }
    }
    return sharpened;
  };

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
      const outputScaleFactor = 2;
      canvas.width = box.width * outputScaleFactor;
      canvas.height = box.height * outputScaleFactor;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width * outputScaleFactor, box.height * outputScaleFactor);
      const imageData = ctx.getImageData(0, 0, box.width * outputScaleFactor, box.height * outputScaleFactor);
      const sharpenedData = applySharpening(imageData.data, box.width * outputScaleFactor, box.height * outputScaleFactor);
      ctx.putImageData(new ImageData(sharpenedData, box.width * outputScaleFactor, box.height * outputScaleFactor), 0, 0);
      const cropped = canvas.toDataURL('image/jpeg', 0.9);
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
    console.log('Frame states before sending:', { boundingBoxFrame, croppedFrame, latestFrame, isVideoFeedEnabled });
    let frameToSend = null;
    let usedFullFrame = false;

    if (isVideoFeedEnabled) {
      frameToSend = latestFrame || croppedFrame; // Prefer latestFrame from video source
      if (frameToSend === latestFrame) {
        usedFullFrame = true;
        console.log('Video feed enabled; using latest video source frame:', frameToSend?.substring(0, 50) + '...');
      } else if (frameToSend === croppedFrame) {
        console.log('Video feed enabled; using cropped frame:', frameToSend?.substring(0, 50) + '...');
      }
    } else if (boundingBoxFrame) {
      frameToSend = boundingBoxFrame;
      console.log('Video feed disabled, using existing bounding box frame:', frameToSend?.substring(0, 50) + '...');
    } else {
      console.log('Video feed disabled and no bounding box frame; sending prompt without image');
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
          { type: 'text', text: `Memories: ${JSON.stringify(relevantMemories)}\n${userPrompt}${usedFullFrame ? '\n(Note: Using full video input)' : ''}` },
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
                  { type: 'text', text: `${systemPrompt}\nMemories: ${JSON.stringify(relevantMemories)}\n${userPrompt}${usedFullFrame ? '\n(Note: Using full video input)' : ''}` },
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
    if (enabled && boundingBoxFrame) {
      setBoundingBoxFrame(null);
      setBoundingBox(null);
      console.log('Cleared bounding box preview since video feed was enabled');
    }
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
    if (window.confirm('Clear the current bounding box preview?')) {
      console.log('Clearing bounding box preview');
      setBoundingBoxFrame(null);
      setBoundingBox(null);
    }
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

      <div className="app-bottom">
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