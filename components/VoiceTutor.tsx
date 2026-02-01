import React, { useState, useEffect } from 'react';
import { askVoiceTutor } from '../services/geminiService';

interface VoiceTutorProps {
  contextText: string;
}

export const VoiceTutor: React.FC<VoiceTutorProps> = ({ contextText }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onstart = () => {
        setIsSpeaking(true);
        setStatus('SPEAKING');
    }
    utterance.onend = () => {
        setIsSpeaking(false);
        setStatus('IDLE');
    }
    window.speechSynthesis.speak(utterance);
  };

  const handleListen = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice input is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new (window as any).webkitSpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setStatus('LISTENING');
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      setStatus('THINKING');
      
      const answer = await askVoiceTutor(transcript, contextText);
      speak(answer);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setStatus('IDLE');
      alert("Could not hear you.");
    };

    recognition.start();
  };

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-2 z-50">
      {status !== 'IDLE' && (
         <div className="bg-black/80 text-white px-4 py-2 rounded-lg animate-fade-in backdrop-blur-md">
            {status === 'LISTENING' && "🎤 Listening..."}
            {status === 'THINKING' && "🧠 AI is Thinking..."}
            {status === 'SPEAKING' && "🗣️ AI Speaking..."}
         </div>
      )}
      
      <div className="flex gap-2">
        <button
            onClick={() => speak(contextText)}
            disabled={status !== 'IDLE'}
            className="p-4 bg-white text-blue-600 rounded-full shadow-lg hover:bg-blue-50 border border-blue-200 transition-transform hover:scale-105 disabled:opacity-50"
            title="Read Slide"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
        </button>

        <button
            onClick={handleListen}
            disabled={status !== 'IDLE'}
            className={`p-4 rounded-full shadow-lg text-white font-bold transition-all transform hover:scale-110 ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gradient-to-r from-purple-500 to-indigo-600'}`}
            title="Ask a Question"
        >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
        </button>
      </div>
    </div>
  );
};