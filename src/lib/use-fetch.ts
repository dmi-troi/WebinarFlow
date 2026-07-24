import { useState, useEffect, useCallback } from 'react';

export function useFetch<T>(url: string | null, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    try {
      const res = await fetch(url);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [url, ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

export function useFetchMultiple<T extends Record<string, any>>(urls: string[], deps: any[] = []) {
  const [data, setData] = useState<T>({} as T);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const results = await Promise.all(urls.map((u) => fetch(u).then((r) => r.json())));
      const combined = {} as any;
      urls.forEach((u, i) => {
        const key = u.split('/api/')[1]?.split('?')[0] || i;
        combined[key] = results[i];
      });
      setData(combined);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [urls.join(','), ...deps]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refetch: fetchData };
}
