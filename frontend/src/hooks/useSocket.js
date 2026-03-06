import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export const useSocket = (classId, onAttendanceMarked, onDeviceDetected, onSessionStarted) => {
  const socketRef = useRef(null);

  useEffect(() => {
    if (!classId) return;

    if (!socketInstance) {
      socketInstance = io('/', { transports: ['websocket', 'polling'] });
    }
    socketRef.current = socketInstance;

    socketInstance.emit('join_class', { classId });

    if (onAttendanceMarked) socketInstance.on('attendance_marked', onAttendanceMarked);
    if (onDeviceDetected) socketInstance.on('device_detected', onDeviceDetected);
    if (onSessionStarted) socketInstance.on('session_started', onSessionStarted);

    return () => {
      socketInstance.emit('leave_class', { classId });
      if (onAttendanceMarked) socketInstance.off('attendance_marked', onAttendanceMarked);
      if (onDeviceDetected) socketInstance.off('device_detected', onDeviceDetected);
      if (onSessionStarted) socketInstance.off('session_started', onSessionStarted);
    };
  }, [classId]);

  return socketRef.current;
};
