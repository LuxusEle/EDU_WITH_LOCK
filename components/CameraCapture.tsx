import React, { useRef, useState, useCallback, useEffect } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onCancel: () => void;
  trigger?: number; // Prop to trigger capture externally (via voice)
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel, trigger }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Initial Setup: Request Permission -> Enumerate Devices -> Set Default
  useEffect(() => {
    const initCameraSystem = async () => {
      try {
        // Step A: Request generic access to trigger permission prompt
        // This is crucial. Without this, enumerateDevices() returns empty labels or incomplete lists.
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // Step B: Now that we have permission, list all devices
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputDevices = allDevices.filter(device => device.kind === 'videoinput');
        setDevices(videoInputDevices);

        // Step C: Set the default device
        if (videoInputDevices.length > 0) {
            // Check if we can find the device ID of the stream we just opened
            const currentTrack = initialStream.getVideoTracks()[0];
            const currentSettings = currentTrack.getSettings();
            
            // If the initial stream matches a device in our list, select it. 
            // Otherwise default to the first one found.
            if (currentSettings.deviceId && videoInputDevices.find(d => d.deviceId === currentSettings.deviceId)) {
                setSelectedDeviceId(currentSettings.deviceId);
            } else {
                setSelectedDeviceId(videoInputDevices[0].deviceId);
            }
        } else {
            setError("No camera devices found.");
        }

        // Clean up the initial stream (we will restart it with specific constraints in the next effect)
        initialStream.getTracks().forEach(t => t.stop());
        setIsInitializing(false);

      } catch (e) {
        console.error("Camera permission error:", e);
        setError("Camera permission denied. Please allow access in your browser settings.");
        setIsInitializing(false);
      }
    };

    initCameraSystem();
  }, []);

  // 2. Start/Restart Stream whenever selectedDeviceId changes
  useEffect(() => {
    if (!selectedDeviceId) return;

    const startSpecificStream = async () => {
      // Stop previous stream
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                deviceId: { exact: selectedDeviceId },
                width: { ideal: 1920 },
                height: { ideal: 1080 } 
            } 
        });
        
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
        }
        setError('');
      } catch (err) {
        console.error("Error starting specific stream:", err);
        setError("Failed to start the selected camera.");
      }
    };

    startSpecificStream();

    // Cleanup when component unmounts or device changes
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [selectedDeviceId]);

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/png');
        onCapture(dataUrl);
      }
    }
  }, [onCapture]);

  // Handle external voice trigger
  useEffect(() => {
    if (trigger && trigger > 0) {
        takePhoto();
    }
  }, [trigger, takePhoto]);

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
        <div className="bg-white p-8 rounded-xl text-center shadow-2xl max-w-md">
            <div className="text-red-500 text-5xl mb-4">🚫</div>
            <p className="text-gray-800 mb-6 font-bold text-lg">{error}</p>
            <button onClick={onCancel} className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4">
      {/* Header / Selector */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/80 to-transparent">
         <h3 className="text-white font-bold text-lg hidden sm:block">📸 Scan Mode</h3>
         
         {devices.length > 0 && (
            <div className="flex items-center gap-2 bg-white/10 p-2 rounded-lg backdrop-blur-md border border-white/20">
                <span className="text-xs text-gray-300 font-bold uppercase">Source:</span>
                <select 
                    value={selectedDeviceId}
                    onChange={(e) => setSelectedDeviceId(e.target.value)}
                    className="bg-white text-gray-900 rounded px-2 py-1 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500 max-w-[200px] sm:max-w-xs truncate"
                >
                    {devices.map((d, index) => (
                        <option key={d.deviceId} value={d.deviceId}>
                            {d.label || `Camera ${index + 1}`}
                        </option>
                    ))}
                </select>
            </div>
         )}
      </div>

      {/* Viewfinder */}
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-2xl overflow-hidden border-4 border-indigo-500 shadow-2xl ring-4 ring-indigo-500/30">
        {isInitializing && (
             <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-10">
                 <span className="animate-pulse">Starting Camera...</span>
             </div>
        )}
        <video 
          ref={videoRef} 
          className="w-full h-full object-contain" 
          playsInline 
          muted 
        />
        <canvas ref={canvasRef} className="hidden" />
        
        <div className="absolute inset-0 border-2 border-white/20 pointer-events-none flex items-center justify-center">
             {/* Reticle / Guides */}
             <div className="w-64 h-64 border-2 border-white/40 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white/50 rounded-full"></div>
             </div>
             <p className="absolute bottom-8 text-white/70 bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm text-sm">
                Say "Take Photo" or press Snap
            </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-6 mt-8 z-20">
        <button 
          onClick={onCancel}
          className="px-6 py-4 rounded-full bg-gray-700 text-white font-bold hover:bg-gray-600 transition"
        >
          Cancel
        </button>
        <button 
          onClick={takePhoto}
          className="px-10 py-4 rounded-full bg-indigo-600 text-white font-bold text-xl hover:bg-indigo-500 transition shadow-lg flex items-center gap-2 ring-4 ring-indigo-400/50 transform hover:scale-105 active:scale-95"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          SNAP
        </button>
      </div>
    </div>
  );
};