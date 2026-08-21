
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Comment } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

// Workaround for Firebase v9 imports
const { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, limit } = _firestore as any;

// Icon for the Send button
const SendIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

interface CommentSectionProps {
  postId: string;
  initialCommentCount: number;
  currentUser: User | null;
  onClose: () => void;
  onCommentPosted: () => void;
  onLoginRequest: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, initialCommentCount, currentUser, onClose, onCommentPosted, onLoginRequest }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load Comments from Firestore Real-time
  useEffect(() => {
    setIsLoading(true);
    try {
        const commentsRef = collection(db, 'news', postId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'), limit(50));

        const unsubscribe = onSnapshot(q, (snapshot: any) => {
            const loadedComments: Comment[] = snapshot.docs.map((doc: any) => {
                const data = doc.data();
                // Handle Timestamp conversion
                const ts = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : Date.now();
                
                return {
                    id: doc.id,
                    user: {
                        id: data.userId,
                        name: data.userName,
                        photoUrl: data.userPhoto
                    },
                    text: data.text,
                    timestamp: ts
                };
            });
            setComments(loadedComments.reverse());
            setIsLoading(false);
            // Scroll to bottom on new comments
            setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
        }, (error: any) => {
            console.error("Error fetching comments:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    } catch (error) {
        console.error("Error subscribing to comments:", error);
        setIsLoading(false);
    }
  }, [postId]);

  const handlePostComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // If not logged in, trigger login request
    if (!currentUser) {
        onLoginRequest();
        return;
    }

    if (!newComment.trim() || isPosting) return;

    setIsPosting(true);
    try {
      const commentsRef = collection(db, 'news', postId, 'comments');
      
      await addDoc(commentsRef, {
          text: newComment.trim(),
          userId: currentUser.id,
          userName: currentUser.name,
          userPhoto: currentUser.photoUrl || '',
          timestamp: serverTimestamp()
      });

      setNewComment('');
      onCommentPosted(); // Notify parent to update local count
      
    } catch (error) {
      console.error("Error posting comment:", error);
      alert("కామెంట్ పోస్ట్ చేయడం విఫలమైంది.");
    } finally {
      setIsPosting(false);
    }
  };
  
  // Use Portal to render outside the main DOM hierarchy to avoid z-index/overflow issues
  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col justify-end animate-fade-in" onClick={onClose}>
      <div 
        className="bg-gray-900 text-white w-full rounded-t-2xl h-[80vh] flex flex-col shadow-2xl border-t border-gray-700"
        onClick={e => e.stopPropagation()} // Prevent closing when clicking on the panel
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 text-center relative shrink-0 bg-gray-900 rounded-t-2xl">
          <h3 className="font-bold text-lg font-ramabhadra">వ్యాఖ్యలు</h3>
          <button onClick={onClose} className="absolute top-2 right-4 text-gray-400 text-3xl hover:text-white">&times;</button>
        </div>

        {/* Comments List */}
        <div className="flex-grow overflow-y-auto p-4 space-y-4 no-scrollbar bg-black">
          {isLoading ? (
             <div className="flex justify-center items-center h-20">
                 <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin"></div>
             </div>
          ) : comments.length === 0 ? (
             <div className="text-center text-gray-500 mt-10 font-mallanna">
                 ఇంకా వ్యాఖ్యలు లేవు. మీరే మొదట స్పందించండి!
             </div>
          ) : (
             comments.map(comment => (
                <div key={comment.id} className="flex items-start space-x-3">
                <img 
                    src={comment.user.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.user.name)}&background=random`} 
                    alt={comment.user.name} 
                    className="w-9 h-9 rounded-full object-cover border border-gray-700" 
                />
                <div className="flex-1">
                    <div className="bg-gray-800 rounded-2xl rounded-tl-none p-3 inline-block max-w-[90%]">
                        <p className="font-bold text-sm text-red-400 mb-0.5">{comment.user.name}</p>
                        <p className="text-sm font-mallanna leading-relaxed">{comment.text}</p>
                    </div>
                    <p className="text-[10px] text-gray-500 pl-2 mt-1">
                        {new Date(comment.timestamp).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })}
                         {' • '}
                        {new Date(comment.timestamp).toLocaleDateString('en-IN')}
                    </p>
                </div>
                </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form - Visible to ALL (Guests trigger login on click) */}
        <div className="p-3 border-t border-gray-800 shrink-0 bg-gray-900 pb-safe">
            <form onSubmit={handlePostComment} className="flex items-center space-x-2">
            <img 
                src={currentUser?.photoUrl || "https://ui-avatars.com/api/?name=Guest&background=random"} 
                alt="User" 
                className="w-9 h-9 rounded-full object-cover border border-gray-600" 
            />
            <input
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onClick={() => { if(!currentUser) onLoginRequest(); }}
                placeholder={currentUser ? "మీ అభిప్రాయాన్ని రాయండి..." : "వ్యాఖ్యానించడానికి లాగిన్ అవ్వండి..."}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 font-mallanna text-white placeholder-gray-500"
                readOnly={!currentUser}
            />
            <button 
                type="submit"
                className={`p-2.5 rounded-full text-white transition-all transform active:scale-95 shadow-lg ${newComment.trim() ? 'bg-red-600' : 'bg-gray-700'}`}
            >
                {isPosting ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SendIcon />}
            </button>
            </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommentSection;
