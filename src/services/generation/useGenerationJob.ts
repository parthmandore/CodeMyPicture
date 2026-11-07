import { useState, useEffect } from 'react';
import { GenerationJob } from './types';
import { generationManager } from './generationManager';

export function useGenerationJob(): GenerationJob | null {
  const [job, setJob] = useState<GenerationJob | null>(() => generationManager.getJob());

  useEffect(() => {
    const unsubscribe = generationManager.subscribe((updatedJob) => {
      setJob(updatedJob);
    });
    return unsubscribe;
  }, []);

  return job;
}
