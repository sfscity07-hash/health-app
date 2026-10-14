import { onlineManager } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/** False while the phone has no connection (followed in lib/queryCache). */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => onlineManager.isOnline());
  useEffect(() => onlineManager.subscribe(setOnline), []);
  return online;
}
