// BEGIN memoryManager.js
import { useEffect, useState } from 'react';

const useMemory = () => {
  const [memories, setMemories] = useState([]);

  useEffect(() => {
    const loadMemories = () => {
      try {
        const memoriesData = window.electronAPI.readFileSync('memories.json', 'utf8');
        if (!memoriesData) {
          console.log('Memories file is empty or does not exist, initializing with empty array');
          setMemories([]);
          window.electronAPI.writeFileSync('memories.json', JSON.stringify([]));
          return;
        }
        setMemories(JSON.parse(memoriesData));
      } catch (err) {
        console.log('Failed to load memories:', err);
        setMemories([]);
        window.electronAPI.writeFileSync('memories.json', JSON.stringify([]));
      }
    };
    loadMemories();
  }, []);

  const saveMemory = (memory) => {
    const newMemories = [...memories, { ...memory, timestamp: Date.now() }];
    setMemories(newMemories);
    window.electronAPI.writeFileSync('memories.json', JSON.stringify(newMemories));
  };

  const getRelevantMemories = (prompt) => {
    return memories
      .filter(m => m.description.toLowerCase().includes(prompt.toLowerCase()))
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 3);
  };

  return { saveMemory, getRelevantMemories };
};

export default useMemory;
// END memoryManager.js