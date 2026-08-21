import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User, UserRole, Language } from '../types';
import { translations } from '../utils/translations';

interface WhatsappManagerPageProps {
  user: User;
  onClose: () => void;
  language: Language;
}

interface Group {
  id: string;
  name: string;
}

const WhatsappManagerPage: React.FC<WhatsappManagerPageProps> = ({ user, onClose, language }) => {
  const t = translations[language];
  const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [availableGroups, setAvailableGroups] = useState<Group[]>([]);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newGroupId, setNewGroupId] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'reporters_whatsapp', user.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setStatus(data.status || 'disconnected');
          setPhoneNumber(data.phoneNumber || '');
          const settingsGroups = data.selectedGroups || [];
          setSelectedGroupIds(settingsGroups.map((g: any) => g.id));
          
          if (data.availableGroups && data.availableGroups.length > 0) {
              setAvailableGroups(data.availableGroups);
          } else {
              // Add some dummy groups for UI testing if empty
              setAvailableGroups([
                  { id: '12345@g.us', name: 'Test Group 1' },
                  { id: '67890@g.us', name: 'Alfanews Official' }
              ]);
          }
        } else {
            // Default dummy groups for the user if it's their first time
            setAvailableGroups([
                 { id: '12345@g.us', name: 'Test Group 1' },
                 { id: '67890@g.us', name: 'Alfanews Official' }
            ]);
        }
      } catch (error) {
        console.error('Error fetching WhatsApp settings', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user.id]);

  const toggleGroup = (groupId: string) => {
    setSelectedGroupIds(prev => 
      prev.includes(groupId) 
        ? prev.filter(id => id !== groupId)
        : [...prev, groupId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const selectedGroupsData = availableGroups.filter(g => selectedGroupIds.includes(g.id));
      
      const docRef = doc(db, 'reporters_whatsapp', user.id);
      await setDoc(docRef, {
        userId: user.id,
        phoneNumber,
        status: status === 'disconnected' ? 'connected' : status, // Automatically mark connected
        selectedGroups: selectedGroupsData,
        availableGroups: availableGroups,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setStatus(status === 'disconnected' ? 'connected' : status);
      alert('WhatsApp Settings Saved!');
    } catch (error) {
      console.error('Error saving WhatsApp settings', error);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddCustomGroup = () => {
    if (!newGroupId || !newGroupName) {
      alert("Please enter both Group ID and Group Name.");
      return;
    }
    const sanitizedId = newGroupId.includes('@g.us') ? newGroupId : `${newGroupId}@g.us`;
    const newGroup = { id: sanitizedId, name: newGroupName };
    
    setAvailableGroups(prev => [...prev, newGroup]);
    setSelectedGroupIds(prev => [...prev, newGroup.id]);
    setNewGroupId('');
    setNewGroupName('');
  };

  if (loading) return <div className="p-4 text-center">Loading settings...</div>;

  return (
    <div className="bg-white rounded-lg shadow flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="text-xl font-bold">WhatsApp Automation Setup</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <div className="p-4 bg-gray-50 rounded-lg border">
          <h3 className="font-semibold mb-2">Connection Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="capitalize font-medium">{status}</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Since your VPS script is running successfully, make sure your settings are saved here so Cloud Functions know where to forward news!
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your WhatsApp Number (Optional)</label>
          <input 
            type="text" 
            placeholder="e.g. +91 9876543210"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full border rounded-lg p-2"
          />
        </div>

        <div>
          <h3 className="font-semibold mb-3">Select Groups to Forward News</h3>
          {availableGroups.length === 0 ? (
            <p className="text-sm text-gray-500 mb-4">No groups detected automatically.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {availableGroups.map(group => (
                <label key={group.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={selectedGroupIds.includes(group.id)}
                    onChange={() => toggleGroup(group.id)}
                    className="w-5 h-5 text-blue-600 rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{group.name}</div>
                    <div className="text-xs text-gray-500">{group.id}</div>
                  </div>
                  {/* Option to delete newly added custom groups if needed, though they shouldn't matter since they uncheck */}
                </label>
              ))}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mt-4">
            <h4 className="font-medium text-blue-900 mb-2">Add Group Manually</h4>
            <p className="text-xs text-blue-700 mb-3">
              Look at your VPS terminal (where it logged your groups when you typed '!groups') to find the Group ID and Group Name.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Group ID (e.g., 1234@g.us)" 
                value={newGroupId}
                onChange={e => setNewGroupId(e.target.value)}
                className="flex-1 text-sm border border-blue-200 rounded p-2"
              />
              <input 
                type="text" 
                placeholder="Group Name" 
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                className="flex-1 text-sm border border-blue-200 rounded p-2"
              />
              <button 
                onClick={handleAddCustomGroup}
                className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 whitespace-nowrap"
              >
                Add Group
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 border-t bg-gray-50">
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition"
        >
          {saving ? 'Saving...' : 'Save WhatsApp Settings'}
        </button>
      </div>
    </div>
  );
};

export default WhatsappManagerPage;
