import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_URL, setSocketId, tokenStore } from '../lib/api';
import { useAuth } from './AuthContext';

const RealtimeContext = createContext({ socket: null, connected: false });

/** One Socket.io connection per signed-in user, shared by the whole app. */
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const userId = user?._id;

  useEffect(() => {
    if (!userId) return undefined;
    const s = io(API_URL, { auth: { token: tokenStore.get() }, transports: ['websocket', 'polling'] });
    const onConnect = () => {
      setConnected(true);
      setSocketId(s.id);
    };
    const onDisconnect = () => {
      setConnected(false);
      setSocketId(null);
    };
    // An admin suspended or deleted this account: sign out right away
    const onSuspended = () => window.dispatchEvent(new CustomEvent('sf:unauthorized', { detail: { code: 'errors.accountSuspended' } }));
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('account:suspended', onSuspended);
    setSocket(s);
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('account:suspended', onSuspended);
      s.disconnect();
      setSocketId(null);
      setSocket(null);
      setConnected(false);
    };
  }, [userId]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export const useRealtime = () => useContext(RealtimeContext);

/** Subscribe to a socket event; the latest handler is always used. */
export function useRealtimeEvent(event, handler) {
  const { socket } = useRealtime();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload) => ref.current(payload);
    socket.on(event, listener);
    return () => socket.off(event, listener);
  }, [socket, event]);
}
