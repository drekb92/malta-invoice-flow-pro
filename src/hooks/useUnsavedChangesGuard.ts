import { useBlocker } from 'react-router-dom';
import { useEffect } from 'react';

export function useUnsavedChangesGuard(isDirty: boolean) {
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const confirmAndProceed = () => {
    if (blocker.state === 'blocked') blocker.proceed();
  };

  const cancelNavigation = () => {
    if (blocker.state === 'blocked') blocker.reset();
  };

  return { blocker, confirmAndProceed, cancelNavigation };
}
