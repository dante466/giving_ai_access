// BEGIN VideoStream.js
import React, { useEffect, useRef, useState } from 'react';

const VideoStream = ({ onFrame = () => {}, isBoundingBoxMode, onBoundingBoxDrawn }) => {
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
  }, []);

  useEffect(() => {
    if (!selectedSource || error) return;

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }

    console.log('Starting stream for:', selectedSource);
    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource } },
    })
      .then((newStream) => {
        setStream(newStream);
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadedmetadata = () => {
            const { videoWidth, videoHeight } = videoRef.current;
            console.log('Video dimensions:', videoWidth, 'x', videoHeight);
            setVideoSize({ width: videoWidth, height: videoHeight });
          };
          videoRef.current.play().catch((err) => console.error('Play error:', err));
          console.log('Stream active');
        }
      })
      .catch((err) => {
        setError(`Stream error: ${err.message}`);
        console.error('Stream failed:', err);
      });

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedSource]);

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
      setDragBox(null); // Reset dragBox
      setDragStart(null); // Reset dragStart to exit drawing state
    } else if (dragStart) {
      setDragStart(null); // Reset dragStart if no box was drawn
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

  const videoStyle = {
    width: `${videoWidth}px`,
    height: `${videoHeight}px`,
    border: '2px solid #333',
    display: stream ? 'block' : 'none',
    objectFit: 'contain',
  };

  const overlayStyle = dragBox && isBoundingBoxMode ? {
    position: 'absolute',
    left: `${dragBox.x * videoWidth / (videoSize.width / 4)}px`,
    top: `${dragBox.y * videoHeight / (videoSize.height / 4)}px`,
    width: `${dragBox.width * videoWidth / (videoSize.width / 4)}px`,
    height: `${dragBox.height * videoHeight / (videoSize.height / 4)}px`,
    border: '2px dashed red',
    backgroundColor: 'rgba(255, 0, 0, 0.2)',
    pointerEvents: 'none',
  } : { display: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: `${videoWidth}px`,
          height: `${videoHeight}px`,
          overflow: 'hidden',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          style={videoStyle}
        />
        <div style={overlayStyle}></div>
      </div>
      {error && <div style={{ color: 'red', marginTop: '10px', fontSize: '16px' }}>{error}</div>}
      {!stream && !error && !isLoading && <div style={{ marginTop: '10px', fontSize: '16px' }}>Waiting for stream...</div>}
      <div style={{ marginTop: '10px', width: `${videoWidth}px` }}>
        <label htmlFor="source-select" style={{ display: 'block', fontSize: '16px', fontWeight: 'bold' }}>
          Select Video Stream:
        </label>
        <select
          id="source-select"
          value={selectedSource}
          onChange={handleSourceChange}
          style={{ width: '100%', padding: '8px', marginTop: '5px', fontSize: '16px' }}
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
};

export default VideoStream;
// END VideoStream.js