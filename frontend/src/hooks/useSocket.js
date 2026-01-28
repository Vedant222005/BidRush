import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

/**
 * useSocket Custom Hook - Simplified for WebSocket
 * 
 * HOOKS USED:
 * - useState - Stores socket instance
 * - useEffect - Creates connection on mount, disconnects on unmount
 * 
 * PURPOSE:
 * - Creates and manages Socket.io WebSocket connection
 * - Auto-connects on mount, disconnects on unmount
 * - Returns socket instance for real-time features
 */

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

// Single socket instance (created once)
let socket = null;

export const useSocket = () => {
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Create socket only if it doesn't exist
        if (!socket) {
            socket = io(SOCKET_URL, {
                withCredentials: true
            });
        }

        // Connection events
        const onConnect = () => {
            console.log(' Socket connected:', socket.id);
            setIsConnected(true);
        };

        const onDisconnect = () => {
            console.log(' Socket disconnected');
            setIsConnected(false);
        };

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // Check if already connected
        //If component mounts after socket already connected
        if (socket.connected) {  
            setIsConnected(true);
        }

        // Cleanup listeners (but don't disconnect - other components might use it)
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    return socket;
};

export default useSocket;
