import { useEffect, useState, useCallback } from 'react';
import { useSuiClient, useCurrentAccount } from '@mysten/dapp-kit';
import { SuiEvent } from '@mysten/sui.js/client';

const PACKAGE_ID = import.meta.env.VITE_AUTOPAY_PACKAGE_ID;

export const useTaskEvents = () => {
  const client = useSuiClient();
  const account = useCurrentAccount();
  const [events, setEvents] = useState<SuiEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!PACKAGE_ID || !account) return;
    setLoading(true);
    try {
      const result = await client.queryEvents({
        query: {
          MoveModule: {
            package: PACKAGE_ID,
            module: 'autopay'
          }
        },
        limit: 50,
        order: 'descending',
      });

      // Filter events related to the current user
      const filtered = result.data.filter((event: any) => {
        const json = event.parsedJson;
        return json && (json.sender === account.address || json.executor === account.address || json.recipient === account.address);
      });

      setEvents(filtered);
    } catch (error) {
      console.error('Error fetching task events:', error);
    } finally {
      setLoading(false);
    }
  }, [client, account]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [fetchEvents]);

  return { events, loading, refresh: fetchEvents };
};
