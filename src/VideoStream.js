import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import './VideoStream.css';

const VideoStream = memo(({ onFrame = () => {}, isBoundingBoxMode, onBoundingBoxDrawn }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(document.createElement('canvas'));
  const containerRef = useRef(null);
  const [stream, setStream] = useState(null); 
  const [error, setError] = useState(null);
  const [sources, setSources] = useState([]);
  const [selectedSource, setSelectedSource] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [dragStart, setDragStart] = useState(null);
  const [dragBox, setDragBox] = useState(null);
  const streamRef = useRef(null);

  const startStream = useCallback(async () => {
    if (!selectedSource || error) return;

    if (streamRef.current) {
      console.log('Stopping existing stream');
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    console.log('Starting stream for:', selectedSource);
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource } },
      });
      streamRef.current = newStream;
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          const { videoWidth, videoHeight } = videoRef.current;
          console.log('Video dimensions:', videoWidth, 'x', videoHeight);
          setVideoSize({ width: videoWidth, height: videoHeight });
        };
        videoRef.current.play().catch(err => console.error('Initial play error:', err));
        console.log('Stream active');
      }
    } catch (err) {
      setError(`Stream error: ${err.message}`);
      console.error('Stream failed:', err);
    }
  }, [selectedSource, error]);

  useEffect(() => {
    console.log('Requesting sources...');
    window.electronAPI.send('get-sources');
    window.electronAPI.on('source-list', (sourceList) => {
      console.log('Sources received:', sourceList);
      setIsLoading(false);
      if (sourceList.length === 0) {
        setError('No sources available—check permissions.');
      } else {
        setSources(sourceList);
        setSelectedSource(sourceList[0].id);
      }
    });

    return () => {
      if (streamRef.current) {
        console.log('Cleaning up stream on unmount');
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    startStream();
  }, [startStream]);

  useEffect(() => {
    if (!stream || error) return;

    const interval = setInterval(() => {
      const video = videoRef.current;
      if (video && video.videoWidth) {
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth / 4;
        canvas.height = video.videoHeight / 4;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.5);
        onFrame(frame);
      } else {
        console.log('Video not ready:', video ? 'No dimensions' : 'No video element');
      }
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [stream, error, onFrame]);

  useEffect(() => {
    console.log('Bounding box mode changed:', isBoundingBoxMode);
    if (stream && videoRef.current) {
      const video = videoRef.current;
      console.log('Video srcObject exists:', !!video.srcObject, 'Paused:', video.paused);
      if (!video.srcObject) {
        console.log('Reattaching stream to video element');
        video.srcObject = stream;
      }
      if (video.paused) {
        console.log('Restarting video playback');
        video.play().catch(err => console.error('Mode change play error:', err));
      }
    }
  }, [isBoundingBoxMode, stream]);

  const handleMouseDown = (e) => {
    if (!isBoundingBoxMode || !videoRef.current) return;
    console.log('Mouse down detected at:', { clientX: e.clientX, clientY: e.clientY });
    const rect = containerRef.current.getBoundingClientRect();
    console.log('Container rect:', rect);
    const scaleX = (videoSize.width / 4) / rect.width;
    const scaleY = (videoSize.height / 4) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    setDragStart({ x, y });
    console.log('Drag start set:', { x, y });
  };

  const handleMouseMove = (e) => {
    if (!dragStart || !videoRef.current) return;
    console.log('Mouse move detected at:', { clientX: e.clientX, clientY: e.clientY });
    const rect = containerRef.current.getBoundingClientRect();
    const scaleX = (videoSize.width / 4) / rect.width;
    const scaleY = (videoSize.height / 4) / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const width = x - dragStart.x;
    const height = y - dragStart.y;
    const newBox = {
      x: width > 0 ? dragStart.x : x,
      y: height > 0 ? dragStart.y : y,
      width: Math.abs(width),
      height: Math.abs(height),
    };
    setDragBox(newBox);
    console.log('Drag box updated:', newBox);
  };

  const handleMouseUp = () => {
    if (dragBox) {
      console.log('Mouse up - Bounding box drawn:', dragBox);
      onBoundingBoxDrawn(dragBox);
      setDragBox(null);
      setDragStart(null);
    } else if (dragStart) {
      setDragStart(null);
    }
    console.log('Drag state cleared');
  };

  const handleSourceChange = (e) => {
    const newSource = e.target.value;
    setSelectedSource(newSource);
    console.log('Selected source:', newSource);
  };

  const videoWidth = 300;
  const aspectRatio = videoSize.width && videoSize.height ? videoSize.height / videoSize.width : 9 / 16;
  const videoHeight = videoWidth * aspectRatio;

  const overlayStyle = dragBox && isBoundingBoxMode ? {
    left: `${dragBox.x * videoWidth / (videoSize.width / 4)}px`,
    top: `${dragBox.y * videoHeight / (videoSize.height / 4)}px`,
    width: `${dragBox.width * videoWidth / (videoSize.width / 4)}px`,
    height: `${dragBox.height * videoHeight / (videoSize.height / 4)}px`,
  } : {};

  return (
    <div className="video-stream-container">
      <div
        ref={containerRef}
        className="video-container"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          className="video-element"
          style={{ display: stream ? 'block' : 'none' }}
        /> 
        <div className="bounding-box-overlay" style={overlayStyle}></div>
      </div>
      {error && <div className="error-message">{error}</div>}
      {!stream && !error && !isLoading && <div className="waiting-message">Waiting for stream...</div>}
      <div className="source-select-container">
        <label htmlFor="source-select" className="source-label">
          Select Video Stream:
        </label>
        <select
          id="source-select"
          value={selectedSource}
          onChange={handleSourceChange}
          className="source-select"
          disabled={isLoading || error || sources.length === 0}
        >
          {isLoading && !error && (
            <option value="">Loading sources...</option>
          )}
          {!isLoading && sources.length === 0 && !error && (
            <option value="">No sources found</option>
          )}
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default VideoStream;