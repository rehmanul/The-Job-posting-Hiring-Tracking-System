import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

interface RealtimeOptions {
  interval?: number;
  enabled?: boolean;
  onUpdate?: (data: any) => void;
}

export function useRealtime(queryKeys: string[], options: RealtimeOptions = {}) {
  const { interval = 30000, enabled = true, onUpdate } = options;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const intervalRef = useRef<NodeJS.Timeout>();
  const lastDataRef = useRef<Map<string, any>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const checkForUpdates = async () => {
      for (const queryKey of queryKeys) {
        try {
          // Get current data from cache
          const currentData = queryClient.getQueryData([queryKey]);
          const lastData = lastDataRef.current.get(queryKey);

          // If this is the first check, just store the data
          if (!lastData) {
            lastDataRef.current.set(queryKey, currentData);
            continue;
          }

          // Check for new jobs
          if (queryKey === '/api/jobs' && currentData && Array.isArray(currentData)) {
            const newJobs = currentData.filter((job: any) => 
              !lastData.some((oldJob: any) => oldJob.id === job.id)
            );

            if (newJobs.length > 0) {
              toast({
                title: `🆕 ${newJobs.length} New Job${newJobs.length > 1 ? 's' : ''} Found!`,
                description: newJobs.length === 1 
                  ? `${newJobs[0].jobTitle} at ${newJobs[0].company}`
                  : `${newJobs.length} new job postings have been discovered.`,
              });
            }
          }

          // Check for new hires
          if (queryKey === '/api/hires' && currentData && Array.isArray(currentData)) {
            const newHires = currentData.filter((hire: any) => 
              !lastData.some((oldHire: any) => oldHire.id === hire.id)
            );

            if (newHires.length > 0) {
              toast({
                title: `👋 ${newHires.length} New Hire${newHires.length > 1 ? 's' : ''} Detected!`,
                description: newHires.length === 1 
                  ? `${newHires[0].personName} at ${newHires[0].company}`
                  : `${newHires.length} new hires have been detected.`,
              });
            }
          }

          // Update stored data
          lastDataRef.current.set(queryKey, currentData);

          // Call custom update handler
          if (onUpdate) {
            onUpdate({ queryKey, currentData, lastData });
          }

        } catch (error) {
          console.error(`Error checking updates for ${queryKey}:`, error);
        }
      }
    };

    // Initial check
    checkForUpdates();

    // Set up interval
    intervalRef.current = setInterval(checkForUpdates, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [queryKeys, interval, enabled, queryClient, toast, onUpdate]);

  return {
    // Manually trigger a check
    checkNow: () => {
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      });
    },
    
    // Stop/start realtime updates
    pause: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    },
    
    resume: () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(() => {
        queryKeys.forEach(queryKey => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        });
      }, interval);
    }
  };
}

// Hook for dashboard real-time updates
export function useDashboardRealtime() {
  return useRealtime([
    '/api/dashboard/stats',
    '/api/dashboard/activity',
    '/api/jobs',
    '/api/hires',
    '/api/system/status'
  ], {
    interval: 30000, // 30 seconds
    enabled: true
  });
}

// Hook for health monitoring real-time updates
export function useHealthRealtime() {
  return useRealtime([
    '/api/health',
    '/api/system/status'
  ], {
    interval: 10000, // 10 seconds
    enabled: true
  });
}
