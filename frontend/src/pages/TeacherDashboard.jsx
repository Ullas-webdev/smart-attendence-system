import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, AlertTriangle, BookOpen, Play, Edit3, Bluetooth, Download, Camera, X } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AttendanceCircle, StatCard } from '../components/AttendanceStats';
import { useAuth } from '../context/AuthContext';
import {
  getClasses,
  getClassAttendance,
  manualOverride,
  startSession,
  getEligibilityReport,
  getActiveDevices,
  getClassStudents
} from '../services/api';
import toast from 'react-hot-toast';

export default function TeacherDashboard() {

const { user } = useAuth();

const [classes,setClasses] = useState([]);
const [selectedClass,setSelectedClass] = useState(null);

const [attendanceData,setAttendanceData] = useState(null);
const [eligibilityReport,setEligibilityReport] = useState(null);
const [activeDevices,setActiveDevices] = useState([]);

const [loading,setLoading] = useState(false);
const [overrideModal,setOverrideModal] = useState(null);
const [photoModal,setPhotoModal] = useState(null);


/* LOAD CLASSES */

const loadClasses = async()=>{

try{

const res = await getClasses();

setClasses(res.data.classes);

if(!selectedClass && res.data.classes.length>0){
setSelectedClass(res.data.classes[0]);
}

}catch{

toast.error('Failed to load classes');

}

};


/* LOAD ATTENDANCE */

const loadAttendanceData = useCallback(async()=>{

if(!selectedClass) return;

setLoading(true);

try{

const [attRes,stdRes] = await Promise.all([
getClassAttendance(selectedClass._id),
getClassStudents(selectedClass._id)
]);

const attendance = attRes.data;
const enrolledStudents = stdRes.data.students || [];

const stats = attendance.records || [];

const today = new Date();
today.setHours(0,0,0,0);

const studentStats = enrolledStudents.map(student=>{

const studentRecords = stats.filter(
r => r.student._id === student._id
);

const todayRecord = studentRecords.find(
r => new Date(r.date) >= today
);

const present = studentRecords.length;
const total = attendance.class?.totalClassesHeld || 0;
const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

return{
student,
present,
total,
percentage,
todayStatus: todayRecord ? todayRecord.status : 'absent',
todayRecord
};

});

setAttendanceData({
...attendance,
studentStats
});

}catch(err){

console.error(err);
toast.error('Failed to load attendance');

}finally{

setLoading(false);

}

},[selectedClass]);


/* LOAD ELIGIBILITY */

const loadEligibility = useCallback(async()=>{

if(!selectedClass) return;

try{

const res = await getEligibilityReport(selectedClass._id);
setEligibilityReport(res.data);

}catch{}

},[selectedClass]);


/* LOAD BLE DEVICES (only when class selected) */

const loadActiveDevices = useCallback(async()=>{

if(!selectedClass) return;

try{

const res = await getActiveDevices(selectedClass._id);
setActiveDevices(res.data.activeDevices || []);

}catch{}

},[selectedClass]);


/* INITIAL LOAD */

useEffect(()=>{
loadClasses();
},[]);


/* WHEN CLASS CHANGES */

useEffect(()=>{

if(selectedClass){

loadAttendanceData();
loadEligibility();
loadActiveDevices();

}

},[selectedClass]);


/* START SESSION */

const handleStartSession = async () => {

try{

await startSession({
classId:selectedClass._id
});

toast.success("Attendance session started");

await loadClasses();
loadAttendanceData();

}catch(err){

toast.error(err.response?.data?.message || "Failed to start session");

}

};


/* MANUAL OVERRIDE */

const handleManualOverride = async({studentId,status})=>{

try{

await manualOverride({
studentId,
classId:selectedClass._id,
status
});

toast.success('Attendance updated');

setOverrideModal(null);

loadAttendanceData();
loadEligibility();

}catch(err){

toast.error(err.response?.data?.message || 'Override failed');

}

};


const filteredStudentStats =
attendanceData?.studentStats || [];

const todayPresent =
filteredStudentStats.filter(
s => s.todayStatus==='present'
).length;

const totalStudents =
filteredStudentStats.length;

const belowThreshold =
eligibilityReport?.ineligible?.length || 0;



// --- CSV DOWNLOAD LOGIC ---

const downloadCSV = () => {
  if (!selectedClass || filteredStudentStats.length === 0) {
    toast.error("No data to download");
    return;
  }

  // Define headers
  const headers = ["Student Name", "Roll Number", "Total Present", "Total Classes Held", "Percentage", "Today's Status"];
  
  // Format data
  const rows = filteredStudentStats.map(s => [
    s.student.name,
    s.student.rollNumber,
    s.present,
    s.total,
    `${s.percentage}%`,
    s.todayStatus === 'present' ? 'Present' : 'Absent'
  ]);

  // Create CSV string
  const csvContent = [
    headers.join(","),
    ...rows.map(r => r.map(x => `"${x}"`).join(",")) // Escaping commas in values
  ].join("\n");

  // Create Blob and trigger download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${selectedClass.subject}_Attendance_Report.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

return(


<div className="min-h-screen bg-gray-50">

<Navbar/>

<div className="max-w-7xl mx-auto px-4 py-6">


{/* HEADER */}

<div className="flex items-center justify-between mb-6">

<div>

<h1 className="text-2xl font-bold text-gray-900">
Teacher Dashboard
</h1>

<p className="text-gray-500 text-sm">
Welcome, {user?.name}
</p>

</div>

{selectedClass && (

<div className="flex gap-2 items-center">

<button
type="button"
onClick={downloadCSV}
className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700"
>
<Download className="w-4 h-4"/>
Download Report
</button>

<button
type="button"
onClick={handleStartSession}
disabled={selectedClass?.attendanceActive}
className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm ${
selectedClass?.attendanceActive
? 'bg-green-100 text-green-700'
: 'bg-blue-600 hover:bg-blue-700 text-white'
}`}
>

<Play className="w-4 h-4"/>

{selectedClass?.attendanceActive
? 'Session Active'
: 'Start Session'}

</button>

</div>

)}

</div>


{/* MAIN GRID */}

<div className="grid lg:grid-cols-4 gap-6">


{/* CLASS LIST */}

<div className="lg:col-span-1">

<div className="card">

<h3 className="font-semibold mb-3 flex items-center gap-2">

<BookOpen className="w-4 h-4 text-purple-600"/>

My Classes

</h3>

{classes.map(cls=>(

<button
type="button"
key={cls._id}
onClick={()=>setSelectedClass(cls)}
className={`w-full text-left p-3 rounded-lg border-2 mb-2 ${
selectedClass?._id===cls._id
? 'border-purple-500 bg-purple-50'
: 'border-gray-200'
}`}
>

<div className="font-medium text-sm">{cls.subject}</div>

<div className="text-xs text-gray-500">{cls.subjectCode}</div>

</button>

))}

</div>


{/* BLE DEVICES */}

<div className="card mt-4">

<h3 className="font-semibold mb-2 flex items-center gap-2">

<Bluetooth className="w-4 h-4 text-blue-600"/>

Detected Devices

</h3>

{activeDevices.length === 0 ? (

<p className="text-xs text-gray-400">

No BLE devices detected

</p>

) : (

activeDevices.map((d,i)=>(

<div key={i} className="text-xs text-gray-700">

{d.student?.name || 'Unknown'} ({d.rssi} dBm)

</div>

))

)}

</div>

</div>


{/* MAIN PANEL */}

<div className="lg:col-span-3">

{selectedClass && (

<>

{/* STATS */}

<div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

<StatCard label="Today Present" value={todayPresent} icon={CheckCircle} color="green"/>
<StatCard label="Total Students" value={totalStudents} icon={Users} color="blue"/>
<StatCard label="Below 75%" value={belowThreshold} icon={AlertTriangle} color="yellow"/>
<StatCard label="Classes Held" value={attendanceData?.class?.totalClassesHeld || 0} icon={BookOpen} color="purple"/>

</div>


{/* STUDENT TABLE */}

<div className="card">

<h3 className="font-bold mb-4">
Student Attendance
</h3>

{loading ? (

<div className="text-center py-6 text-gray-400">
Loading...
</div>

) : (

<div className="overflow-x-auto">

<table className="w-full text-sm">

<thead>

<tr className="border-b text-left text-gray-500">
<th className="pb-2 pr-4">Student</th>
<th className="pb-2 pr-4">Roll</th>
<th className="pb-2 pr-4">Today</th>
<th className="pb-2 pr-4">Overall</th>
<th className="pb-2">Action</th>
</tr>

</thead>

<tbody className="divide-y divide-gray-100">

{filteredStudentStats.map((s,i)=>(

<tr key={i} className="hover:bg-gray-50">

<td className="py-3 pr-4 font-medium">{s.student.name}</td>

<td className="py-3 pr-4 text-xs text-gray-500">{s.student.rollNumber}</td>

<td className="py-3 pr-4">
{s.todayStatus==='present' ? 'Present' : 'Absent'}
</td>

<td className="py-3 pr-4">
<div className="flex items-center gap-2">
<AttendanceCircle percentage={s.percentage}/>
<span className="text-xs text-gray-500 font-medium">{s.present}/{s.total}</span>
</div>
</td>

<td>
<div className="flex items-center gap-2">
<button
type="button"
onClick={()=>setOverrideModal(s.student)}
className="text-gray-400 hover:text-blue-600"
>
<Edit3 className="w-4 h-4"/>
</button>

{s.todayRecord?.photo && (
  <button
  type="button"
  onClick={()=>setPhotoModal(s.todayRecord.photo)}
  className="text-gray-400 hover:text-green-600"
  title="View Photo"
  >
  <Camera className="w-4 h-4"/>
  </button>
)}
</div>
</td>

</tr>

))}

</tbody>

</table>

</div>

)}

</div>

</>

)}

</div>

{overrideModal && (
  <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-bold text-gray-900">
          Edit Attendance
        </h3>
        <button onClick={()=>setOverrideModal(null)} className="text-gray-500 hover:text-red-500 transition-colors">
          <X className="w-6 h-6"/>
        </button>
      </div>
      <div className="p-6">
        <p className="text-sm text-gray-600 mb-6 text-center">
          Update attendance for <strong>{overrideModal.name}</strong>
        </p>

        <div className="space-y-3">
          <button
            onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'present' })}
            className="w-full py-3 rounded-xl bg-green-50 text-green-700 font-bold hover:bg-green-100 transition-all border border-green-200 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-5 h-5"/>
            Mark Present
          </button>
          
          <button
            onClick={() => handleManualOverride({ studentId: overrideModal._id, status: 'absent' })}
            className="w-full py-3 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100 transition-all border border-red-200 flex items-center justify-center gap-2"
          >
            <AlertTriangle className="w-5 h-5"/>
            Mark Absent
          </button>

          <button
            onClick={() => setOverrideModal(null)}
            className="w-full py-3 rounded-xl bg-gray-50 text-gray-700 font-bold hover:bg-gray-100 transition-all border border-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
)}

{photoModal && (
  <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Camera className="w-5 h-5"/>
          Attendance Photo
        </h3>
        <button onClick={()=>setPhotoModal(null)} className="text-gray-500 hover:text-red-500 transition-colors">
          <X className="w-6 h-6"/>
        </button>
      </div>
      <div className="bg-gray-100 p-4 flex justify-center">
        <img src={photoModal} alt="Student Attendance" className="rounded-xl w-full h-auto shadow-md" />
      </div>
    </div>
  </div>
)}

</div>

</div>

</div>

);

}