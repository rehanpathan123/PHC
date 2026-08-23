import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

export default function GlobalVoiceAssistant() {
  const { locale, t } = useI18n();
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleSpeakScreen = () => {
    if (!window.speechSynthesis) {
      alert('Text-to-Speech is not supported in this browser.');
      return;
    }

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    // Extract text from main content area
    const mainContent = document.querySelector('main') || document.body;
    let textToRead = mainContent.innerText;
    
    // Clean up excessive whitespace
    textToRead = textToRead.replace(/\s+/g, ' ').trim();

    if (!textToRead) return;

    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    // Map our locale to standard BCP 47 tags for speech synthesis
    const langMap = {
      en: 'en-US',
      hi: 'hi-IN',
      mr: 'mr-IN'
    };
    utterance.lang = langMap[locale] || 'en-US';

    const setVoiceAndSpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      
      const preferredVoices = voices.filter(v => 
        v.lang.includes(utterance.lang) || 
        (utterance.lang.startsWith('hi') && v.lang.includes('hi')) ||
        (utterance.lang.startsWith('mr') && v.lang.includes('mr'))
      );
      
      const targetVoice = preferredVoices.find(v => v.name.includes('Google') || v.name.includes('Natural')) 
                        || preferredVoices[0];
                        
      if (targetVoice) {
        utterance.voice = targetVoice;
      }

      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak;
    } else {
      setVoiceAndSpeak();
    }
  };

  return (
    <button
      onClick={handleSpeakScreen}
      className={`fixed bottom-6 right-6 p-4 rounded-full shadow-lg transition-all z-50 flex items-center justify-center
        ${speaking ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-brand hover:bg-brand/90'} text-white`}
      title={speaking ? t('stop_voice') : t('voice_assistant')}
    >
      {speaking ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
    </button>
  );
}
