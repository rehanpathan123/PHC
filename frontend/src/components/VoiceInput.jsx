import React, { useState, useEffect } from 'react';
import { Mic, MicOff, RefreshCw, Send, Check } from 'lucide-react';
import { Button, Alert, Select } from './ui';
import { aiApi } from '../services/api';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceInput({ onSymptomsExtracted }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('hi-IN'); // Hindi by default
  const [transcript, setTranscript] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [recognition, setRecognition] = useState(null);

  useEffect(() => {
    if (SpeechRecognition) {
      setSupported(true);
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = lang;

      rec.onresult = (event) => {
        const current = event.resultIndex;
        const resultText = event.results[current][0].transcript;
        setTranscript((t) => (t ? t + ' ' + resultText : resultText));
      };

      rec.onerror = (e) => {
        logger.error('Speech recognition error: ', e);
        setListening(false);
      };

      rec.onend = () => {
        setListening(false);
      };

      setRecognition(rec);
    }
  }, []);

  useEffect(() => {
    if (recognition) {
      recognition.lang = lang;
    }
  }, [lang, recognition]);

  function toggleListening() {
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      setError('');
      setSuccess(false);
      try {
        recognition.start();
        setListening(true);
      } catch (err) {
        setError('Could not start voice recognition. Please try again.');
      }
    }
  }

  async function processSymptoms() {
    if (!transcript.trim()) return;
    setLoading(true);
    setError('');
    setSuccess(false);
    try {
      const result = await aiApi.extractSymptoms(transcript);
      onSymptomsExtracted(result);
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Failed to extract symptoms.');
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return (
      <Alert type="info">
        🎤 Voice input is not supported in this browser. Please use Chrome or Safari.
      </Alert>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Voice Symptom Intake</span>
        <div className="flex items-center gap-2">
          <Select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="py-1 px-2 text-xs w-28 bg-white border border-gray-300 rounded"
          >
            <option value="hi-IN">हिन्दी (Hindi)</option>
            <option value="en-US">English</option>
            <option value="en-IN">Hinglish</option>
          </Select>
          <Button
            size="sm"
            variant={listening ? 'danger' : 'primary'}
            onClick={toggleListening}
            className="flex items-center gap-1"
          >
            {listening ? <MicOff className="w-4 h-4 animate-pulse" /> : <Mic className="w-4 h-4" />}
            {listening ? 'Stop' : 'Speak'}
          </Button>
        </div>
      </div>

      <div className="relative">
        <textarea
          rows={3}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Speak or type symptoms (e.g. 'Patient ko teen din se fever hai aur khansi hai...')"
          className="w-full text-sm p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand bg-white resize-none"
        />
        {transcript && (
          <button
            onClick={() => setTranscript('')}
            className="absolute right-2 bottom-2 text-xs text-gray-400 hover:text-gray-600 bg-gray-100 px-2 py-0.5 rounded"
          >
            Clear
          </button>
        )}
      </div>

      {error && <Alert type="error">{error}</Alert>}
      {success && (
        <Alert type="success" className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          Structured symptoms successfully extracted and applied!
        </Alert>
      )}

      {transcript.trim() && (
        <Button
          onClick={processSymptoms}
          loading={loading}
          className="w-full justify-center"
          size="sm"
          variant="secondary"
        >
          <Send className="w-3.5 h-3.5" />
          Extract Symptoms using Local AI
        </Button>
      )}
    </div>
  );
}
