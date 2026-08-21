import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { doc, updateDoc } = _firestore as any;

const CATEGORIES = [
    { id: 'Politics', label: 'రాజకీయం' },
    { id: 'Sports', label: 'క్రీడలు' },
    { id: 'Cinema', label: 'సినిమా' },
    { id: 'AndhraPradesh', label: 'ఆంధ్ర ప్రదేశ్' },
    { id: 'Telangana', label: 'తెలంగాణ' },
    { id: 'National', label: 'జాతీయం' },
    { id: 'International', label: 'అంతర్జాతీయం' },
    { id: 'Lifestyle', label: 'లైఫ్ స్టైల్' },
    { id: 'Business', label: 'వ్యాపారం' },
    { id: 'Technology', label: 'టెక్నాలజీ' },
    { id: 'Health', label: 'ఆరోగ్యం' },
    { id: 'Devotional', label: 'భక్తి' },
    { id: 'Education', label: 'విద్య - ఉద్యోగాలు' }
];

interface PreferencesModalProps {
    currentUser: User | null;
    onClose: () => void;
    onSave: (categories: string[]) => void;
}

const PreferencesModal: React.FC<PreferencesModalProps> = ({ currentUser, onClose, onSave }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (currentUser?.preferredCategories) {
            setSelected(currentUser.preferredCategories);
        } else {
            const localPrefs = localStorage.getItem('alfa_explicit_prefs');
            if (localPrefs) {
                try {
                    setSelected(JSON.parse(localPrefs));
                } catch (e) {}
            }
        }
    }, [currentUser]);

    const toggleCategory = (catId: string) => {
        setSelected(prev => 
            prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            if (currentUser) {
                await updateDoc(doc(db, 'users', currentUser.id), {
                    preferredCategories: selected
                });
            } else {
                localStorage.setItem('alfa_explicit_prefs', JSON.stringify(selected));
            }
            onSave(selected);
            onClose();
        } catch (error) {
            console.error("Error saving preferences:", error);
            alert("ప్రాధాన్యతలను సేవ్ చేయడంలో లోపం ఏర్పడింది.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl border border-white/10 animate-slide-up">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 className="text-2xl font-ramabhadra text-white">మీకు ఇష్టమైనవి</h2>
                        <p className="text-sm text-gray-400 font-mallanna mt-1">మీకు ఆసక్తి ఉన్న అంశాలను ఎంచుకోండి</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-wrap gap-3 mb-8 max-h-[50vh] overflow-y-auto no-scrollbar pb-4">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => toggleCategory(cat.id)}
                            className={`px-4 py-2 rounded-full font-mallanna text-lg transition-all duration-200 border ${
                                selected.includes(cat.id)
                                    ? 'bg-red-600 border-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                                    : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full bg-white text-black font-bold py-3.5 rounded-xl text-lg shadow-lg active:scale-95 transition-transform disabled:opacity-70 flex justify-center items-center"
                >
                    {saving ? (
                        <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        'సేవ్ చేయండి'
                    )}
                </button>
            </div>
        </div>
    );
};

export default PreferencesModal;
