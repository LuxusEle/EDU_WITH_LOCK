import React, { useState, useEffect, useRef } from 'react';
import { askVoiceTutor } from '../services/geminiService';

export type VoiceCommand = 'OPEN_CAMERA' | 'TAKE_PHOTO' | 'CLOSE_CAMERA' | 'NEXT' | 'READ';

interface VoiceAssistantProps {
  contextText: string;
  onCommand: (cmd: VoiceCommand) => void;
}

export const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ contextText, onCommand }) => {
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<'IDLE' | 'LISTENING' | 'THINKING' | 'SPEAKING'>('IDLE');
  const [lastTranscript, setLastTranscript] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const isSpeakingRef = useRef(false);

  // Initialize Speech Recognition
  useEffect(() => {
    if (('webkitSpeechRecognition' in window)) {
        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = false; // We restart manually to simulate continuous but clear buffers
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            setStatus('LISTENING');
        };

        recognition.onend = () => {
            // "Always On" logic: if we are supposed to be listening and not speaking, restart.
            if (isListening && !isSpeakingRef.current) {
                try {
                    recognition.start();
                } catch (e) {
                    // Ignore already started errors
                }
            } else {
                if (!isListening) setStatus('IDLE');
            }
        };

        recognition.onresult = async (event: any) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
            setLastTranscript(transcript);
            console.log("Heard:", transcript);

            // 1. Check for Local Commands first (Latency optimization)
            if (checkCommands(transcript)) return;

            // 2. If no command, ask Gemini (Conversational)
            setStatus('THINKING');
            const answer = await askVoiceTutor(transcript, contextText);
            speak(answer);
        };

        recognition.onerror = (e: any) => {
            console.log("Voice error", e);
            // Don't stop listening on no-speech error, just retry
            if (e.error === 'no-speech' && isListening) {
                // automatic restart via onend
            } else {
               // setStatus('IDLE');
            }
        };

        recognitionRef.current = recognition;
    }
  }, [contextText, isListening, onCommand]);

  const checkCommands = (text: string): boolean => {
    if (text.includes("camera") || text.includes("scan") || text.includes("look at my notes")) {
        speak("Opening camera.");
        onCommand('OPEN_CAMERA');
        return true;
    }
    if (text.includes("snap") || text.includes("capture") || text.includes("take a picture") || text.includes("take photo")) {
        onCommand('TAKE_PHOTO'); // No speech feedback to be fast
        return true;
    }
    if (text.includes("close") && text.includes("camera") || text.includes("go back")) {
        onCommand('CLOSE_CAMERA');
        return true;
    }
    if (text.includes("next") || text.includes("forward") || text.includes("continue")) {
        onCommand('NEXT');
        return true;
    }
    if (text.includes("read") || text.includes("speak") || text.includes("tell me about this")) {
        onCommand('READ');
        return true;
    }
    return false;
  };

  const speak = (text: string) => {
    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;
    setStatus('SPEAKING');

    // Pause recognition while speaking to avoid hearing itself
    if (recognitionRef.current) recognitionRef.current.stop();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1; // Slightly faster for "Assistant" feel
    utterance.onend = () => {
        isSpeakingRef.current = false;
        // Resume listening if mode is active
        if (isListening && recognitionRef.current) {
            recognitionRef.current.start();
        } else {
            setStatus('IDLE');
        }
    };
    window.speechSynthesis.speak(utterance);
  };

  const toggleListening = () => {
    if (isListening) {
        setIsListening(false);
        if (recognitionRef.current) recognitionRef.current.stop();
        setStatus('IDLE');
    } else {
        setIsListening(true);
        if (recognitionRef.current) {
            try { recognitionRef.current.start(); } catch(e){}
        }
        speak("I'm listening.");
    }
  };

  if (!('webkitSpeechRecognition' in window)) {
      return null; // or error message
  }

  return (
    <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3 z-[60]">
      {/* Dynamic Status Bubble */}
      {status !== 'IDLE' && (
         <div className="flex flex-col items-end">
             <div className={`px-4 py-2 rounded-2xl shadow-lg backdrop-blur-md border border-white/20 mb-2 transition-all ${
                 status === 'LISTENING' ? 'bg-indigo-600/90 text-white' : 
                 status === 'SPEAKING' ? 'bg-green-600/90 text-white' : 
                 'bg-gray-800/90 text-white'
             }`}>
                <div className="flex items-center gap-2">
                    {status === 'LISTENING' && <span className="animate-pulse">●</span>}
                    <span className="font-bold text-sm">
                        {status === 'LISTENING' ? "Listening..." :
                         status === 'THINKING' ? "Processing..." :
                         status === 'SPEAKING' ? "Speaking..." : ""}
                    </span>
                </div>
                {lastTranscript && status === 'THINKING' && (
                    <p className="text-xs opacity-70 mt-1 italic">"{lastTranscript}"</p>
                )}
             </div>
         </div>
      )}
      
      {/* Main Toggle Button */}
      <button
        onClick={toggleListening}
        className={`p-4 rounded-full shadow-2xl border-4 transition-all transform hover:scale-105 active:scale-95 ${
            isListening 
            ? 'bg-red-500 border-red-300 animate-pulse ring-4 ring-red-500/30' 
            : 'bg-indigo-600 border-indigo-400 ring-4 ring-indigo-600/30'
        }`}
      >
        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isListening ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
        </svg>
      </button>
      {isListening && <p className="text-xs text-white font-bold bg-black/50 px-2 py-1 rounded">Say "Look at my notes"</p>}
    </div>
  );
};