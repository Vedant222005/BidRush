import { useState, useEffect } from 'react';

/**
 * Toast Component
 * 
 * HOOKS USED:
 * - useState - Manages visibility state
 * - useEffect - Auto-hides toast after duration
 * 
 * PROPS:
 * - message: Text to display
 * - type: 'success' | 'error' | 'info' - Style variant
 * - duration: Auto-hide time in ms (default: 3000)
 * - onClose: Callback when toast closes
 * 
 * PURPOSE:
 * - Notification toast for success/error/info messages
 */
const Toast = ({ message, type = 'info', duration = 3000, onClose }) => {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            if (onClose) onClose();
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    if (!visible) return null;

    const typeStyles = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
    };

    const icons = {
        success: '✓',
        error: '✕',
        info: 'ℹ'
    };

    return (
        <div className={`fixed bottom-4 right-4 flex items-center space-x-3 ${typeStyles[type]} text-white px-6 py-4 rounded-lg shadow-lg animate-slide-up z-50`}>
            <span className="text-lg font-bold">{icons[type]}</span>
            <span>{message}</span>
            <button
                onClick={() => { setVisible(false); onClose && onClose(); }}
                className="ml-2 hover:opacity-70"
            >
                ×
            </button>
        </div>
    );
};

export default Toast;
