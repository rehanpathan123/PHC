import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui';

export default function VoiceAssistanceButton({ text, lang = 'en-US', className = '' }) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    // Stop speaking on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  function handleSpeak(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!window.speechSynthesis) {
      alert('Voice assistance (Speech Synthesis) is not supported in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    } else {
      window.speechSynthesis.cancel(); // Stop any current speech
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Auto-detect Hindi if lang isn't explicit but text has Devanagari characters
      const hasDevanagari = /[\u0900-\u097F]/.test(text);
      utterance.lang = hasDevanagari ? 'hi-IN' : lang;

      // Find suitable voice (handling async voice loading in some browsers)
      let voices = window.speechSynthesis.getVoices();
      
      const setVoiceAndSpeak = () => {
        voices = window.speechSynthesis.getVoices();
        
        // Try to find a premium/natural female voice first if available, else fallback to standard
        const preferredVoices = voices.filter(v => 
          v.lang.includes(utterance.lang) || 
          (utterance.lang === 'hi-IN' && v.lang.includes('hi'))
        );
        
        // Priority to Google or Natural voices
        const targetVoice = preferredVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) 
                          || preferredVoices[0];
                          
        if (targetVoice) {
          utterance.voice = targetVoice;
        }

        utterance.onend = () => {
          setSpeaking(false);
        };

        utterance.onerror = () => {
          setSpeaking(false);
        };

        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
      };

      if (voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
      } else {
        setVoiceAndSpeak();
      }
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleSpeak}
      className={`border-indigo-200 text-indigo-700 hover:bg-indigo-50/50 flex items-center gap-1.5 py-1 px-2.5 rounded-lg ${className}`}
      title={speaking ? 'Stop speaking' : 'Read aloud'}
    >
      {speaking ? (
        <>
          <VolumeX className="w-4 h-4 text-indigo-600 animate-bounce" />
          <span>Stop Voice</span>
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4 text-indigo-600" />
          <span>Listen</span>
        </>
      )}
    </Button>
  );
}
