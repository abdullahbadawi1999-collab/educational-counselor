import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export function useApi(endpoint, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(endpoint);
      setData(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetch();
  }, [fetch, ...deps]);

  return { data, loading, error, refetch: fetch };
}

export function useDebounce(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
