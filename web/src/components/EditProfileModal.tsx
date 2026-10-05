
import React, { useState, useEffect } from 'react';
import { User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';
import { db } from '../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { MANDAL_DATA } from '../data/mandalData';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isStaff: boolean;
  defaultPhoto: string;
  defaultSignature: string;
  onSave: (name: string, address: string, district: string, mandal: string, photo: File | null, signature: File | null) => Promise<void>;
  saving: boolean;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ 
    isOpen, onClose, user, isStaff, defaultPhoto, defaultSignature, onSave, saving 
}) => {
  const [editName, setEditName] = useState(user.name);
  const [editAddress, setEditAddress] = useState(user.address || '');
  const [editDistrict, setEditDistrict] = useState(user.district || '');
  const [editMandal, setEditMandal] = useState(user.assignedMandal || user.mandal || '');
  const [occupiedMandals, setOccupiedMandals] = useState<Record<string, string>>({});
  const [occupiedReporterIds, setOccupiedReporterIds] = useState<Record<string, string>>({});
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [isLoadingOccupied, setIsLoadingOccupied] = useState(true);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Check if user is strictly ADMIN to allow signature upload
  const isAdmin = user.role === UserRole.ADMIN;

  // Combine District Lists
  const allDistricts = [...TS_DISTRICTS, ...AP_DISTRICTS].sort();

  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const fetchReporters = async () => {
      setIsLoadingOccupied(true);
      try {
        const q = query(
          collection(db, 'users'),
          where('role', 'in', ['REPORTER', 'reporter', 'STAFF_REPORTER', 'REGIONAL_INCHARGE', 2, 2.0, '2', 3, 3.0, '3'])
        );
        const snap = await getDocs(q);
        if (!isMounted) return;
        const occMap: Record<string, string> = {};
        const occIdMap: Record<string, string> = {};
        snap.forEach(docSnap => {
          const data = docSnap.data();
          if (data.suspended || data.previouslyDowngraded) return;
          const dist = (data.district || '').trim();
          const mandal = (data.assignedMandal || data.mandal || data.mandalam || data.selectedMandal || '').trim();
          const name = data.name || 'విలేకరి';
          const phone = data.phone || '';
          if (dist && mandal) {
            const key = `${dist}|${mandal}`;
            occMap[key] = phone ? `${name} (${phone})` : name;
            occIdMap[key] = docSnap.id;
          }
        });
        setOccupiedMandals(occMap);
        setOccupiedReporterIds(occIdMap);
      } catch (err) {
        console.error('Failed to fetch active reporters:', err);
      } finally {
        if (isMounted) setIsLoadingOccupied(false);
      }
    };
    fetchReporters();
    return () => { isMounted = false; };
  }, [isOpen]);

  const handleMandalChange = (val: string) => {
    setEditMandal(val);
    if (!val) {
      setConflictMessage(null);
      return;
    }
    const key = `${editDistrict.trim()}|${val.trim()}`;
    const occId = occupiedReporterIds[key];
    if (occId && occId !== user.id) {
      const occupant = occupiedMandals[key] || 'విలేకరి';
      const msg = `ఇప్పటికే ఈ మండలానికి విలేకరి ఉన్నారు: ${occupant}`;
      setConflictMessage(msg);
      alert(`ఇప్పటికే ఈ మండలానికి విలేకరి వున్నారు (${occupant})`);
    } else {
      setConflictMessage(null);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const handleSaveClick = () => {
    const key = `${editDistrict.trim()}|${editMandal.trim()}`;
    const occId = occupiedReporterIds[key];
    if (editMandal && occId && occId !== user.id) {
      alert(`ఈ మండలానికి ఇప్పటికే విలేకరి (${occupiedMandals[key]}) ఉన్నారు! దయచేసి వేరే మండలాన్ని ఎంచుకోండి.`);
      return;
    }
    onSave(editName, editAddress, editDistrict, editMandal, photoFile, signatureFile);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center sticky top-0 z-10">
                <h3 className="font-bold text-gray-800 text-lg">Edit Profile Details</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <div className="p-6 space-y-5">
                {/* Name Edit */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Display Name</label>
                    <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)} 
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none text-gray-900 font-medium"
                    />
                </div>

                {/* District Selection - Critical for News */}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <label className="block text-xs font-bold text-blue-800 uppercase tracking-wide mb-1.5">
                        District (For Local News)
                    </label>
                    <p className="text-[10px] text-blue-600 mb-2">
                        దయచేసి ఇక్కడ మీ జిల్లాను ఎంచుకోండి. దీని ఆధారంగానే మీకు "Local News" కనిపిస్తాయి.
                    </p>
                    <select
                        value={editDistrict}
                        onChange={(e) => {
                            const newDist = e.target.value;
                            setEditDistrict(newDist);
                            if (newDist !== editDistrict) {
                                setEditMandal('');
                                setConflictMessage(null);
                            }
                        }}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium bg-white"
                    >
                        <option value="">Select District</option>
                        {allDistricts.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

                {/* Mandal Selection (విలేకరి కేటాయించిన మండలం) */}
                {editDistrict && (
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                        <div className="flex justify-between items-center mb-1.5">
                            <label className="block text-xs font-bold text-amber-900 uppercase tracking-wide">
                                Assigned Mandal (విలేకరి కేటాయించిన మండలం)
                            </label>
                            {isLoadingOccupied && (
                                <span className="text-[10px] text-amber-600 animate-pulse">పరిశీలిస్తోంది...</span>
                            )}
                        </div>
                        <p className="text-[10px] text-amber-700 mb-2">
                            విలేకరులు వార్తలు రిపోర్ట్ చేయడానికి తమ మండలాన్ని ఇక్కడ ఎంచుకోవాలి.
                        </p>
                        <select
                            value={editMandal}
                            onChange={(e) => handleMandalChange(e.target.value)}
                            className={`w-full border rounded-lg p-3 outline-none text-gray-900 font-medium bg-white ${
                                conflictMessage ? 'border-red-500 ring-2 ring-red-400' : 'border-gray-300 focus:ring-2 focus:ring-amber-500'
                            }`}
                        >
                            <option value="">మండలాన్ని ఎంచుకోండి (Select Mandal)</option>
                            {((MANDAL_DATA as Record<string, string[]>)[editDistrict] || []).map((m: string) => {
                                const key = `${editDistrict.trim()}|${m.trim()}`;
                                const occId = occupiedReporterIds[key];
                                const isOccupied = occId && occId !== user.id;
                                const occName = occupiedMandals[key];
                                return (
                                    <option key={m} value={m}>
                                        {m} {isOccupied ? `(ఇప్పటికే విలేకరి ఉన్నారు - ${occName})` : ''}
                                    </option>
                                );
                            })}
                        </select>

                        {conflictMessage && (
                            <div className="mt-2 p-2.5 bg-red-100 border border-red-300 rounded-lg text-red-700 text-xs font-bold flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <span>{conflictMessage}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Address Edit - Free Text for ID Card */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Full Address (For ID Card)</label>
                    <input 
                        type="text" 
                        value={editAddress} 
                        onChange={(e) => setEditAddress(e.target.value)} 
                        placeholder="H.No, Street, Mandal etc."
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-red-500 outline-none text-gray-900 font-medium"
                    />
                </div>

                {/* Photo Upload */}
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Profile Photo</label>
                    <div className="flex items-center gap-4">
                        <img 
                        src={photoPreview || user.photoUrl || defaultPhoto} 
                        className="w-16 h-16 rounded object-cover border" 
                        alt="Preview" 
                        />
                        <input 
                        type="file" 
                        accept="image/*"
                        onChange={handlePhotoChange}
                        className="text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100"
                        />
                    </div>
                </div>
                
                {/* Signature Upload - ONLY FOR ADMIN */}
                {isAdmin && (
                    <div className="bg-red-50 p-3 rounded-lg border border-red-100">
                        <label className="block text-xs font-bold text-red-800 uppercase tracking-wide mb-1.5">
                            Authorized Signature (Admin Only)
                        </label>
                        <p className="text-[10px] text-red-600 mb-2">
                            This signature will appear on ALL staff ID cards as the "Authorized Signature".
                        </p>
                        <div className="flex items-center gap-4">
                            <div className="w-32 h-12 border border-dashed border-red-300 flex items-center justify-center bg-white">
                            <img 
                                src={signaturePreview || user.signatureUrl || defaultSignature} 
                                className="max-w-full max-h-full object-contain p-1" 
                                alt="Sign Preview" 
                            />
                            </div>
                            <input 
                            type="file" 
                            accept="image/png"
                            onChange={handleSignatureChange}
                            className="w-full text-sm text-gray-500 file:mr-2 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-white file:text-red-700 hover:file:bg-red-50"
                            />
                        </div>
                    </div>
                )}

                <button 
                    onClick={handleSaveClick}
                    disabled={saving}
                    className="w-full bg-red-600 text-white font-bold py-3 rounded-lg hover:bg-red-700 disabled:bg-red-300 transition-all shadow-md mt-4"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    </div>
  );
};

export default EditProfileModal;
