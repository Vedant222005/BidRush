import { useState, useEffect, useCallback } from 'react';

/**
 * Timer Component
 * 
 * HOOKS USED:
 * - useState - Manages the timeLeft object {days, hours, minutes, seconds}
 * - useEffect - Sets up interval to update timer every second
 * - useCallback - Memoizes calculateTimeLeft function to prevent re-renders
 * 
 * PROPS:
 * - endTime: ISO date string of when auction ends
 * - onExpire: Callback function when timer reaches zero
 * 
 * PURPOSE:
 * - Displays countdown timer for auctions
 * - Notifies parent when auction ends
 */
const Timer = ({ endTime, onExpire }) => {
    const calculateTimeLeft = useCallback(() => {
        const difference = new Date(endTime) - new Date();

        if (difference <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
        }

        return {
            days: Math.floor(difference / (1000 * 60 * 60 * 24)),
            hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
            minutes: Math.floor((difference / (1000 * 60)) % 60),
            seconds: Math.floor((difference / 1000) % 60),
            expired: false
        };
    }, [endTime]);

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

    useEffect(() => {
        const timer = setInterval(() => {
            const newTime = calculateTimeLeft();
            setTimeLeft(newTime);

            if (newTime.expired && onExpire) {
                onExpire();
                clearInterval(timer);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [calculateTimeLeft, onExpire]);

    if (timeLeft.expired) {
        return (
            <div className="text-red-500 font-semibold text-lg">
                Auction Ended
            </div>
        );
    }

    return (
        <div className="flex items-center space-x-1 text-gray-700">
            <div className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xl font-bold">{String(timeLeft.days).padStart(2, '0')}</span>
                <span className="text-xs text-gray-500">Days</span>
            </div>
            <span className="text-xl font-bold">:</span>
            <div className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xl font-bold">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="text-xs text-gray-500">Hrs</span>
            </div>
            <span className="text-xl font-bold">:</span>
            <div className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xl font-bold">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="text-xs text-gray-500">Min</span>
            </div>
            <span className="text-xl font-bold">:</span>
            <div className="flex flex-col items-center bg-gray-100 rounded-lg px-3 py-2">
                <span className="text-xl font-bold">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="text-xs text-gray-500">Sec</span>
            </div>
        </div>
    );
};

export default Timer;
