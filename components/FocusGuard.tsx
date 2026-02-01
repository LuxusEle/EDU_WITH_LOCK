import React, { useEffect, useState } from 'react';

interface FocusGuardProps {
  isActive: boolean;
  onUnlockAttempt: () => void;
}

export const FocusGuard: React.FC<FocusGuardProps> = ({ isActive, onUnlockAttempt }) => {
  const [warnings, setWarnings] = useState(0);

  useEffect(() => {
    if (!isActive) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setWarnings(prev => prev + 1);
        onUnlockAttempt();
      }
    };

    const handleFullScreenChange = () => {
      if (!document.fullscreenElement) {
        setWarnings(prev => prev + 1);
        onUnlockAttempt();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("fullscreenchange", handleFullScreenChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      document.removeEventListener("fullscreenchange", handleFullScreenChange);
    };
  }, [isActive, onUnlockAttempt]);

  if (!isActive) return null;

  return (
    <>
      {warnings > 0 && (
        <div className="fixed top-0 left-0 w-full h-1 bg-red-500 z-50 animate-pulse" />
      )}
    </>
  );
};