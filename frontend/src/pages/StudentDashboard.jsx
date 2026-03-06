import React, { useState, useEffect, useCallback } from 'react';
import { Bluetooth, BluetoothOff, CheckCircle, XCircle, Radio, RefreshCw, BookOpen, AlertTriangle, Smartphone, Wifi, Clock } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AttendanceCircle, EligibilityBadge, StatCard } from '../components/AttendanceStats';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { getClasses, checkProximity, markAttendance, getMyStats, simulateProximity, updateBluetooth } from '../services/api';
import toast from 'react-hot-toast';

// Helper for time-window check
const isWithinTimeWindow = (schedule) => {
  if (!schedule || schedule.length === 0) return true; // fallback if no schedule
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const now = new Date();
  const currentDay = days[now.getDay()];
  
  const todaySchedules = schedule.filter(s => s.day === currentDay);
  if (todaySchedules.length === 0) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return todaySchedules.some(s => {
    if (!s.startTime || !s.endTime) return true;
    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);
    const startMins = startH * 60 + startM;
    const endMins = endH * 60 + endM;
    return currentMinutes >= startMins && currentMinutes <= endMins;
  });
};

export default function StudentDashboard() {
  const { user, setUser } = useAuth();
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [proximity, setProximity] = useState({ inRange: false, checking: false, rssi: null });
  const [marking, setMarking] = useState(false);
  const [todayMarked, setTodayMarked] = useState(false);
  const [btDevice, setBtDevice] = useState(user?.bluetoothDeviceId || '');
  const [showBtModal, setShowBtModal] = useState(!user?.bluetoothDeviceId);
  const [activeTab, setActiveTab] = useState('attendance');

  useSocket(selectedClass?._id,
    (data) => {
      if (data.student?.id === user?._id) {
        setTodayMarked(data.todayStatus === 'present' || data.manualOverride);
        loadStats();
        if (data.manualOverride) {
          toast.success('Your teacher updated your attendance!');
        } else {
          toast.success('✅ Attendance confirmed!');
        }
      }
    }
  );

  const loadClasses = async () => {
    try {
      const res = await getClasses();
      setClasses(res.data.classes);
      if (res.data.classes.length > 0 && !selectedClass) {
        setSelectedClass(res.data.classes[0]);
      }
    } catch (err) {
      toast.error('Failed to load classes');
    }
  };

  const loadStats = async () => {
    try {
      const res = await getMyStats();
      setStats(res.data.stats);
    } catch (err) {}
  };

  useEffect(() => {
    loadClasses();
    loadStats();
  }, []);

  // Poll proximity every 5 seconds
  const checkProx = useCallback(async () => {
    if (!user?.bluetoothDeviceId || !selectedClass) return;
    setProximity(p => ({ ...p, checking: true }));
    try {
      const res = await checkProximity(user.bluetoothDeviceId, selectedClass._id);
      setProximity({ inRange: res.data.inRange, checking: false, rssi: res.data.rssi, ageSeconds: res.data.ageSeconds });
    } catch {
      setProximity(p => ({ ...p, checking: false }));
    }
  }, [user?.bluetoothDeviceId, selectedClass]);

  useEffect(() => {
    checkProx();
    const interval = setInterval(checkProx, 5000);
    return () => clearInterval(interval);
  }, [checkProx]);

  const handleMarkAttendance = async () => {
  if (!selectedClass) return;
  
  setMarking(true);
  try {
    // ... (Bluetooth logic remains same)

    await markAttendance(selectedClass._id);
    
    // ADD THESE TWO LINES:
    setTodayMarked(true); // Force the UI to show the "Green" checkmark
    await loadStats();    // Re-fetch the percentages from the server
    
    toast.success('🎉 Attendance marked successfully!');
  } catch (err) {
    toast.error(err.response?.data?.message || 'Failed to mark attendance');
  } finally {
    setMarking(false);
  }
};
  const handleSimulate = async () => {
    if (!selectedClass) return;
    try {
      await simulateProximity(selectedClass._id);
      toast.success('📡 Proximity simulated! (Dev Mode)');
      setTimeout(checkProx, 1000);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Simulation failed');
    }
  };

  const handleSaveBtDevice = async () => {
    try {
      await updateBluetooth(btDevice);
      setUser({ ...user, bluetoothDeviceId: btDevice });
      localStorage.setItem('user', JSON.stringify({ ...user, bluetoothDeviceId: btDevice }));
      setShowBtModal(false);
      toast.success('Bluetooth device ID saved!');
    } catch {
      toast.error('Failed to save device ID');
    }
  };

  const selectedStats = stats.find(s => s.class?.id === selectedClass?._id);
  const overallAvg = stats.length > 0 ? Math.round(stats.reduce((a, b) => a + b.percentage, 0) / stats.length) : 0;
  const belowThreshold = stats.filter(s => !s.eligible).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Bluetooth Device Modal */}
      {showBtModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="text-center mb-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Bluetooth className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="font-bold text-lg">Register Your Device</h3>
              <p className="text-gray-500 text-sm mt-1">Enter your phone's Bluetooth MAC address to enable proximity-based attendance</p>
            </div>
            <input
              className="input mb-4 font-mono"
              placeholder="AA:BB:CC:DD:EE:FF"
              value={btDevice}
              onChange={e => setBtDevice(e.target.value.toUpperCase())}
            />
            <div className="flex gap-2">
              <button onClick={() => setShowBtModal(false)} className="btn-secondary flex-1">Skip for now</button>
              <button onClick={handleSaveBtDevice} className="btn-primary flex-1" disabled={!btDevice}>Save</button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Find MAC: Settings → About Phone → Bluetooth (or use "DEV" mode to simulate)
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name?.split(' ')[0]} 👋</h1>
          <p className="text-gray-500 text-sm">{user?.rollNumber} • {user?.department} • Semester {user?.semester}</p>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 bg-gray-200 p-1 rounded-xl mb-6 w-fit">
          {['attendance', 'stats'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
              {tab === 'attendance' ? '📡 Mark Attendance' : '📊 My Stats'}
            </button>
          ))}
        </div>

        {activeTab === 'attendance' && (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Class selector */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" /> My Classes
                </h3>
                {classes.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">No classes enrolled</p>
                ) : (
                  <div className="space-y-2">
                    {classes.map(cls => {
                      const s = stats.find(st => st.class?.id === cls._id);
                      return (
                        <button key={cls._id} onClick={() => setSelectedClass(cls)}
                          className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedClass?._id === cls._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                          <div className="font-medium text-sm text-gray-900">{cls.subject}</div>
                          <div className="text-xs text-gray-500 mb-1">{cls.subjectCode}</div>
                          
                          {/* Schedule Display */}
                          {cls.schedule?.length > 0 && (
                            <div className="space-y-1 mb-2">
                              {cls.schedule.map((sch, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-[11px] text-gray-600 bg-gray-100 rounded px-2 py-1 w-fit">
                                  <Clock className="w-3 h-3 text-blue-500 shrink-0" />
                                  <span className="font-medium uppercase tracking-wider">{sch.day.substring(0, 3)}</span>
                                  <span className="opacity-50">•</span>
                                  <span>{sch.startTime} - {sch.endTime}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {s && <div className={`text-xs font-semibold mt-1 ${s.eligible ? 'text-green-600' : 'text-red-600'}`}>{s.percentage}% attendance</div>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bluetooth status */}
              <div className={`card border-2 ${proximity.inRange ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                    <Radio className={`w-4 h-4 ${proximity.inRange ? 'text-green-600' : 'text-gray-400'}`} />
                    BLE Proximity
                  </h3>
                  <button onClick={checkProx} disabled={proximity.checking}
                    className="text-gray-400 hover:text-gray-600">
                    <RefreshCw className={`w-4 h-4 ${proximity.checking ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <div className={`text-center py-4 rounded-lg ${proximity.inRange ? 'bg-green-100' : 'bg-gray-100'}`}>
                  {proximity.inRange ? (
                    <>
                      <Bluetooth className="w-10 h-10 text-green-600 mx-auto mb-2 pulse-ring" />
                      <div className="text-green-700 font-bold">In Range ✓</div>
                      {proximity.rssi && <div className="text-green-600 text-xs mt-1">RSSI: {proximity.rssi} dBm</div>}
                    </>
                  ) : (
                    <>
                      <BluetoothOff className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                      <div className="text-gray-500 font-medium text-sm">Not Detected</div>
                      <div className="text-gray-400 text-xs mt-1">Move closer to classroom</div>
                    </>
                  )}
                </div>
                {!user?.bluetoothDeviceId && (
                  <button onClick={() => setShowBtModal(true)} className="mt-3 w-full btn-secondary text-xs py-1.5">
                    <Smartphone className="w-3 h-3" /> Register Device
                  </button>
                )}
                {user?.bluetoothDeviceId && (
                  <div className="mt-3 text-xs text-gray-400 font-mono bg-gray-50 rounded px-2 py-1 truncate">
                    {user.bluetoothDeviceId}
                  </div>
                )}
              </div>
            </div>

            {/* Main attendance panel */}
            <div className="lg:col-span-2 space-y-6">
              {selectedClass ? (
                <>
                  <div className="card">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h2 className="text-xl font-bold text-gray-900">{selectedClass.subject}</h2>
                        <p className="text-gray-500 text-sm">{selectedClass.subjectCode} • {selectedClass.teacher?.name || 'Faculty'}</p>
                      </div>
                      {selectedStats && <EligibilityBadge percentage={selectedStats.percentage} />}
                    </div>

                    {/* Stats row */}
                    {selectedStats && (
                      <div className="grid grid-cols-3 gap-3 mb-6">
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                          <div className="text-2xl font-bold text-blue-700">{selectedStats.present}</div>
                          <div className="text-xs text-blue-600">Present</div>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <div className="text-2xl font-bold text-gray-700">{selectedStats.total}</div>
                          <div className="text-xs text-gray-500">Total</div>
                        </div>
                        <div className="bg-white rounded-xl p-3 text-center flex flex-col items-center">
                          <AttendanceCircle percentage={selectedStats.percentage} />
                        </div>
                      </div>
                    )}

                    {/* Attendance marking section */}
                    <div className="border-t pt-4">
                      <h3 className="font-semibold text-gray-900 mb-3">Mark Today's Attendance</h3>

                      {todayMarked ? (
                        <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                          <CheckCircle className="w-8 h-8 text-green-600 shrink-0" />
                          <div>
                            <div className="font-semibold text-green-800">Attendance Marked! ✅</div>
                            <div className="text-sm text-green-600">You're marked present for today's class.</div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className={`flex items-center gap-3 p-4 rounded-xl border ${proximity.inRange ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                            {proximity.inRange ? (
                              <><Wifi className="w-5 h-5 text-green-600" /><span className="text-green-700 text-sm font-medium">ESP32 beacon detected — you're in the classroom</span></>
                            ) : (
                              <><BluetoothOff className="w-5 h-5 text-gray-400" /><span className="text-gray-500 text-sm">Ensure Bluetooth is ON and you're inside the classroom</span></>
                            )}
                          </div>
                          
                          {/* Time window display */}
                          <div className={`text-sm text-center mb-2 font-medium ${isWithinTimeWindow(selectedClass.schedule) ? 'text-green-600' : 'text-red-600'}`}>
                            {isWithinTimeWindow(selectedClass.schedule) ? 'Class is currently active' : 'Outside class hours'}
                          </div>

                          <button
                            onClick={handleMarkAttendance}
                            disabled={!proximity.inRange || marking || !user?.bluetoothDeviceId || !isWithinTimeWindow(selectedClass.schedule)}
                            className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${proximity.inRange && !marking && user?.bluetoothDeviceId && isWithinTimeWindow(selectedClass.schedule) ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200 hover:shadow-blue-300' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
                            {marking ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="w-5 h-5 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                                Marking...
                              </span>
                            ) : proximity.inRange ? '✅ Mark Attendance' : '🔒 Out of Range'}
                          </button>

                          {!user?.bluetoothDeviceId && (
                            <p className="text-xs text-amber-600 text-center flex items-center justify-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> Register your Bluetooth device first
                            </p>
                          )}

                          {/* Dev simulation button */}
                          <button onClick={handleSimulate}
                            className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 rounded-xl text-sm font-medium transition-colors">
                            🧪 Simulate Proximity (Dev Mode)
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="card text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">Select a class from the left to mark attendance</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div>
            {/* Overview stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Overall Avg" value={`${overallAvg}%`} icon={CheckCircle} color={overallAvg >= 75 ? 'green' : 'red'} />
              <StatCard label="Total Subjects" value={stats.length} icon={BookOpen} color="blue" />
              <StatCard label="Below 75%" value={belowThreshold} icon={AlertTriangle} color={belowThreshold > 0 ? 'yellow' : 'green'} />
              <StatCard label="Eligible" value={`${stats.length - belowThreshold}/${stats.length}`} icon={CheckCircle} color="green" />
            </div>

            {/* Per-subject breakdown */}
            <div className="card">
              <h3 className="font-bold text-gray-900 mb-4">Subject-wise Attendance</h3>
              {stats.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No attendance data yet</div>
              ) : (
                <div className="space-y-4">
                  {stats.map((s, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                      <AttendanceCircle percentage={s.percentage} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{s.class?.subject}</span>
                          <EligibilityBadge percentage={s.percentage} />
                        </div>
                        <div className="text-sm text-gray-500">{s.class?.subjectCode}</div>
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{s.present} / {s.total} classes attended</span>
                            <span>{s.percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${s.percentage >= 75 ? 'bg-green-500' : s.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${s.percentage}%` }}
                            />
                          </div>
                        </div>
                        {!s.eligible && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ Need {Math.ceil(0.75 * s.total - s.present)} more classes to reach 75%
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
