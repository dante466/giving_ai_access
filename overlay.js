// BEGIN overlay.js
console.log('Overlay script loaded');

window.electronAPI.on('start-drawing', (mode) => {
  console.log('Starting bounding box drawing in mode:', mode);
  let startX, startY, box;
  let isDrawing = false;

  document.documentElement.style.cursor = 'crosshair';

  const canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0'; 
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.zIndex = '9999';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  console.log('Canvas dimensions set to:', { width: canvas.width, height: canvas.height });
  console.log('Window inner dimensions:', { width: window.innerWidth, height: window.innerHeight });

  const drawBox = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = isDrawing ? 'red' : 'white';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 10);
    ctx.stroke();
    console.log('Drawing box:', box);
  };

  const handleMouseDown = (e) => {
    if (!box) {
      startX = e.clientX;
      startY = e.clientY;
      box = { x: startX, y: startY, width: 0, height: 0 };
      isDrawing = true;
      console.log('Mouse down at:', { clientX: e.clientX, clientY: e.clientY });
    }
  };

  const handleMouseMove = (e) => {
    if (document.documentElement.style.cursor !== 'crosshair') {
      document.documentElement.style.cursor = 'crosshair';
    }

    if (!isDrawing || startX === undefined || startY === undefined) return;

    const totalWidth = window.innerWidth;
    const percentageX = (e.clientX / totalWidth) * 100;
    console.log('Mouse move at:', {
      clientX: e.clientX,
      clientY: e.clientY,
      percentageX: percentageX.toFixed(2) + '%',
      totalWidth,
    });

    box.width = e.clientX - startX;
    box.height = e.clientY - startY;
    box.x = box.width < 0 ? e.clientX : startX;
    box.y = box.height < 0 ? e.clientY : startY;
    box.width = Math.abs(box.width);
    box.height = Math.abs(box.height);
    drawBox();
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || !box) return;
    isDrawing = false;
    console.log('Bounding box finalized:', box);
    window.electronAPI.send('capture-area', { ...box, mode });
    window.electronAPI.send('enable-interaction', box);
    window.electronAPI.send('disable-bounding-box'); // Trigger cleanup
  };

  document.addEventListener('mousedown', handleMouseDown, { passive: false });
  document.addEventListener('mousemove', handleMouseMove, { passive: false });
  document.addEventListener('mouseup', handleMouseUp, { passive: false });

  canvas.addEventListener('mousedown', (e) => e.preventDefault());
  canvas.addEventListener('mousemove', (e) => e.preventDefault());

  const cleanup = () => {
    document.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.removeChild(canvas);
    document.documentElement.style.cursor = 'default';
  };

  window.electronAPI.on('disable-bounding-box', () => {
    console.log('Cleaning up overlay');
    cleanup();
  });
});
// END overlay.js