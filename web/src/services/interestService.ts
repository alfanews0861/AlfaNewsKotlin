import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';
import { User, NewsPost } from '../types';

const DECAY_FACTOR = 0.95; // Gradually reduce old interests
const INCREMENT_VALUE = 0.1; // Amount to increase interest on interaction

export const updateInterests = async (user: User, post: NewsPost) => {
  if (!user || !user.id) return;

  const userRef = doc(db, 'users', user.id);
  const currentInterests = user.interests || {};
  
  // Combine categories, tags, and keywords for a richer interest profile
  const features = [...(post.categories || []), ...(post.tags || []), ...(post.keywords || [])];
  
  const updatedInterests = { ...currentInterests };

  // Apply decay to existing interests
  Object.keys(updatedInterests).forEach(key => {
    updatedInterests[key] *= DECAY_FACTOR;
  });

  // Increment interests based on post features
  features.forEach(feature => {
    const normalizedFeature = feature.toLowerCase();
    updatedInterests[normalizedFeature] = (updatedInterests[normalizedFeature] || 0) + INCREMENT_VALUE;
  });

  try {
    await updateDoc(userRef, {
      interests: updatedInterests
    });
  } catch (error) {
    console.error("Error updating user interests:", error);
  }
};
