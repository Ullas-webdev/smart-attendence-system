import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, BookOpen, AlertTriangle, Bluetooth, Camera, X } from 'lucide-react';
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

const [showCamera,setShowCamera] = useState(false);
const [photoData,setPhotoData] = useState(null);
const [cameraStream,setCameraStream] = useState(null);
const videoRef = useRef(null);
const canvasRef = useRef(null);

useEffect(() => {
  if (showCamera && videoRef.current && cameraStream) {
    videoRef.current.srcObject = cameraStream;
  }
}, [showCamera, cameraStream]);

const startCamera = async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    setCameraStream(stream);
    setShowCamera(true);
    setPhotoData(null);
  } catch (err) {
    toast.error("Failed to access camera");
  }
};

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    setCameraStream(null);
  }
  setShowCamera(false);
};

const handleCaptureAndScan = async () => {
  if (!selectedClass) return;
  if (!videoRef.current || !canvasRef.current) return;

  // 1. Synchronously capture photo from video feed
  const context = canvasRef.current.getContext('2d');
  canvasRef.current.width = videoRef.current.videoWidth;
  canvasRef.current.height = videoRef.current.videoHeight;
  context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
  const capturedPhoto = canvasRef.current.toDataURL('image/jpeg');

  // 2. Immediately request Bluetooth device before ANY React state updates.
  let beacon = null;
  try {
    beacon = await scanForESP32Beacon();
  } catch (err) {
    // Explicitly show the mobile error
    toast.error(err.message || "Bluetooth scan failed");
    return;
  }

  // 3. Now we can safely execute React state updates and network calls safely!
  setPhotoData(capturedPhoto);
  stopCamera();
  setMarking(true);

  if (!beacon) {
    toast.error("Bluetooth pairing cancelled or failed");
    setMarking(false);
    return;
  }

  if (beacon.rssi && beacon.rssi < -70) {
    toast.error("Move closer to classroom beacon");
    setMarking(false);
    return;
  }

  setBeaconDevice(beacon);

  // 4. Send physical data to backend APIs
  try {
    await markAttendance({ classId: selectedClass._id, photoData: capturedPhoto });
    
    setTodayMarked(true);
    await loadStats();
    
    toast.success(`Beacon detected: ${beacon.name}`);
    toast.success("Attendance marked successfully");
  } catch(err) {
    toast.error(err.response?.data?.message || "Failed to mark attendance");
  } finally {
    setMarking(false);
  }
};



/* -----------------------------
   LOAD CLASSES & STATS
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

useEffect(()=>{
  if(!selectedClass) return;
  const stat = stats.find(s => s.class?.id === selectedClass._id);
  if(stat?.todayStatus === "present" || stat?.todayStatus === "manual_override"){
    setTodayMarked(true);
  }else{
    setTodayMarked(false);
  }
},[selectedClass,stats]);

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
onClick={startCamera}
disabled={marking}
className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2"
>
<Camera className="w-5 h-5"/>
{marking ? 'Processing...' : 'Capture Photo & Mark Attendance'}

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

{/* CAMERA MODAL */}
{showCamera && (
  <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
    <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl relative">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-bold text-gray-900 flex items-center gap-2">
          <Camera className="w-5 h-5"/>
          Verify Identity
        </h3>
        <button onClick={stopCamera} className="text-gray-500 hover:text-red-500 transition-colors">
          <X className="w-6 h-6"/>
        </button>
      </div>
      
      <div className="bg-black relative aspect-square flex items-center justify-center">
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          className="w-full h-full object-cover transform -scale-x-100"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      <div className="p-4 bg-gray-50">
        <button
          onClick={handleCaptureAndScan}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors text-white font-bold text-lg"
        >
          Capture & Submit
        </button>
        <p className="text-xs text-center text-gray-500 mt-3">
          Your photo will be analyzed to prevent attendance fraud.
        </p>
      </div>
    </div>
  </div>
)}

</div>

);

}