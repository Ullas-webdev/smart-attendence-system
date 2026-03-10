import React, { useState, useEffect, useCallback } from 'react';
import { Users, CheckCircle, AlertTriangle, BookOpen, Play, Edit3, Bluetooth } from 'lucide-react';
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

const studentStats = enrolledStudents.map(student=>{

const record = stats.find(
r => r.student._id === student._id
);

return{
student,
present: record ? 1 : 0,
total: attendance.class?.totalClassesHeld || 0,
percentage: record ? 100 : 0,
todayStatus: record ? 'present' : 'absent'
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
<AttendanceCircle percentage={s.percentage}/>
</td>

<td>

<button
type="button"
onClick={()=>setOverrideModal(s.student)}
className="text-gray-400 hover:text-blue-600"
>
<Edit3 className="w-4 h-4"/>
</button>

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

</div>

</div>

</div>

);

}