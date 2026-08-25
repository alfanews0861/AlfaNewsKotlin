
import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { doc, getDoc, setDoc } = _firestore as any;

const AffiliateSettingsPage: React.FC = () => {
  const [amazonAccessKey, setAmazonAccessKey] = useState('');
  const [amazonSecretKey, setAmazonSecretKey] = useState('');
  const [amazonAssociateTag, setAmazonAssociateTag] = useState('');
  const [flipkartId, setFlipkartId] = useState('');
  const [flipkartToken, setFlipkartToken] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'configs', 'affiliateApi'));
        if (snap.exists()) {
          const data = snap.data();
          setAmazonAccessKey(data.amazonAccessKey || '');
          setAmazonSecretKey(data.amazonSecretKey || '');
          setAmazonAssociateTag(data.amazonAssociateTag || '');
          setFlipkartId(data.flipkartId || '');
          setFlipkartToken(data.flipkartToken || '');
        }
      } catch (err: any) {
        console.error('Error loading affiliate settings:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        amazonAccessKey: amazonAccessKey.trim(),
        amazonSecretKey: amazonSecretKey.trim(),
        amazonAssociateTag: amazonAssociateTag.trim(),
        flipkartId: flipkartId.trim(),
        flipkartToken: flipkartToken.trim(),
        updatedAt: Date.now()
      };

      await setDoc(doc(db, 'configs', 'affiliateApi'), payload, { merge: true });
      setMessage({ text: 'అఫిలియేట్ సెట్టింగ్స్ విజయవంతంగా సేవ్ చేయబడ్డాయి!', type: 'success' });
    } catch (err: any) {
      console.error('Save error:', err);
      setMessage({ text: `సేవ్ చేయడంలో లోపం: ${err.message}`, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="font-mallanna text-black animate-fade-in max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-700 p-6 rounded-[2rem] mb-6 flex items-center justify-between shadow-xl text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl font-ramabhadra leading-tight">అఫిలియేట్ న్యూస్ API (Affiliate Settings)</h2>
            <p className="text-amber-100 text-sm font-bold uppercase tracking-wider">Amazon & Flipkart ప్రాడక్ట్ API కీస్ కాన్ఫిగరేషన్</p>
          </div>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-2xl mb-6 font-bold text-sm border ${
          message.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Amazon Section */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <span className="w-2 h-6 bg-amber-500 rounded-full"></span>
            <h3 className="font-ramabhadra text-2xl text-gray-800">Amazon India API (PA-API 5.0)</h3>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Access Key</label>
            <input
              type="text"
              value={amazonAccessKey}
              onChange={e => setAmazonAccessKey(e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-mono bg-gray-50 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Secret Key</label>
            <input
              type="password"
              value={amazonSecretKey}
              onChange={e => setAmazonSecretKey(e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-mono bg-gray-50 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Associate Tag</label>
            <input
              type="text"
              value={amazonAssociateTag}
              onChange={e => setAmazonAssociateTag(e.target.value)}
              placeholder="alfanews-21"
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-mono bg-gray-50 outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
        </div>

        {/* Flipkart Section */}
        <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <span className="w-2 h-6 bg-blue-600 rounded-full"></span>
            <h3 className="font-ramabhadra text-2xl text-gray-800">Flipkart Affiliate API</h3>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Affiliate Tracking ID</label>
            <input
              type="text"
              value={flipkartId}
              onChange={e => setFlipkartId(e.target.value)}
              placeholder="alfanews"
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-mono bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">API Token</label>
            <input
              type="password"
              value={flipkartToken}
              onChange={e => setFlipkartToken(e.target.value)}
              placeholder="e.g. 78a9c2d..."
              className="w-full border border-gray-300 p-3.5 rounded-2xl text-base font-mono bg-gray-50 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-amber-600 hover:bg-amber-700 text-white py-4 rounded-2xl font-bold text-xl shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
        >
          {saving ? 'భద్రపరుస్తున్నాము...' : 'సెట్టింగ్స్ సేవ్ చేయండి (Save Affiliate Settings)'}
        </button>
      </form>
    </div>
  );
};

export default AffiliateSettingsPage;
