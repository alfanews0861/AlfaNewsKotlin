import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Comment } from '../types';
import { db } from '../services/firebase';
import * as _firestore from 'firebase/firestore';

const { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } = _firestore as any;

interface CommentSectionProps {
  postId: string;
  initialCommentCount: number;
  currentUser: User | null;
  onClose: () => void;
  onCommentPosted: () => void;
  onLoginRequest: () => void;
}

const CommentSection: React.FC<CommentSectionProps> = ({ postId, currentUser, onClose, onCommentPosted, onLoginRequest }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const commentsRef = collection(db, 'news', postId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      setComments(snapshot.docs.map((doc: any) => ({
        id: doc.id,
        user: { name: doc.data().userName, photoUrl: doc.data().userPhoto },
        text: doc.data().text,
        timestamp: doc.data().timestamp instanceof Timestamp ? doc.data().timestamp.toMillis() : Date.now()
      } as any)));
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsubscribe();
  }, [postId]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) { onLoginRequest(); return; }
    if (!newComment.trim() || isPosting) return;
    setIsPosting(true);
    try {
      await addDoc(collection(db, 'news', postId, 'comments'), {
        text: newComment.trim(), userId: currentUser.id, userName: currentUser.name, userPhoto: currentUser.photoUrl || '', timestamp: serverTimestamp()
      });
      setNewComment('');
      onCommentPosted();
    } catch (e) { console.error(e); } finally { setIsPosting(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col justify-end" onClick={onClose}>
      <div className="bg-white text-black w-full rounded-t-2xl h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold font-ramabhadra text-xl">వ్యాఖ్యలు</h3>
          <button onClick={onClose} className="text-2xl">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {comments.map(c => (
            <div key={c.id} className="flex gap-3">
              <img src={c.user.photoUrl || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-full" />
              <div className="bg-gray-100 p-2 rounded-lg flex-1">
                <p className="font-bold text-sm">{c.user.name}</p>
                <p className="font-mallanna text-lg">{c.text}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form onSubmit={handlePost} className="p-4 border-t flex gap-2">
          <input type="text" value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="మీ అభిప్రాయం..." className="flex-1 border p-2 rounded-full" />
          <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-full font-bold">పంపు</button>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default CommentSection;