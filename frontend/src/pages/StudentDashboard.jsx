import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function StudentDashboard() {
  const [user, setUser] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [applications, setApplications] = useState([]);
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState('income');
  const [loadingMsg, setLoadingMsg] = useState("");
  const [profileStatus, setProfileStatus] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const data = localStorage.getItem('user');
    if (!data) { navigate('/login'); return; }
    const parsed = JSON.parse(data);
    if (parsed.role !== 'student') { navigate('/login'); return; }
    setUser(parsed.student);
    fetchStatus(parsed.student.id);
    fetchProfile(parsed.student.id);
  }, []);

  const fetchStatus = async (student_id) => {
    try {
      const res = await api.get(`/get-status/${student_id}`);
      setApplications(res.data.applications);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProfile = async (id) => {
    try {
      const res = await api.get(`/student/${id}/profile-status`);
      setProfileStatus(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const updateOngoing = async (val) => {
    try {
      setLoadingMsg("Updating profile...");
      await api.post('/student/update-profile', { student_id: user.id, has_ongoing_scholarship: val });
      fetchProfile(user.id);
    } catch(err) {
        alert("Error updating profile");
    } finally { setLoadingMsg(""); }
  };

  const getRecommendations = async () => {
    try {
      setLoadingMsg("Running AI Recommendations...");
      const res = await api.post('/get-recommendation', { income: user.income, marks: user.marks });
      setRecommendations(res.data.recommendations);
    } catch (err) {
      alert("Error fetching recommendations");
    } finally {
      setLoadingMsg("");
    }
  };

  const applyForScholarship = async (sch_id) => {
    try {
      setLoadingMsg("Submitting Application...");
      await api.post('/apply-scholarship', { student_id: user.id, scholarship_id: sch_id });
      fetchStatus(user.id);
      alert("Application successfully submitted!");
    } catch (err) {
      alert(err.response?.data?.error || "Application error");
    } finally {
      setLoadingMsg("");
    }
  };

  const uploadDoc = async (e) => {
    e.preventDefault();
    if (!file) return alert("Select a document file");
    setLoadingMsg("Uploading & AI Verifying...");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("student_id", user.id);
    formData.append("doc_type", docType);
    try {
      const res = await api.post('/upload-document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      fetchProfile(user.id);
      setFile(null);
      alert(res.data.message || "Document uploaded and processed successfully!");
    } catch (err) {
      const errMsg = err.response?.data?.error || "Upload error";
      const isMismatch = err.response?.data?.mismatch_warning;
      if (isMismatch) {
        alert("⚠️ " + errMsg);
      } else {
        alert(errMsg);
      }
      fetchProfile(user.id); 
    } finally {
      setLoadingMsg("");
    }
  };

  const fetchFromDigilocker = async (e) => {
    e.preventDefault();
    const hint = docType === 'income' ? 'e.g., INC1000001 or Aadhaar' 
               : docType === 'marksheet_10' ? 'e.g., TEN1000001 or Aadhaar'
               : docType === 'marksheet_12' ? 'e.g., TWL1000001 or Aadhaar'
               : docType === 'first_graduate' ? 'e.g., 6590 3598 4247'
               : 'e.g., 6590 3598 4247';
    const aadhar = window.prompt(`Enter your ID / Certificate Number for ${docType} (${hint}):`);
    if (!aadhar || aadhar.trim() === "") {
        return;
    }

    setLoadingMsg("Connecting to Gov DigiLocker...");
    setTimeout(async () => {
        try {
            const res = await api.post('/digilocker/fetch', { 
                student_id: user.id, 
                doc_type: docType,
                digilocker_id: aadhar.replace(/\s+/g, '')
            });
            fetchProfile(user.id);
            setFile(null);
            alert(res.data.message || "Document verified via DigiLocker!");
        } catch (err) {
            alert(err.response?.data?.error || "Data doesn't match! DigiLocker verification failed.");
            fetchProfile(user.id);
        } finally {
            setLoadingMsg("");
        }
    }, 1500);
  };

  if (!user || !profileStatus) return <div className="min-h-screen flex items-center justify-center font-bold text-indigo-500 animate-pulse text-2xl">Loading Workspace...</div>;

  const requiredDocs = [
    { id: 'income', label: 'Income Certificate' },
    { id: 'marksheet_10', label: '10th Marksheet' },
    { id: 'marksheet_12', label: '12th Marksheet' },
    { id: 'first_graduate', label: 'Aadhaar' }
  ];
  const uploadedDocs = profileStatus?.uploaded_docs || [];
  const digilockerDocs = profileStatus?.digilocker_docs || [];
  const missingDocs = requiredDocs.filter(d => !uploadedDocs.includes(d.id));
  const hasOngoing = profileStatus.has_ongoing_scholarship;
  const isProfileComplete = hasOngoing !== null && missingDocs.length === 0;

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen animate-fade-in-up">
      {/* Navbar area */}
      <div className="glass-panel px-8 py-5 flex justify-between items-center mb-8 sticky top-4 z-50">
        <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center">
                 <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" /></svg>
            </div>
            <div>
                <h1 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-800 tracking-tight">Student Portal</h1>
                <p className="text-sm font-semibold text-slate-500 tracking-wide">Welcome, {user.name} • <span className="text-indigo-500">{user.student_id}</span></p>
            </div>
        </div>
        <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">AI Trust Score</span>
                <span className={`text-xl font-black ${profileStatus.ai_trust_score >= 80 ? 'text-emerald-500' : profileStatus.ai_trust_score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>
                    {profileStatus.ai_trust_score}/100
                </span>
            </div>
            <button onClick={() => { localStorage.clear(); navigate('/login'); }} className="bg-white text-rose-500 border-2 border-rose-100 px-6 py-2.5 rounded-xl font-bold hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all shadow-sm">Sign Out</button>
        </div>
      </div>

      {loadingMsg && (
          <div className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-indigo-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center font-bold animate-bounce">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              {loadingMsg}
          </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Profile & Uploads */}
        <div className="lg:col-span-1 space-y-8">
            <div className="glass-panel p-6 sm:p-8 transform hover:-translate-y-1 transition duration-300">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">Profile Data</h2>
                </div>
                <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center"><span className="text-slate-500 font-semibold text-sm">Family Income</span><span className="font-bold text-slate-800">₹{user.income}</span></div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center"><span className="text-slate-500 font-semibold text-sm">Academic Marks</span><span className="font-bold text-slate-800">{user.marks}%</span></div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex justify-between items-center"><span className="text-slate-500 font-semibold text-sm">Category / Course</span><span className="font-bold text-slate-800">{user.category} - {user.course}</span></div>
                </div>
                {isProfileComplete && hasOngoing === 0 && (
                  <button onClick={getRecommendations} className="mt-6 w-full bg-slate-800 text-white p-4 rounded-xl font-bold flex justify-center items-center hover:bg-slate-900 transition shadow-lg shadow-slate-300 group">
                      View Eligible Scholarships
                      <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                  </button>
                )}
            </div>

            <div className="glass-panel p-6 sm:p-8 transform hover:-translate-y-1 transition duration-300 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-200/50 rounded-full blur-3xl -mr-10 -mt-10"></div>
                <div className="flex items-center space-x-3 mb-6 relative">
                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg></div>
                    <h2 className="text-xl font-extrabold text-slate-800 tracking-tight">AI Document Upload</h2>
                </div>
                <form onSubmit={uploadDoc} className="space-y-5 relative">
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Document Type</label>
                        <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full p-3.5 bg-white/80 border-2 border-slate-100 focus:border-purple-400 rounded-xl outline-none transition font-semibold text-slate-700 shadow-sm cursor-pointer">
                            {requiredDocs.map(d => (
                              <option key={d.id} value={d.id}>{d.label} {digilockerDocs.includes(d.id) ? '🏛️ (DigiLocker)' : uploadedDocs.includes(d.id) ? '✅' : ''}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-200 border-dashed rounded-xl cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <svg className="w-8 h-8 mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                <p className="text-sm font-semibold text-slate-500 text-center px-4">{file ? <span className="text-indigo-600 max-w-[200px] truncate block">{file.name}</span> : 'Click to select file'}</p>
                            </div>
                            <input type="file" accept="image/*" onChange={e => setFile(e.target.files[0])} className="hidden" />
                        </label>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-xl font-extrabold flex justify-center items-center shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:-translate-y-0.5 transition duration-300">
                            Upload Image 
                        </button>
                        <button type="button" onClick={fetchFromDigilocker} className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-4 rounded-xl font-extrabold flex justify-center items-center shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-0.5 transition duration-300">
                            DigiLocker Fetch 🏛️
                        </button>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 bg-slate-100 p-3 rounded-xl border border-slate-200 shadow-inner">
                        <span className="text-rose-600 font-black block mb-1">WARNING: Strict AI OCR Enforced ⚡</span>
                        Uploading mismatched or fake documents will result in malpractice deduction to your AI Trust Score.
                    </p>
                </form>
            </div>
        </div>

        {/* Right Column: Applications & Recommendations */}
        <div className="lg:col-span-2 space-y-8">
            
            {!isProfileComplete && hasOngoing !== 1 && (
                <div className="glass-panel p-8 border-l-8 border-l-amber-500">
                    <div className="flex items-center space-x-3 mb-6">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div>
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Onboarding Incomplete</h2>
                    </div>
                    <p className="text-slate-600 font-medium mb-6">You must complete your profile by providing the required OCR-verified documents and declaring your current status before you can apply for scholarships.</p>
                    
                    <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 mb-6 shadow-inner">
                        <h3 className="font-extrabold text-slate-800 mb-4">Are you presently receiving any other scholarship?</h3>
                        <div className="flex space-x-4">
                            <button onClick={() => updateOngoing(1)} className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm ${hasOngoing === 1 ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>Yes, I am</button>
                            <button onClick={() => updateOngoing(0)} className={`px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm ${hasOngoing === 0 ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>No, I am not</button>
                        </div>
                        {hasOngoing === 1 && <p className="mt-4 text-sm text-rose-600 font-bold">As per platform rules, active scholarship holders cannot apply for new grants.</p>}
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {requiredDocs.map(d => (
                            <div key={d.id} className={`p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all ${uploadedDocs.includes(d.id) ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'}`}>
                                {digilockerDocs.includes(d.id) ? (
                                    <svg className="w-8 h-8 text-emerald-600 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                ) : uploadedDocs.includes(d.id) ? (
                                    <svg className="w-8 h-8 text-emerald-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                ) : (
                                    <svg className="w-8 h-8 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                )}
                                <span className={`text-xs font-bold ${uploadedDocs.includes(d.id) ? 'text-emerald-700' : 'text-slate-500'}`}>
                                    {d.label} {digilockerDocs.includes(d.id) && <span className="block text-[9px] text-emerald-600 font-black tracking-widest uppercase mt-0.5">DigiLocker 🏛️</span>}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {hasOngoing === 1 && (
                <div className="glass-panel p-10 border-l-8 border-l-rose-500 text-center flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    </div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Ineligible for New Grants</h2>
                    <p className="text-slate-500 font-medium max-w-md">Because you have declared an ongoing scholarship, our "One Scholarship Per Student" rule prevents you from applying for additional funding opportunities.</p>
                </div>
            )}

            {isProfileComplete && hasOngoing === 0 && applications.length > 0 && (
            <div className="glass-panel p-6 sm:p-8 border-l-8 border-l-indigo-500">
                <div className="flex items-center space-x-3 mb-6">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Track Applications</h2>
                </div>
                <div className="grid grid-cols-1 gap-4">
                    {applications.map(a => (
                    <div key={a.id} className="bg-white border border-slate-100 p-6 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row justify-between sm:items-center transform transition duration-300 hover:border-indigo-100 hover:shadow-indigo-500/10">
                        <div className="mb-4 sm:mb-0">
                            <h3 className="text-lg font-extrabold text-slate-800 mb-1">{a.scholarship_name}</h3>
                            <div className="flex items-center space-x-2">
                                <span className={`text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest text-white shadow-sm ${
                                    a.status === 'APPROVED' ? 'bg-emerald-500 shadow-emerald-500/30' :
                                    a.status === 'REJECTED' ? 'bg-rose-500 shadow-rose-500/30' :
                                    a.status === 'FLAGGED' ? 'bg-amber-500 shadow-amber-500/30' :
                                    a.status === 'VERIFIED' ? 'bg-blue-500 shadow-blue-500/30' :
                                    a.status === 'PROVIDER_PENDING' ? 'bg-purple-500 shadow-purple-500/30' : 'bg-slate-400'
                                }`}>{a.status.replace('_', ' ')}</span>
                                <span className="text-xs font-bold text-slate-400">ID: #{a.id}</span>
                            </div>
                        </div>
                        {a.fraud_score > 0 && (
                            <div className="flex flex-col items-center sm:items-end bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">AI Risk Assessment</span>
                                <div className={`px-4 py-1 rounded-full font-black text-sm tracking-wide text-white shadow-md ${
                                    a.fraud_score <= 30 ? 'bg-emerald-500 shadow-emerald-500/20' : 
                                    a.fraud_score <= 70 ? 'bg-amber-500 shadow-amber-500/20' : 'bg-rose-500 shadow-rose-500/20'
                                }`}>
                                    SCORE {a.fraud_score}/100
                                </div>
                            </div>
                        )}
                    </div>
                    ))}
                </div>
            </div>
            )}

            {isProfileComplete && hasOngoing === 0 && (
            <div className="glass-panel p-6 sm:p-8">
                <div className="flex items-center space-x-3 mb-8">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0-3.332.477-4.5 1.253"></path></svg></div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Available Opportunities </h2>
                </div>
                
                {recommendations.length === 0 ? (
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center text-center bg-white/40">
                        <div className="bg-white p-4 rounded-full shadow-sm mb-4"><svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg></div>
                        <h3 className="text-lg font-bold text-slate-700 mb-2">No Recommendations Yet</h3>
                        <p className="text-slate-500 text-sm max-w-sm">Click the <strong>View Eligible Scholarships</strong> button in your profile panel to discover scholarships matching your academic profile.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {recommendations.map(r => (
                        <div key={r.id} className="relative bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 transition duration-300 overflow-hidden group border-l-4 border-l-emerald-400">
                            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 group-hover:opacity-10 transition duration-500">
                                <svg className="w-24 h-24 text-emerald-600" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm0 14a6 6 0 110-12 6 6 0 010 12z"></path></svg>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10">
                                <div>
                                    <h3 className="text-xl font-extrabold text-slate-800 mb-2">{r.name}</h3>
                                    <div className="flex items-center space-x-3 text-sm mb-3">
                                        <div className="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold">Grant: ₹{r.amount.toLocaleString()}</div>
                                        <p className="text-slate-500 font-medium italic"><span className="text-slate-400 not-italic mr-1">🎯 Req:</span>{r.eligibility_criteria}</p>
                                    </div>
                                    <p className="text-slate-600 font-medium text-sm leading-relaxed max-w-xl">{r.description}</p>
                                </div>
                                {(() => {
                                    const alreadyApplied = applications.some(a => a.scholarship_id === r.id || a.scholarship_name === r.name);
                                    return alreadyApplied ? (
                                        <div className="mt-6 sm:mt-0 flex items-center px-8 py-3.5 rounded-xl font-bold bg-emerald-50 border-2 border-emerald-200 text-emerald-700 shadow-sm">
                                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            Applied ✓
                                        </div>
                                    ) : (
                                        <button onClick={() => applyForScholarship(r.id)} className="mt-6 sm:mt-0 w-full sm:w-auto bg-slate-800 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-emerald-600 transition-colors shadow-lg flex items-center justify-center">
                                            Apply Now
                                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                                        </button>
                                    );
                                })()}
                            </div>
                        </div>
                        ))}
                    </div>
                )}
            </div>
            )}
        </div>

      </div>
    </div>
  );
}
