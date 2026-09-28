import { useEffect, useState } from 'react';
import { api } from './api';

/*
 * Optional features switched on by the server's environment
 * (e.g. { attachments: true } when Cloudinary is configured).
 * Loaded once and shared by every component.
 */
let cache = null;
let pending = null;

export function loadServerConfig() {
  if (cache) return Promise.resolve(cache);
  pending ??= api
    .get('/config')
    .then(({ data }) => (cache = data))
    .catch(() => {
      pending = null;
      return {};
    });
  return pending;
}

export function useServerConfig() {
  const [config, setConfig] = useState(cache ?? {});
  useEffect(() => {
    let alive = true;
    loadServerConfig().then((value) => alive && setConfig(value));
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
