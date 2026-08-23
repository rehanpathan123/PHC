import React, { useState } from 'react';
import { Send, Sparkles, AlertCircle, Bot, X } from 'lucide-react';
import { Button, Input, Card, CardHeader, CardBody } from './ui';
import { aiApi } from '../services/api';
import VoiceAssistanceButton from './VoiceAssistanceButton';

export default function AICopilot() {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hello! I am your PHC-Sync AI Copilot. Ask me about inventory stockout risks, high-risk patients, statistics, or anomalies at this PHC.',
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    if (!question.trim()) return;

    const userMsg = question.trim();
    setMessages((prev) => [...prev, { role: 'user', text: userMsg }]);
    setQuestion('');
    setLoading(true);

    try {
      const data = await aiApi.copilot(userMsg);
      setMessages((prev) => [...prev, { role: 'assistant', text: data.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Sorry, I encountered an issue. Please make sure the local Ollama AI model is running.',
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="flex flex-col h-[400px]">
      <CardHeader className="bg-brand-muted flex items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-brand animate-pulse" />
          <span className="font-semibold font-display text-brand">PHC-Sync AI Copilot</span>
        </div>
      </CardHeader>
      
      <CardBody className="flex-1 flex flex-col min-h-0 p-3">
        {/* Messages list */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 text-sm">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col gap-1 max-w-[85%] ${
                m.role === 'user' ? 'ml-auto items-end' : 'items-start'
              }`}
            >
              <div
                className={`p-2.5 rounded-xl ${
                  m.role === 'user'
                    ? 'bg-brand text-white rounded-tr-none'
                    : m.isError
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'bg-gray-100 text-gray-800 rounded-tl-none'
                }`}
              >
                {m.text}
              </div>
              {m.role === 'assistant' && !m.isError && (
                <VoiceAssistanceButton text={m.text} className="scale-90 origin-left mt-0.5 border-0 bg-transparent hover:bg-gray-100/50 py-0.5 px-1 text-[11px] text-gray-500 font-medium" />
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-gray-500">
              <Bot className="w-4 h-4 animate-bounce text-brand" />
              <span className="text-xs">Thinking...</span>
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask AI (e.g. 'Which medicines will run out this week?')"
            className="flex-1"
            required
            disabled={loading}
          />
          <Button type="submit" disabled={loading} className="px-3">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
