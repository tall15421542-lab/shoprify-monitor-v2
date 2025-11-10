import { useEffect, useState } from 'react';

export function usePageVisibility(): boolean {
  const getIsVisible = () => {
    if (typeof document === 'undefined' || typeof document.visibilityState === 'undefined') {
      return true;
    }
    return document.visibilityState !== 'hidden';
  };

  const [isVisible, setIsVisible] = useState<boolean>(getIsVisible);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsVisible(getIsVisible());
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}


