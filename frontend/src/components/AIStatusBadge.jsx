import React, { useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { aiApi } from '../services/api';

export default function AIStatusBadge() {
  const [online, setOnline] = useState(false);
  const [model, setModel] = useState('');

  async function checkStatus() {
    try {
      const data = await aiApi.status();
      setOnline(data.connected);
      setModel(data.model);
    } catch (_) {
      setOnline(false);
    }
  }

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30000); // check status every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
      online ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
    }`}>
      <Sparkles className={`w-3.5 h-3.5 ${online ? 'animate-pulse text-indigo-500' : ''}`} />
      <span>{online ? `Local AI Online (${model})` : 'AI Offline'}</span>
    </div>
  );
}
