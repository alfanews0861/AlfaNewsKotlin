import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import { storage, app } from '../services/firebase';
import * as _storage from 'firebase/storage';
import * as _functions from 'firebase/functions';
import {
  User,
  NewsPost,
  TS_DISTRICTS,
  AP_DISTRICTS,
  MANDAL_DATA,
  CATEGORIES,
  UserRole
} from '../types';
import { extractYoutubeVideoId } from './NewsCard';
import { Upload, Video as VideoIcon, X, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

const { ref, uploadBytesResumable, getDownloadURL } = _storage as any;
const { getFunctions, httpsCallable } = _functions as any;

interface PostNewsPageProps {
  user: User;
  postToEdit?: NewsPost | null;
  onActionComplete: () => void;
}

interface MediaItem {
  id: string;
  type: 'IMAGE' | 'VIDEO';
  previewUrl: string;
  file?: File;
  existingUrl?: string;
}

async function compressImageToWebP(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let targetWidth = img.width;
      let targetHeight = img.height;
      const maxDim = 1280;
      if (targetWidth > maxDim || targetHeight > maxDim) {
        const ratio = targetWidth / targetHeight;
        if (ratio > 1) {
          targetWidth = maxDim;
          targetHeight = Math.round(maxDim / ratio);
        } else {
          targetHeight = maxDim;
          targetWidth = Math.round(maxDim * ratio);
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Image conversion to WebP failed'));
        },
        'image/webp',
        0.8
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image file'));
    };
    img.src = objectUrl;
  });
}

function checkVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
    video.src = objectUrl;
  });
}

const PostNewsPage: React.FC<PostNewsPageProps> = ({ user, postToEdit, onActionComplete }) => {
  const isEditMode = !!postToEdit;

  const [headline, setHeadline] = useState(postToEdit?.headline?.telugu || '');
  const [content, setContent] = useState(postToEdit?.content?.telugu || '');
  const [youtubeUrl, setYoutubeUrl] = useState(postToEdit?.youtubeUrl || '');
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);

  const [state, setState] = useState(postToEdit?.state || user.state || 'TS');
  const [district, setDistrict] = useState(postToEdit?.district || user.district || '');
  const [location, setLocation] = useState(postToEdit?.location || user.assignedMandal || '');
  const [category, setCategory] = useState(
    postToEdit?.categories?.find((c) => CATEGORIES.includes(c)) || postToEdit?.category || 'జిల్లా వార్త'
  );
  const [isGlobalNews, setIsGlobalNews] = useState(postToEdit?.isGlobal || false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(isEditMode ? 'వార్తను సవరించండి' : 'వార్తను ప్రచురించండి');

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Initialize media items on edit
  useEffect(() => {
    if (postToEdit) {
      setHeadline(postToEdit.headline?.telugu || '');
      setContent(postToEdit.content?.telugu || '');
      setYoutubeUrl(postToEdit.youtubeUrl || '');
      setState(postToEdit.state || user.state || 'TS');
      setDistrict(postToEdit.district || user.district || '');
      setLocation(postToEdit.location || user.assignedMandal || '');
      setCategory(postToEdit.categories?.find((c) => CATEGORIES.includes(c)) || postToEdit.category || 'జిల్లా వార్త');
      setIsGlobalNews(postToEdit.isGlobal || false);

      const items: MediaItem[] = [];
      const urls = postToEdit.mediaUrls?.length
        ? postToEdit.mediaUrls
        : postToEdit.mediaUrl
        ? [postToEdit.mediaUrl]
        : [];
      const types = postToEdit.mediaTypes?.length
        ? postToEdit.mediaTypes
        : [postToEdit.mediaType?.toUpperCase() || 'IMAGE'];

      urls.forEach((url, i) => {
        if (url) {
          const type = (types[i] || 'IMAGE').toUpperCase() === 'VIDEO' ? 'VIDEO' : 'IMAGE';
          items.push({
            id: `existing-${i}`,
            type,
            previewUrl: url,
            existingUrl: url,
          });
        }
      });
      setMediaItems(items);
    }
  }, [postToEdit, user]);

  const canManageGlobal =
    user.role === UserRole.ADMIN ||
    user.role === UserRole.STAFF_REPORTER ||
    user.role === UserRole.REGIONAL_INCHARGE ||
    String(user.role).toUpperCase() === 'NEWS_DESK' ||
    String(user.role).toUpperCase() === 'EDITOR' ||
    user.email === 'alfanews0861@gmail.com';

  const districts = React.useMemo(() => {
    const base = state === 'TS' ? TS_DISTRICTS : AP_DISTRICTS;
    if (user.role === UserRole.REGIONAL_INCHARGE && user.assignedDistricts?.length) {
      return base.filter((d) => user.assignedDistricts?.includes(d));
    }
    return base;
  }, [state, user]);

  const mandals = React.useMemo(() => {
    return district ? MANDAL_DATA[district] || [] : [];
  }, [district]);

  // Keep district aligned with state
  useEffect(() => {
    if (district && !districts.includes(district)) {
      setDistrict('');
      setLocation('');
    }
  }, [districts, district]);

  const handleImagePick = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const availableSlots = 3 - mediaItems.length;
    if (availableSlots <= 0) {
      alert('గరిష్టంగా 3 మీడియా ఫైళ్లు మాత్రమే అనుమతించబడతాయి.');
      return;
    }

    const selectedFiles = Array.from(files).slice(0, availableSlots);
    const newItems: MediaItem[] = selectedFiles.map((file, idx) => ({
      id: `new-img-${Date.now()}-${idx}`,
      type: 'IMAGE',
      previewUrl: URL.createObjectURL(file),
      file,
    }));

    setMediaItems((prev) => [...prev, ...newItems].slice(0, 3));
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleVideoPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasVideo = mediaItems.some((item) => item.type === 'VIDEO');
    if (hasVideo) {
      alert('ఒక వీడియో మాత్రమే అనుమతించబడుతుంది.');
      return;
    }

    if (mediaItems.length >= 3) {
      alert('గరిష్టంగా 3 మీడియా ఫైళ్లు మాత్రమే అనుమతించబడతాయి.');
      return;
    }

    // 100MB check
    const MAX_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      const sizeMB = Math.round(file.size / (1024 * 1024));
      alert(`ఎంచుకున్న వీడియో సైజు (${sizeMB} MB) చాలా ఎక్కువగా ఉంది. వీడియో సైజు గరిష్టంగా 100 MB లోపు మాత్రమే ఉండాలి.`);
      return;
    }

    // Duration check <= 10 mins (600s)
    const duration = await checkVideoDuration(file);
    if (duration > 600) {
      alert('వీడియో నిడివి 10 నిమిషాల కంటే తక్కువ ఉండాలి.');
      return;
    }

    const newItem: MediaItem = {
      id: `new-video-${Date.now()}`,
      type: 'VIDEO',
      previewUrl: URL.createObjectURL(file),
      file,
    };

    setMediaItems((prev) => [newItem, ...prev].slice(0, 3));
    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  const removeMediaItem = (index: number) => {
    setMediaItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (activeMediaIndex >= updated.length) {
        setActiveMediaIndex(Math.max(0, updated.length - 1));
      }
      return updated;
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isGlobalNews && (!headline.trim() || !content.trim() || !district.trim())) {
      alert('దయచేసి అన్ని వివరాలు (శీర్షిక, వార్త వివరాలు, జిల్లా) పూరించండి.');
      return;
    }
    if (isGlobalNews && (!headline.trim() || !content.trim())) {
      alert('దయచేసి శీర్షిక మరియు వార్త వివరాలు పూరించండి.');
      return;
    }

    setIsSubmitting(true);
    setStatusMessage('మీడియా అప్‌లోడ్ అవుతోంది...');

    try {
      const finalMediaUrls: string[] = [];
      const finalMediaTypes: string[] = [];

      for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        if (item.existingUrl) {
          finalMediaUrls.push(item.existingUrl);
          finalMediaTypes.push(item.type);
        } else if (item.file) {
          const isVideo = item.type === 'VIDEO';
          const fileId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          if (isVideo) {
            setStatusMessage('వీడియో సర్వర్‌కు చేరుతోంది: 0%');
            const videoRef = ref(storage, `news-media/${fileId}.mp4`);
            const uploadTask = uploadBytesResumable(videoRef, item.file);

            await new Promise((resolve, reject) => {
              uploadTask.on(
                'state_changed',
                (snapshot: any) => {
                  const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                  setStatusMessage(`వీడియో సర్వర్‌కు చేరుతోంది: ${Math.round(progress)}%`);
                },
                (error: any) => reject(error),
                async () => {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  finalMediaUrls.push(url);
                  finalMediaTypes.push('VIDEO');
                  resolve(url);
                }
              );
            });
          } else {
            setStatusMessage('ఫోటో అప్‌లోడ్ అవుతోంది...');
            const webpBlob = await compressImageToWebP(item.file);
            const imageRef = ref(storage, `news-media/${fileId}.webp`);
            const uploadTask = uploadBytesResumable(imageRef, webpBlob, { contentType: 'image/webp' });

            await new Promise((resolve, reject) => {
              uploadTask.on(
                'state_changed',
                null,
                (error: any) => reject(error),
                async () => {
                  const url = await getDownloadURL(uploadTask.snapshot.ref);
                  finalMediaUrls.push(url);
                  finalMediaTypes.push('IMAGE');
                  resolve(url);
                }
              );
            });
          }
        }
      }

      setStatusMessage('వార్త సర్వర్‌కు చేరుతోంది...');

      const finalCategories = [category, isGlobalNews ? 'State' : district].filter(Boolean);
      const reporterData = postToEdit
        ? {
            id: postToEdit.reporter?.id || user.id,
            name: postToEdit.reporter?.name || user.name,
          }
        : {
            id: user.id,
            name: user.name,
          };

      const postData: any = {
        mediaUrl: finalMediaUrls[0] || '',
        mediaUrls: finalMediaUrls,
        mediaType: finalMediaTypes[0] || (youtubeUrl.trim() ? 'video' : 'IMAGE'),
        mediaTypes: finalMediaTypes,
        youtubeUrl: youtubeUrl.trim(),
        location: location || district || 'General',
        categories: finalCategories,
        reporter: reporterData,
        category: category,
        district: isGlobalNews ? 'State' : district,
        state: state,
        isGlobal: isGlobalNews,
        likes: postToEdit?.likes || 0,
        comments: postToEdit?.comments || 0,
        shares: postToEdit?.shares || 0,
        verificationStatus: 'VERIFIED',
        verificationReason: 'VERIFIED BY REPORTER',
        isReporter: true,
        isCitizen: false,
        meta: { location: location || district || 'General' },
        headline: { telugu: headline.trim(), english: postToEdit?.headline?.english || '' },
        content: { telugu: content.trim(), english: postToEdit?.content?.english || '' },
      };

      const functions = getFunctions(app, 'asia-south1');
      const processReporterSubmissionFn = httpsCallable(functions, 'processReporterSubmission');

      await processReporterSubmissionFn({
        postId: postToEdit?.id || null,
        postData,
      });

      const isVideoPost = finalMediaTypes.includes('VIDEO');
      const successMsg = isVideoPost
        ? 'వార్త అప్‌లోడ్ విజయవంతమైంది! వీడియో తయారీ మరియు ఇతర పనులు నేపథ్యంలో జరుగుతున్నాయి. 10 నిమిషాల తర్వాత చూడండి.'
        : 'వార్త విజయవంతంగా పంపబడింది. త్వరలో హోమ్ ఫీడ్ లో చూడవచ్చు.';

      alert(successMsg);
      onActionComplete();
    } catch (err: any) {
      console.error('Error submitting reporter news:', err);
      alert(`వార్త పంపడంలో లోపం: ${err.message || err}`);
    } finally {
      setIsSubmitting(false);
      setStatusMessage(isEditMode ? 'వార్తను సవరించండి' : 'వార్తను ప్రచురించండి');
    }
  };

  const previewYoutubeId = extractYoutubeVideoId(youtubeUrl);

  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 font-mallanna text-gray-900 bg-gray-50 min-h-full rounded-2xl shadow-sm pb-24">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-3xl md:text-4xl font-ramabhadra text-gray-900 font-bold">
            {isEditMode ? 'వార్తను సవరించండి' : 'కొత్త వార్తను పోస్ట్ చేయండి'}
          </h1>
          <p className="text-sm md:text-base text-gray-500 mt-1">
            ఆల్ఫా న్యూస్ రిపోర్టర్ డెస్క్ ద్వారా వార్తలను పబ్లిష్ చేయండి.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: వార్త వివరాలు (News Details) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-md border border-gray-100 space-y-4">
          <h2 className="text-2xl font-ramabhadra text-red-600 font-semibold border-b pb-2">
            వార్త వివరాలు
          </h2>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              వార్త శీర్షిక (Headline) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="ఉదాహరణ: జిల్లాలో ఘనంగా జరిగిన వేడుకలు..."
              className="w-full border-2 border-gray-300 p-3.5 rounded-xl text-lg text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              వార్త పూర్తి వివరాలు (News Content) <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={8}
              required
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="వార్త పూర్తి వివరాలను ఇక్కడ రాయండి..."
              className="w-full border-2 border-gray-300 p-3.5 rounded-xl text-lg text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all resize-y"
            />
          </div>
        </div>

        {/* Card 2: ప్రాంతం వివరాలు (Region Details) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-md border border-gray-100 space-y-4">
          <h2 className="text-2xl font-ramabhadra text-red-600 font-semibold border-b pb-2">
            ప్రాంతం వివరాలు
          </h2>

          {canManageGlobal && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="block text-lg font-bold text-gray-900">రాష్ట్ర స్థాయి వార్త (Global News)</span>
                <span className="block text-xs text-gray-500">ఈ వార్త యాప్ లోని అందరు పాఠకులకు కనిపిస్తుంది</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGlobalNews}
                  onChange={(e) => setIsGlobalNews(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          )}

          {!isGlobalNews && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">రాష్ట్రం (State)</label>
                  <select
                    value={state}
                    onChange={(e) => {
                      setState(e.target.value);
                      setDistrict('');
                      setLocation('');
                    }}
                    className="w-full border-2 border-gray-300 p-3 rounded-xl text-base text-gray-900 bg-white focus:border-red-500 outline-none"
                  >
                    <option value="TS">తెలంగాణ (Telangana)</option>
                    <option value="AP">ఆంధ్ర ప్రదేశ్ (Andhra Pradesh)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    జిల్లా (District) <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={district}
                    required={!isGlobalNews}
                    onChange={(e) => {
                      setDistrict(e.target.value);
                      setLocation('');
                    }}
                    className="w-full border-2 border-gray-300 p-3 rounded-xl text-base text-gray-900 bg-white focus:border-red-500 outline-none"
                  >
                    <option value="">జిల్లాను ఎంచుకోండి</option>
                    {districts.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  మండలం / ప్రాంతం (Mandal / Location)
                </label>
                {mandals.length > 0 ? (
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full border-2 border-gray-300 p-3 rounded-xl text-base text-gray-900 bg-white focus:border-red-500 outline-none"
                  >
                    <option value="">మండలాన్ని ఎంచుకోండి (ఐచ్ఛికం)</option>
                    {mandals.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="గ్రామం / ప్రాంతం పేరు..."
                    className="w-full border-2 border-gray-300 p-3 rounded-xl text-base text-gray-900 focus:border-red-500 outline-none"
                  />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Card 3: వార్త మీడియా (News Media & YouTube) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-md border border-gray-100 space-y-4">
          <h2 className="text-2xl font-ramabhadra text-red-600 font-semibold border-b pb-2">
            వార్త మీడియా (News Media)
          </h2>

          {/* YouTube Link Field */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              యూట్యూబ్ లింక్ (YouTube Video Link - ఐచ్ఛికం)
            </label>
            <input
              type="url"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... లేదా https://youtu.be/..."
              className="w-full border-2 border-gray-300 p-3 rounded-xl text-base text-gray-900 focus:border-red-500 outline-none bg-gray-50"
            />
          </div>

          {/* Real-Time Preview (YouTube Player or Uploaded Media Carousel) */}
          {previewYoutubeId ? (
            <div className="w-full aspect-video rounded-xl overflow-hidden shadow bg-black relative border-2 border-red-500">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${previewYoutubeId}?enablejsapi=1&rel=0`}
                title="YouTube Preview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
              <div className="absolute top-2 left-2 bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">
                YouTube Live Preview
              </div>
            </div>
          ) : mediaItems.length > 0 ? (
            <div className="relative w-full h-64 md:h-80 bg-black rounded-xl overflow-hidden group shadow border">
              {/* Active Media Item */}
              {mediaItems[activeMediaIndex]?.type === 'VIDEO' ? (
                <video
                  src={mediaItems[activeMediaIndex]?.previewUrl}
                  controls
                  className="w-full h-full object-contain"
                />
              ) : (
                <img
                  src={mediaItems[activeMediaIndex]?.previewUrl}
                  alt="Selected Media"
                  className="w-full h-full object-cover object-top"
                />
              )}

              {/* Remove Button on active item */}
              <button
                type="button"
                onClick={() => removeMediaItem(activeMediaIndex)}
                className="absolute top-3 right-3 bg-black/70 hover:bg-red-600 text-white p-2 rounded-full backdrop-blur-sm transition-all z-20"
                title="మీడియాను తొలగించు"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Pager Dots and Arrows if multiple */}
              {mediaItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMediaIndex((prev) => (prev > 0 ? prev - 1 : mediaItems.length - 1))
                    }
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-all z-10"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveMediaIndex((prev) => (prev < mediaItems.length - 1 ? prev + 1 : 0))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-all z-10"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>

                  <div className="absolute bottom-3 inset-x-0 flex justify-center items-center gap-1.5 z-10">
                    {mediaItems.map((_, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveMediaIndex(idx)}
                        className={`h-2.5 rounded-full transition-all ${
                          activeMediaIndex === idx ? 'w-6 bg-white' : 'w-2.5 bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-8 border-2 border-dashed border-gray-300 rounded-xl text-center bg-gray-50 flex flex-col items-center justify-center text-gray-400">
              <Upload className="w-10 h-10 mb-2 opacity-50 text-gray-400" />
              <p className="text-base text-gray-500 font-bold">ఫోటోలు లేదా వీడియోను ఎంచుకోండి</p>
              <p className="text-xs text-gray-400 mt-1">గరిష్టంగా 3 ఫోటోలు లేదా 1 వీడియో (10 నిమిషాల లోపు, 100MB)</p>
            </div>
          )}

          {/* Hidden File Inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImagePick}
            className="hidden"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={handleVideoPick}
            className="hidden"
          />

          {/* Upload Action Buttons */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={mediaItems.length >= 3}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow transition-all active:scale-95"
            >
              <Upload className="w-5 h-5" />
              <span>Image ({mediaItems.filter((i) => i.type === 'IMAGE').length}/3)</span>
            </button>

            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              disabled={mediaItems.some((i) => i.type === 'VIDEO') || mediaItems.length >= 3}
              className="bg-[#4285F4] hover:bg-blue-600 disabled:opacity-50 text-white py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 font-bold shadow transition-all active:scale-95"
            >
              <VideoIcon className="w-5 h-5" />
              <span>Video ({mediaItems.filter((i) => i.type === 'VIDEO').length}/1)</span>
            </button>
          </div>
        </div>

        {/* Card 4: కేటగిరీ (Category) */}
        <div className="bg-white p-5 md:p-6 rounded-2xl shadow-md border border-gray-100 space-y-3">
          <h2 className="text-2xl font-ramabhadra text-red-600 font-semibold border-b pb-2">
            కేటగిరీ (Category)
          </h2>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">వార్త వర్గం</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border-2 border-gray-300 p-3.5 rounded-xl text-lg text-gray-900 bg-white focus:border-red-500 outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Button (Publish / Update) */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-bold py-5 rounded-2xl text-2xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 font-ramabhadra cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-7 h-7 animate-spin" />
              <span>{statusMessage}</span>
            </>
          ) : (
            <span>{isEditMode ? 'వార్తను అప్‌డేట్ చేయండి' : 'వార్తను పబ్లిష్ చేయండి'}</span>
          )}
        </button>
      </form>
    </div>
  );
};

export default PostNewsPage;
