import React, { useState, useEffect } from 'react';
import { CheckCircle, BookOpen, AlertTriangle, Bluetooth } from 'lucide-react';
import Navbar from '../components/Navbar';
import { AttendanceCircle, EligibilityBadge, StatCard } from '../components/AttendanceStats';
import { useAuth } from '../context/AuthContext';
import { getClasses, markAttendance, getMyStats } from '../services/api';
import { scanForESP32Beacon } from '../utils/bleScanner';
import toast from 'react-hot-toast';

export default function StudentDashboard(){

const { user } = useAuth();

const [classes,setClasses] = useState([]);
const [stats,setStats] = useState([]);
const [selectedClass,setSelectedClass] = useState(null);

const [marking,setMarking] = useState(false);
const [todayMarked,setTodayMarked] = useState(false);

const [activeTab,setActiveTab] = useState('attendance');

const [beaconDevice,setBeaconDevice] = useState(null);



/* -----------------------------
   LOAD CLASSES
----------------------------- */

const loadClasses = async ()=>{
try{

const res = await getClasses();

setClasses(res.data.classes);

if(res.data.classes.length>0 && !selectedClass){
setSelectedClass(res.data.classes[0]);
}

}catch{
toast.error('Failed to load classes');
}
};



/* -----------------------------
   LOAD STATS
----------------------------- */

const loadStats = async ()=>{

try{

const res = await getMyStats();

setStats(res.data.stats);

}catch{}

};



useEffect(()=>{
loadClasses();
loadStats();
},[]);



/* -----------------------------
   UPDATE todayMarked
----------------------------- */

useEffect(()=>{

if(!selectedClass) return;

const stat = stats.find(
s => s.class?.id === selectedClass._id
);

if(stat?.todayStatus === "present" || stat?.todayStatus === "manual_override"){
setTodayMarked(true);
}else{
setTodayMarked(false);
}

},[selectedClass,stats]);



/* -----------------------------
   MARK ATTENDANCE
----------------------------- */

const handleMarkAttendance = async () => {

if(!selectedClass) return;

setMarking(true);

try{

/* BLE SCAN */

const beacon = await scanForESP32Beacon();

if(!beacon){

toast.error("No Bluetooth device detected");

setMarking(false);

return;

}

setBeaconDevice(beacon);


/* RSSI PROXIMITY CHECK */

if(beacon.rssi && beacon.rssi < -70){

toast.error("Move closer to classroom beacon");

setMarking(false);

return;

}


/* CALL BACKEND */

await markAttendance({ classId:selectedClass._id });


setTodayMarked(true);

await loadStats();

toast.success(`Beacon detected: ${beacon.name}`);

toast.success("Attendance marked successfully");


}catch(err){

toast.error(err.response?.data?.message || "Failed to mark attendance");

}finally{

setMarking(false);

}

};



/* -----------------------------
   STATS
----------------------------- */

const selectedStats = stats.find(
s => s.class?.id === selectedClass?._id
);

const overallAvg = stats.length>0
? Math.round(stats.reduce((a,b)=>a+b.percentage,0)/stats.length)
:0;

const belowThreshold = stats.filter(s=>!s.eligible).length;



return(

<div className="min-h-screen bg-gray-50">

<Navbar/>

<div className="max-w-6xl mx-auto px-4 py-6">


{/* HEADER */}

<div className="mb-6">

<h1 className="text-2xl font-bold text-gray-900">
Welcome, {user?.name?.split(' ')[0]} 👋
</h1>

<p className="text-gray-500 text-sm">
{user?.rollNumber} • {user?.department} • Semester {user?.semester}
</p>

</div>



{/* TABS */}

<div className="flex gap-1 bg-gray-200 p-1 rounded-xl mb-6 w-fit">

{['attendance','stats'].map(tab=>(

<button
key={tab}
onClick={()=>setActiveTab(tab)}
className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
activeTab===tab
? 'bg-white shadow text-blue-600'
: 'text-gray-600'
}`}
>

{tab==='attendance'
? '📡 Mark Attendance'
: '📊 My Stats'}

</button>

))}

</div>



{/* ATTENDANCE TAB */}

{activeTab==='attendance' && (

<div className="grid lg:grid-cols-3 gap-6">


{/* SUBJECT LIST */}

<div className="lg:col-span-1">

<div className="card">

<h3 className="font-semibold mb-3 flex items-center gap-2">
<BookOpen className="w-4 h-4 text-blue-600"/>
My Subjects
</h3>

{classes.map(cls=>(

<button
key={cls._id}
onClick={()=>setSelectedClass(cls)}
className={`w-full text-left p-3 rounded-lg border-2 mb-2 ${
selectedClass?._id===cls._id
? 'border-blue-500 bg-blue-50'
: 'border-gray-200'
}`}
>

<div className="font-medium text-sm">{cls.subject}</div>

<div className="text-xs text-gray-500">{cls.subjectCode}</div>

</button>

))}

</div>

</div>



{/* ATTENDANCE PANEL */}

<div className="lg:col-span-2">

<div className="card">

{selectedClass && (

<>

<h2 className="text-xl font-bold mb-2">
{selectedClass.subject}
</h2>



{/* BLE STATUS */}

{beaconDevice && (

<div className="mb-4 bg-blue-50 p-3 rounded-lg flex items-center gap-2">

<Bluetooth className="w-4 h-4 text-blue-600"/>

<div className="text-sm">
Beacon detected: <strong>{beaconDevice.name}</strong>
</div>

</div>

)}



{/* ATTENDANCE STATS */}

{selectedStats && (

<div className="flex items-center gap-4 mb-4">

<AttendanceCircle percentage={selectedStats.percentage}/>

<div>

<div className="text-sm text-gray-500">
{selectedStats.present}/{selectedStats.total} classes
</div>

<EligibilityBadge percentage={selectedStats.percentage}/>

</div>

</div>

)}



{/* ATTENDANCE BUTTON */}

{todayMarked ? (

<div className="bg-green-50 p-4 rounded-xl flex gap-3">

<CheckCircle className="text-green-600"/>

<div className="text-green-700 font-semibold">
Attendance Marked
</div>

</div>

) : (

<button
onClick={handleMarkAttendance}
disabled={marking}
className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold"
>

{marking ? 'Scanning classroom beacon...' : 'Mark Attendance'}

</button>

)}

</>

)}

</div>

</div>

</div>

)}



{/* STATS TAB */}

{activeTab==='stats' && (

<div>

<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">

<StatCard label="Overall Avg" value={`${overallAvg}%`} icon={CheckCircle}/>

<StatCard label="Subjects" value={stats.length} icon={BookOpen}/>

<StatCard label="Below 75%" value={belowThreshold} icon={AlertTriangle}/>

<StatCard label="Eligible" value={`${stats.length-belowThreshold}/${stats.length}`} icon={CheckCircle}/>

</div>

</div>

)}

</div>

</div>

);

}