import { useCallback, useRef, useState } from 'react';

export function useSubmissionLock() {
  const lock = useRef(false);
  const [submitting, setSubmitting] = useState(false);

  const runLocked = useCallback(async action => {
    if (lock.current) return undefined;
    lock.current = true;
    setSubmitting(true);
    try {
      return await action();
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  }, []);

  return { submitting, runLocked };
}
