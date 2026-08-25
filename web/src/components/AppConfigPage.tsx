
import React, { useState, useEffect } from 'react';
import { db, storage } from '../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';

const { doc, getDoc, setDoc } = _firestore as any;
const { ref, uploadBytes, getDownloadURL } = _storage as any;

const AppConfigPage: React.FC = () => {
  const [minVersionCode, setMinVersionCode] = useState<string>('');
  const [authorizedSignature, setAuthorizedSignature] = useState<string>('');
  const [announcementText, setAnnouncementText] = useState<string>('');
  const [maintenanceMode, setMaintenanceMode] = useState<boolean>(false);
  
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'android_config'));
        if (snap.exists()) {
          const data = snap.data();
          if (data.min_version_code !== undefined) {
            setMinVersionCode(data.min_version_code.toString());
          }
          if (data.authorized_signature) {
            setAuthorizedSignature(data.authorized_signature);
            setSignaturePreview(data.authorized_signature);
          }
          if (data.announcement_text) {
            setAnnouncementText(data.announcement_text);
          }
          if (data.maintenance_mode !== undefined) {
            setMaintenanceMode(data.maintenance_mode);
          }
        }
      } catch (err: any) {
        console.error('Error loading app config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSignatureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSignatureFile(file);
      setSignaturePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);

    try {
      let finalSignatureUrl = authorizedSignature;

      if (signatureFile) {
        const storageRef = ref(storage, `signatures/admin_authorized_${Date.now()}.png`);
        const uploadRes = await uploadBytes(storageRef, signatureFile);
        finalSignatureUrl = await getDownloadURL(uploadRes.ref);
        setAuthorizedSignature(finalSignatureUrl);
      }

      const payload: any = {
        min_version_code: parseInt(minVersionCode, 10) || 0,
        authorized_signature: finalSignatureUrl,
        announcement_text: announcementText.trim(),
        maintenance_mode: maintenanceMode,
        updated_at: Date.now()
      };

      await setDoc(doc(db, 'settings', 'android_config'), payload, { merge: true });
      setStatusMessage({ text: 'కాన్ఫిగరేషన్ విజయవంతంగా సేవ్ చేయబడింది!', type: 'success' });
    } catch (err: any) {
      console.error('Save error:', err);
      setStatusMessage({ text: `సేవ్ చేయడంలో లోపం: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="font-mallanna text-black animate-fade-in max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-ramabhadra leading-tight">యాప్ కాన్ఫిగరేషన్ (App Configuration)</h2>
            <p className="text-gray-300 text-sm font-bold uppercase tracking-wider">వర్షన్ అప్‌డేట్స్ & అధికారిక సంతకం నిర్వహణ</p>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-4 rounded-2xl mb-6 font-bold text-sm border ${
          statusMessage.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {statusMessage.text}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm space-y-6">
        {/* Force Update Config */}
        <div className="space-y-2 border-b pb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-red-600 rounded-full"></span>
            <h3 className="font-ramabhadra text-2xl text-gray-800">కనీస యాప్ వర్షన్ కోడ్ (Mandatory Update)</h3>
          </div>
          <p className="text-gray-500 text-sm">
            ఈ వర్షన్ కోడ్ కంటే తక్కువ వర్షన్ ఉన్న యూజర్లకు ఆటోమేటిక్‌గా ప్లే స్టోర్ అప్‌డేట్ ప్రాంప్ట్ కనిపిస్తుంది.
          </p>
          
          <div className="pt-2">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">కనిష్ట వర్షన్ కోడ్ (Minimum Required Version Code)</label>
            <input
              type="number"
              value={minVersionCode}
              onChange={e => setMinVersionCode(e.target.value)}
              placeholder="ఉదా: 599"
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-lg font-bold bg-gray-50 outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>

        {/* Authorized Signature for ID Cards */}
        <div className="space-y-3 border-b pb-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
            <h3 className="font-ramabhadra text-2xl text-gray-800">అధికారిక సంతకం (Authorized Signature)</h3>
          </div>
          <p className="text-gray-500 text-sm">
            రిపోర్టర్ల డిజిటల్ ఐడీ కార్డులలో ముద్రించబడే అధికారి/ఎడిటర్ సంతకం.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
            {signaturePreview ? (
              <div className="w-48 h-24 border rounded-2xl bg-gray-50 p-2 flex items-center justify-center shadow-inner">
                <img src={signaturePreview} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
              </div>
            ) : (
              <div className="w-48 h-24 border-2 border-dashed border-gray-300 rounded-2xl flex items-center justify-center text-xs text-gray-400 font-bold text-center p-2">
                సంతకం అప్‌లోడ్ చేయబడలేదు
              </div>
            )}

            <div className="flex-1 space-y-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">కొత్త సంతకం ఇమేజ్ అప్‌లోడ్ చేయండి (PNG/JPG)</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleSignatureChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
          </div>
        </div>

        {/* Notice & Maintenance */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-6 bg-purple-600 rounded-full"></span>
            <h3 className="font-ramabhadra text-2xl text-gray-800">యాప్ అనౌన్స్‌మెంట్ & మెయింటెనెన్స్</h3>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">ముఖ్య గమనిక / టిక్కర్ సందేశం (Ticker / Notice)</label>
            <input
              type="text"
              value={announcementText}
              onChange={e => setAnnouncementText(e.target.value)}
              placeholder="యాప్ పైన స్క్రోల్ అయ్యే ముఖ్య సందేశం..."
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base bg-gray-50 outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="maintenanceMode"
              checked={maintenanceMode}
              onChange={e => setMaintenanceMode(e.target.checked)}
              className="w-5 h-5 text-purple-600 rounded"
            />
            <label htmlFor="maintenanceMode" className="text-base font-bold text-gray-800 cursor-pointer">
              మెయింటెనెన్స్ మోడ్ (Maintenance Mode Enable చేయండి)
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-gray-900 hover:bg-black text-white py-4 rounded-2xl font-bold text-xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {saving ? 'భద్రపరుస్తున్నాము...' : 'కాన్ఫిగరేషన్ సేవ్ చేయండి (Save Settings)'}
        </button>
      </form>
    </div>
  );
};

export default AppConfigPage;
