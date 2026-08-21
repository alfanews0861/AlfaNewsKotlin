
import React, { useState } from 'react';
import { User, UserRole, TS_DISTRICTS, AP_DISTRICTS } from '../types';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  isStaff: boolean;
  defaultPhoto: string;
  defaultSignature: string;
  onSave: (name: string, address: string, district: string, photo: File | null, signature: File | null) => Promise<void>;
  saving: boolean;
}

const EditProfileModal: React.FC<EditProfileModalProps> = ({ 
    isOpen, onClose, user, isStaff, defaultPhoto, defaultSignature, onSave, saving 
}) => {
  const [editName, setEditName] = useState(user.name);
  const [editAddress, setEditAddress] = useState(user.address || '');
  const [editDistrict, setEditDistrict] = useState(user.district || '');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // Check if user is strictly ADMIN to allow signature upload
  const isAdmin = user.role === UserRole.ADMIN;

  // Combine District Lists
  const allDistricts = [...TS_DISTRICTS, ...AP_DISTRICTS].sort();

  if (!isOpen) return null;

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
      onSave(editName, editAddress, editDistrict, photoFile, signatureFile);
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
                        onChange={(e) => setEditDistrict(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 font-medium bg-white"
                    >
                        <option value="">Select District</option>
                        {allDistricts.map(d => (
                            <option key={d} value={d}>{d}</option>
                        ))}
                    </select>
                </div>

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
