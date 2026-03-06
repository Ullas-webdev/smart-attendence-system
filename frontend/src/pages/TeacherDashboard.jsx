import React, { useState, useEffect, useCallback } from 'react';
import { Users, Radio, CheckCircle, XCircle, AlertTriangle, BookOpen, Play, Edit3, BarChart3, RefreshCw, Filter, Download, Bluetooth } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AttendanceCircle, EligibilityBadge, StatCard } from '../components/AttendanceStats';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { getClasses, getClassAttendance, manualOverride, startSession, getEligibilityReport, getActiveDevices, getClassStudents } from '../services/api';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [eligibilityReport, setEligibilityReport] = useState(null);
  const [activeDevices, setActiveDevices] = useState([]);
  const [realtimeFeed, setRealtimeFeed] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState('All');

  // Real-time socket
  useSocket(
    selectedClass?._id,
    (data) => {
      setRealtimeFeed(prev => [{ ...data, id: Date.now() }, ...prev.slice(0, 19)]);
      loadAttendanceData();
    },
    (data) => {
      toast(`📡 ${data.studentName} (${data.rollNumber}) BLE detected`, { icon: '🔵' });
      loadActiveDevices();
    },
    (data) => {
      toast.success(`📖 Session started! Total: ${data.totalClassesHeld}`);
    }
  );

  const loadClasses = async () => {
    try {
      const res = await getClasses();
      setClasses(res.data.classes);
      if (res.data.classes.length > 0 && !selectedClass) {
        setSelectedClass(res.data.classes[0]);
      }
    } catch {
      toast.error('Failed to load classes');
    }
  };

  const loadAttendanceData = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const [attRes, stdRes] = await Promise.all([
        getClassAttendance(selectedClass._id),
        getClassStudents(selectedClass._id)
      ]);
      
      const attendance = attRes.data;
      const enrolledStudents = stdRes.data.students || [];
      
      // Ensure all enrolled students show up in studentStats, even if they have no attendance records yet
      const existingStatIds = new Set(attendance.studentStats?.map(s => s.student._id.toString()) || []);
      
      const missingStats = enrolledStudents
        .filter(s => !existingStatIds.has(s._id.toString()))
        .map(student => ({
          student,
          present: 0,
          total: attendance.class?.totalClassesHeld || 0,
          percentage: 0,
          eligible: false,
          todayStatus: 'absent'
        }));
        
      if (missingStats.length > 0) {
        attendance.studentStats = [...(attendance.studentStats || []), ...missingStats];
      }
      
      setAttendanceData(attendance);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load class data');
    } finally { setLoading(false); }
  }, [selectedClass]);

  const loadEligibility = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const [eligRes, stdRes] = await Promise.all([
        getEligibilityReport(selectedClass._id),
        getClassStudents(selectedClass._id)
      ]);
      
      const eligibility = eligRes.data;
      const enrolledStudents = stdRes.data.students || [];
      
      const existingReportIds = new Set(eligibility.report?.map(r => r.student._id.toString()) || []);
      
      const missingReport = enrolledStudents
        .filter(s => !existingReportIds.has(s._id.toString()))
        .map(student => ({
          student,
          present: 0,
          total: eligibility.class?.totalClassesHeld || 0,
          percentage: 0,
          eligible: false
        }));

      if (missingReport.length > 0) {
         eligibility.report = [...(eligibility.report || []), ...missingReport];
         eligibility.ineligible = [...(eligibility.ineligible || []), ...missingReport];
         eligibility.summary.total += missingReport.length;
         eligibility.summary.ineligible += missingReport.length;
      }

      setEligibilityReport(eligibility);
    } catch { }
  }, [selectedClass]);

  const loadActiveDevices = useCallback(async () => {
    if (!selectedClass) return;
    try {
      const res = await getActiveDevices(selectedClass._id);
      setActiveDevices(res.data.activeDevices);
    } catch { }
  }, [selectedClass]);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => {
    if (selectedClass) {
      loadAttendanceData();
      loadEligibility();
      loadActiveDevices();
      setRealtimeFeed([]);
    }
  }, [selectedClass]);

  // Poll active BLE devices every 10s
  useEffect(() => {
    const interval = setInterval(loadActiveDevices, 10000);
    return () => clearInterval(interval);
  }, [loadActiveDevices]);

  const handleStartSession = async () => {
    try {
      await startSession(selectedClass._id);
      setSessionStarted(true);
      toast.success('📖 Class session started!');
      loadAttendanceData();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleManualOverride = async ({ studentId, status }) => {
    try {
      await manualOverride({ studentId, classId: selectedClass._id, status });
      toast.success('✅ Attendance updated manually');
      setOverrideModal(null);
      loadAttendanceData();
      loadEligibility();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Override failed');
    }
  };

  const filteredClasses = selectedBranch === 'All' ? classes : classes.filter(c => c.department === selectedBranch || !c.department);
  const filteredStudentStats = attendanceData?.studentStats?.filter(s => selectedBranch === 'All' || s.student?.department === selectedBranch) || [];
  const filteredActiveDevices = activeDevices.filter(d => selectedBranch === 'All' || d.student?.department === selectedBranch);
  const filteredRealtimeFeed = realtimeFeed.filter(e => selectedBranch === 'All' || e.student?.department === selectedBranch);
  const filteredIneligible = eligibilityReport?.ineligible?.filter(s => selectedBranch === 'All' || s.student?.department === selectedBranch) || [];
  const filteredReport = eligibilityReport?.report?.filter(s => selectedBranch === 'All' || s.student?.department === selectedBranch) || [];

  const todayPresent = filteredStudentStats.filter(s => s.todayStatus === 'present' || s.todayStatus === 'manual_override').length || 0;
  const totalStudents = selectedBranch === 'All' ? (attendanceData?.class?.students?.length || 0) : (attendanceData?.class?.students?.filter(s => s.department === selectedBranch).length || 0);
  const belowThreshold = filteredIneligible.length || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Manual Override Modal */}
      {overrideModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="font-bold text-lg mb-1">Manual Override</h3>
            <p className="text-gray-500 text-sm mb-4">Set attendance for <span className="font-semibold">{overrideModal.name}</span></p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'manual_override' })}
                className="btn-success py-3 flex-col gap-1">
                <CheckCircle className="w-5 h-5" />
                <span className="text-xs">Mark Present</span>
              </button>
              <button onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'absent' })}
                className="btn-danger py-3 flex-col gap-1">
                <XCircle className="w-5 h-5" />
                <span className="text-xs">Mark Absent</span>
              </button>
            </div>
            <button onClick={() => setOverrideModal(null)} className="btn-secondary w-full">Cancel</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
            <p className="text-gray-500 text-sm">Welcome, {user?.name} • {user?.department}</p>
          </div>
          <div className="flex items-center gap-4">
            <select className="input py-2 bg-white" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
              <option value="All">All Branches</option>
              <option value="Computer Science">Computer Science</option>
              <option value="CS IoT">CS IoT</option>
              <option value="Information Science">Information Science</option>
              <option value="Electronics">Electronics</option>
            </select>
            {selectedClass && (
              <button onClick={handleStartSession} disabled={sessionStarted}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${sessionStarted ? 'bg-green-100 text-green-700 cursor-default' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'}`}>
                <Play className="w-4 h-4" />
                {sessionStarted ? 'Session Active' : 'Start Session'}
              </button>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar: Class list */}
          <div className="lg:col-span-1 space-y-4">
            <div className="card">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" /> My Classes
              </h3>
              <div className="space-y-2">
                {filteredClasses.map(cls => (
                  <button key={cls._id} onClick={() => setSelectedClass(cls)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-all ${selectedClass?._id === cls._id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className="font-medium text-sm">{cls.subject}</div>
                    <div className="text-xs text-gray-500">{cls.subjectCode}</div>
                    <div className="text-xs text-gray-400 mt-1">{selectedBranch === 'All' ? (cls.students?.length || 0) : (cls.students?.filter(s => s.department === selectedBranch).length || 0)} students</div>
                  </button>
                ))}
                {filteredClasses.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No classes assigned</p>}
              </div>
            </div>

            {/* Live BLE devices */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                  <Bluetooth className="w-4 h-4 text-blue-600" /> Live BLE
                </h3>
                <button onClick={loadActiveDevices} className="text-gray-400 hover:text-gray-600">
                  <RefreshCw className="w-3 h-3" />
                </button>
              </div>
              {filteredActiveDevices.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-3">No devices in range</p>
              ) : (
                <div className="space-y-2">
                  {filteredActiveDevices.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <div>
                        <div className="text-xs font-medium">{d.student.name}</div>
                        <div className="text-xs text-gray-400">{d.student.rollNumber} • {d.rssi} dBm</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            {selectedClass ? (
              <>
                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  <StatCard label="Today Present" value={todayPresent} icon={CheckCircle} color="green" />
                  <StatCard label="Total Students" value={totalStudents} icon={Users} color="blue" />
                  <StatCard label="Below 75%" value={belowThreshold} icon={AlertTriangle} color={belowThreshold > 0 ? 'yellow' : 'green'} />
                  <StatCard label="Classes Held" value={attendanceData?.class?.totalClassesHeld || 0} icon={BookOpen} color="purple" />
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-200 p-1 rounded-xl mb-4 w-fit">
                  {[['overview', '📋 Overview'], ['realtime', '📡 Live Feed'], ['eligibility', '📊 Eligibility']].map(([k, v]) => (
                    <button key={k} onClick={() => setActiveTab(k)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === k ? 'bg-white shadow text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}>
                      {v}
                    </button>
                  ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Student Attendance — Today</h3>
                      <button onClick={loadAttendanceData} disabled={loading} className="text-gray-400 hover:text-blue-600">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {!attendanceData?.studentStats ? (
                      <div className="text-center py-8 text-gray-400">Loading...</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-gray-500">
                              <th className="pb-2 pr-4">Student</th>
                              <th className="pb-2 pr-4">Roll No.</th>
                              <th className="pb-2 pr-4">Today</th>
                              <th className="pb-2 pr-4">Overall</th>
                              <th className="pb-2 pr-4">Status</th>
                              <th className="pb-2">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filteredStudentStats.map((s, i) => (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="py-3 pr-4 font-medium text-gray-900">{s.student.name}</td>
                                <td className="py-3 pr-4 text-gray-500 font-mono text-xs">{s.student.rollNumber}</td>
                                <td className="py-3 pr-4">
                                  {s.todayStatus === 'present' || s.todayStatus === 'manual_override' ? (
                                    <span className="badge-green flex items-center gap-1 w-fit">
                                      <CheckCircle className="w-3 h-3" />
                                      {s.todayStatus === 'manual_override' ? 'Override' : 'Present'}
                                    </span>
                                  ) : (
                                    <span className="badge-red flex items-center gap-1 w-fit">
                                      <XCircle className="w-3 h-3" /> Absent
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 pr-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                      <div className={`h-1.5 rounded-full ${s.percentage >= 75 ? 'bg-green-500' : s.percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                        style={{ width: `${s.percentage}%` }} />
                                    </div>
                                    <span className={`text-xs font-semibold ${s.percentage >= 75 ? 'text-green-700' : 'text-red-700'}`}>{s.percentage}%</span>
                                  </div>
                                </td>
                                <td className="py-3 pr-4"><EligibilityBadge percentage={s.percentage} /></td>
                                <td className="py-3">
                                  <button onClick={() => setOverrideModal(s.student)}
                                    className="text-gray-400 hover:text-blue-600 p-1 rounded">
                                    <Edit3 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Real-time Feed Tab */}
                {activeTab === 'realtime' && (
                  <div className="card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900">Real-time Attendance Feed</h3>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs text-green-600 font-medium">LIVE</span>
                      </div>
                    </div>
                    {filteredRealtimeFeed.length === 0 ? (
                      <div className="text-center py-12">
                        <Radio className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-400">Waiting for students to mark attendance...</p>
                        <p className="text-gray-300 text-sm mt-1">Events will appear here in real-time</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredRealtimeFeed.map((event) => (
                          <div key={event.id} className={`flex items-center gap-3 p-3 rounded-xl ${event.bluetoothVerified ? 'bg-green-50 border border-green-100' : 'bg-yellow-50 border border-yellow-100'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${event.bluetoothVerified ? 'bg-green-500' : 'bg-yellow-500'}`}>
                              {event.student?.name?.[0] || '?'}
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-gray-900 text-sm">{event.student?.name}</div>
                              <div className="text-xs text-gray-500">{event.student?.rollNumber} • {event.bluetoothVerified ? '🔵 BLE Verified' : '✏️ Manual Override'}</div>
                            </div>
                            <div className="text-xs text-gray-400">{new Date(event.markedAt).toLocaleTimeString()}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Eligibility Tab */}
                {activeTab === 'eligibility' && (
                  <div className="space-y-4">
                    {eligibilityReport && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="card text-center">
                            <div className="text-3xl font-bold text-gray-900">{filteredReport.length}</div>
                            <div className="text-sm text-gray-500 mt-1">Total Students</div>
                          </div>
                          <div className="card text-center bg-green-50 border border-green-200">
                            <div className="text-3xl font-bold text-green-700">{filteredReport.filter(s => s.eligible).length}</div>
                            <div className="text-sm text-green-600 mt-1">Eligible (≥75%)</div>
                          </div>
                          <div className="card text-center bg-red-50 border border-red-200">
                            <div className="text-3xl font-bold text-red-700">{filteredIneligible.length}</div>
                            <div className="text-sm text-red-600 mt-1">Ineligible (&lt;75%)</div>
                          </div>
                        </div>

                        {filteredIneligible.length > 0 && (
                          <div className="card border-red-200 bg-red-50">
                            <h4 className="font-bold text-red-800 mb-3 flex items-center gap-2">
                              <AlertTriangle className="w-5 h-5" /> Students Below 75% — Flagged for Review
                            </h4>
                            <div className="space-y-2">
                              {filteredIneligible.map((s, i) => (
                                <div key={i} className="flex items-center justify-between bg-white rounded-lg p-3">
                                  <div>
                                    <div className="font-medium text-gray-900">{s.student.name}</div>
                                    <div className="text-xs text-gray-500">{s.student.rollNumber} • {s.student.email}</div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <AttendanceCircle percentage={s.percentage} />
                                    <div className="text-right">
                                      <div className="text-sm font-semibold text-red-700">{s.percentage}%</div>
                                      <div className="text-xs text-gray-500">{s.present}/{s.total}</div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="card">
                          <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" /> All Students Report
                          </h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b text-left text-gray-500">
                                  <th className="pb-2 pr-4">Student</th>
                                  <th className="pb-2 pr-4">Attended</th>
                                  <th className="pb-2 pr-4">Percentage</th>
                                  <th className="pb-2">Eligibility</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {filteredReport.map((s, i) => (
                                  <tr key={i} className="hover:bg-gray-50">
                                    <td className="py-2 pr-4">
                                      <div className="font-medium">{s.student.name}</div>
                                      <div className="text-xs text-gray-400">{s.student.rollNumber}</div>
                                    </td>
                                    <td className="py-2 pr-4 text-gray-600">{s.present}/{s.total}</td>
                                    <td className="py-2 pr-4">
                                      <div className="flex items-center gap-2">
                                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                                          <div className={`h-1.5 rounded-full ${s.percentage >= 75 ? 'bg-green-500' : 'bg-red-500'}`} style={{ width: `${s.percentage}%` }} />
                                        </div>
                                        <span className="text-xs font-medium">{s.percentage}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2"><EligibilityBadge percentage={s.percentage} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="card text-center py-16">
                <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Select a class from the sidebar</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
