// BEGIN memoryManager.js
import { useState, useEffect } from 'react';

const MEMORY_FILE = 'memories.json';

const useMemory = () => {
  const [memories, setMemories] = useState([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) {
      console.warn('Waiting for Electron API...');
      const checkAPI = setInterval(async () => {
        if (window.electronAPI) {
          clearInterval(checkAPI);
          loadMemories();
        }
      }, 100);
      return;
    }
    loadMemories(); 
  }, []);

  const loadMemories = async () => {
    try {
      const exists = await window.electronAPI.existsSync(MEMORY_FILE);
      if (exists) {
        const data = await window.electronAPI.readFileSync(MEMORY_FILE, 'utf8');
        setMemories(JSON.parse(data));
      }
      setIsReady(true);
    } catch (err) {
      console.error('Failed to load memories:', err);
    }
  };

  const saveMemory = async (memory) => {
    if (!window.electronAPI) {
      console.error('Cannot save memory: Electron API unavailable');
      return;
    }
    const newMemories = [...memories, { id: Date.now(), ...memory }];
    try {
      await window.electronAPI.writeFileSync(MEMORY_FILE, JSON.stringify(newMemories, null, 2));
      setMemories(newMemories);
    } catch (err) {
      console.error('Failed to save memory:', err);
    }
  };

  const getRelevantMemories = (prompt) => {
    if (!isReady) return [];
    const keyword = prompt.split(' ')[0].toLowerCase();
    return memories
      .filter((m) => m.description.toLowerCase().includes(keyword))
      .slice(-5);
  };

  return { saveMemory, getRelevantMemories };
};

export default useMemory;
// END memoryManager.js