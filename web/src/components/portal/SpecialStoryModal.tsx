import React, { useState, useRef, ChangeEvent } from 'react';
import { User, NewsPost } from '../../types';
import { db, storage } from '../../services/firebase';
import * as _firestore from 'firebase/firestore';
import * as _storage from 'firebase/storage';
import { X, Sparkles, Upload, PenTool, CheckCircle, ShieldAlert, Image as ImageIcon, Loader2 } from 'lucide-react';
import { FALLBACK_SPECIAL_IMAGE } from './portalUtils';

const { collection, addDoc, doc, setDoc } = _firestore as any;
const { ref, uploadBytesResumable, getDownloadURL } = _storage as any;

interface SpecialStoryModalProps {
  currentUser: User | null;
  onClose: () => void;
  onStoryCreated: (newPost: NewsPost) => void;
}

const CATEGORIES_OPTIONS = [
  'స్పెషల్ స్టోరీస్',
  'ఆంధ్రప్రదేశ్',
  'తెలంగాణ',
  'రాజకీయ విశ్లేషణ',
  'దర్యాప్తు కథనం',
  'గ్రౌండ్ రిపోర్ట్',
  'జాతీయం',
  'సినిమా స్పెషల్',
  'వ్యాపారం',
];

export const SpecialStoryModal: React.FC<SpecialStoryModalProps> = ({
  currentUser,
  onClose,
  onStoryCreated,
}) => {
  const [headline, setHeadline] = useState('');
  const [fullStory, setFullStory] = useState('');
  const [shortSummary, setShortSummary] = useState('');
  const [category, setCategory] = useState('స్పెషల్ స్టోరీస్');
  const [location, setLocation] = useState('అమరావతి');
  const [authorName, setAuthorName] = useState(currentUser?.name || 'ఆల్ఫా స్పెషల్ డెస్క్');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

  const [webOnlyChecked, setWebOnlyChecked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setImageUrl('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!headline.trim()) {
      alert('దయచేసి శీర్షిక (Headline) నమోదు చేయండి.');
      return;
    }
    if (!fullStory.trim()) {
      alert('దయచేసి పూర్తి కథనం (Full Story) నమోదు చేయండి.');
      return;
    }

    try {
      setIsSubmitting(true);
      let finalMediaUrl = imageUrl.trim() || FALLBACK_SPECIAL_IMAGE;

      // Upload image to Firebase Storage if a local file was selected
      if (imageFile) {
        const fileId = `${Date.now()}_special_${Math.random().toString(36).substring(2, 7)}`;
        const storageRef = ref(storage, `news-media/${fileId}.webp`);
        const uploadTask = uploadBytesResumable(storageRef, imageFile, { contentType: imageFile.type || 'image/webp' });

        await new Promise((resolve, reject) => {
          uploadTask.on(
            'state_changed',
            (snapshot: any) => {
              const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
              setUploadProgress(Math.round(pct));
            },
            (error: any) => reject(error),
            async () => {
              finalMediaUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(finalMediaUrl);
            }
          );
        });
      }

      // Prepare Firestore payload
      // "ee special story select chesukunte AI process kaakunda manamu edi raste ade vastundi , kevalam website lo maatrame prachurithamavvali , android app lo raadu"
      const now = Date.now();
      const newsDocData: any = {
        headline: {
          telugu: headline.trim(),
          english: '',
        },
        content: {
          telugu: shortSummary.trim() || fullStory.trim().slice(0, 160) + '...',
          english: '',
        },
        fullStory: {
          telugu: fullStory.trim(),
          english: '',
        },
        mediaUrl: finalMediaUrl,
        mediaUrls: [finalMediaUrl],
        mediaType: 'IMAGE',
        postFormat: '16:9',
        location: location.trim() || 'అమరావతి',
        district: 'State',
        state: 'AP',
        category: 'స్పెషల్ స్టోరీస్',
        categories: ['స్పెషల్ స్టోరీస్', category].filter(Boolean),
        reporter: {
          id: currentUser?.id || 'web_editor',
          name: authorName.trim() || 'ఆల్ఫా స్పెషల్ డెస్క్',
        },
        approved: true,
        status: 'published',
        aiProcessed: true, // Prevents Cloud Functions from AI processing
        isSpecialStory: true,
        webOnly: webOnlyChecked, // Excluded from Android App!
        notificationWorthy: false, // Excluded from push notifications
        timestamp: now,
        likes: 0,
        comments: 0,
        shares: 0,
        tags: ['స్పెషల్ స్టోరీ', 'Alfa Special', 'Web Exclusive'],
      };

      // Save directly to Firestore
      const docRef = await addDoc(collection(db, 'news'), newsDocData);

      const createdPost: NewsPost = {
        id: docRef.id,
        ...newsDocData,
      };

      alert('స్పెషల్ స్టోరీ విజయవంతంగా వెబ్‌సైట్‌లో ప్రచురించబడింది!');
      onStoryCreated(createdPost);
      onClose();
    } catch (err: any) {
      console.error('Error creating special story:', err);
      alert(`లోపం ఏర్పడింది: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex justify-center p-3 sm:p-6 animate-fade-in">
      <div 
        className="bg-white w-full max-w-3xl my-auto rounded-3xl shadow-2xl overflow-hidden border border-amber-200 flex flex-col animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="bg-gradient-to-r from-red-800 via-rose-800 to-amber-800 text-white p-5 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-yellow-400 text-red-950 flex items-center justify-center shadow">
              <Sparkles className="w-5 h-5 fill-red-950" />
            </div>
            <div>
              <h2 className="font-ramabhadra text-xl sm:text-2xl font-bold">
                స్పెషల్ స్టోరీ ప్రచురించండి
              </h2>
              <p className="font-mallanna text-xs sm:text-sm text-yellow-100">
                వెబ్‌సైట్ ప్రత్యేకం • AI ప్రాసెస్ లేకుండా మీరు రాసిన విధంగానే నేరుగా పబ్లిష్ అవుతుంది.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[80vh]">
          {/* NOTICE BANNER */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-3 text-xs font-mallanna text-amber-900">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">స్పెషల్ స్టోరీ నిబంధన:</p>
              <p className="mt-0.5">
                ఈ ఫీచర్ ద్వారా పంపే కథనాలు ఎటువంటి AI పునఃసమీక్ష లేకుండా యథాతథంగా వెబ్‌సైట్ పాఠకులకు కనిపిస్తాయి. ఇవి మొబైల్ యాప్‌లో కనిపించవు.
              </p>
            </div>
          </div>

          {/* 1. శీర్షిక (Headline) */}
          <div>
            <label className="block font-ramabhadra text-sm font-bold text-gray-800 mb-1.5">
              వార్త శీర్షిక (Headline) *
            </label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="ఉదాహరణ: అమరావతి రాజధానిలో శరవేగంగా సాగుతున్న నూతన ప్రాజెక్టుల నిర్మాణం..."
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none font-ramabhadra text-base transition-all"
            />
          </div>

          {/* 2. CATEGORY & LOCATION & AUTHOR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-ramabhadra text-xs font-bold text-gray-700 mb-1">
                వర్గం (Category)
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-red-500 outline-none font-ramabhadra text-sm"
              >
                {CATEGORIES_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-ramabhadra text-xs font-bold text-gray-700 mb-1">
                ప్రాంతం (Location)
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="అమరావతి / హైదరాబాద్"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-red-500 outline-none font-ramabhadra text-sm"
              />
            </div>

            <div>
              <label className="block font-ramabhadra text-xs font-bold text-gray-700 mb-1">
                రచయిత / డెస్క్ పేరు
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="ఆల్ఫా స్పెషల్ డెస్క్"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-red-500 outline-none font-ramabhadra text-sm"
              />
            </div>
          </div>

          {/* 3. MEDIA UPLOAD / IMAGE URL */}
          <div>
            <label className="block font-ramabhadra text-sm font-bold text-gray-800 mb-1.5">
              వార్త చిత్రం (Feature Image)
            </label>
            
            <div className="flex flex-col sm:flex-row gap-3 items-center">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-gray-300 hover:border-red-500 hover:bg-red-50 text-gray-700 font-ramabhadra text-xs font-bold flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                <Upload className="w-4 h-4 text-red-600" />
                <span>కంప్యూటర్ నుండి ఫోటో అప్‌లోడ్ చేయండి</span>
              </button>

              <span className="text-xs text-gray-400 font-mallanna">లేదా</span>

              <input
                type="url"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageFile(null);
                  setImagePreview('');
                }}
                placeholder="ఇమేజ్ లింక్ (Image URL) ఇక్కడ పేస్ట్ చేయండి"
                className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-red-500 outline-none text-xs"
              />
            </div>

            {/* Image Preview */}
            {(imagePreview || imageUrl) && (
              <div className="mt-3 relative w-full h-44 rounded-xl overflow-hidden bg-slate-900 border border-gray-200">
                <img
                  src={imagePreview || imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview('');
                    setImageUrl('');
                  }}
                  className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* 4. పూర్తి కథనం (Full Story) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-ramabhadra text-sm font-bold text-gray-800">
                పూర్తి సమగ్ర కథనం (Full Story) *
              </label>
              <span className="text-xs text-gray-500 font-mallanna">
                {fullStory.split(/\s+/).filter(Boolean).length} పదాలు
              </span>
            </div>
            <textarea
              rows={8}
              value={fullStory}
              onChange={(e) => setFullStory(e.target.value)}
              placeholder="వార్త పూర్తి కథనాన్ని ఇక్కడ రాయండి. పేరాలుగా విభజించడానికి ఖాళీ లైన్లు ఉపయోగించండి..."
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none font-mallanna text-base leading-relaxed"
            />
          </div>

          {/* 5. సంక్షిప్త వివరణ (Optional Short Summary) */}
          <div>
            <label className="block font-ramabhadra text-xs font-bold text-gray-700 mb-1">
              సంక్షిప్త ముఖ్యాంశం (Short Summary - ఐచ్ఛికం)
            </label>
            <textarea
              rows={2}
              value={shortSummary}
              onChange={(e) => setShortSummary(e.target.value)}
              placeholder="ఖాళీగా ఉంచితే పూర్తి కథనం మొదటి 2 లైన్లు తీసుకుంటుంది..."
              className="w-full px-3 py-2 rounded-xl border border-gray-300 focus:border-red-500 outline-none font-mallanna text-sm"
            />
          </div>

          {/* 6. WEBSITE EXCLUSIVE TOGGLE */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <p className="font-ramabhadra text-sm font-bold text-gray-900">
                వెబ్‌సైట్ ప్రత్యేకం (Web Exclusive)
              </p>
              <p className="font-mallanna text-xs text-gray-600">
                ఈ కథనం AI ప్రాసెస్ కాకుండా నేరుగా వెబ్‌సైట్‌లో మాత్రమే కనిపిస్తుంది. ఆండ్రాయిడ్ యాప్‌లో రాదు.
              </p>
            </div>
            <input
              type="checkbox"
              checked={webOnlyChecked}
              onChange={(e) => setWebOnlyChecked(e.target.checked)}
              className="w-5 h-5 accent-red-600 rounded cursor-pointer"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-300 text-gray-700 font-ramabhadra text-sm font-semibold hover:bg-gray-100 transition-colors"
            >
              రద్దు చేయండి
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-ramabhadra text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>ప్రచురించబడుతోంది... {uploadProgress > 0 ? `${uploadProgress}%` : ''}</span>
                </>
              ) : (
                <>
                  <PenTool className="w-4 h-4" />
                  <span>ఇప్పుడే ప్రచురించండి</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpecialStoryModal;
