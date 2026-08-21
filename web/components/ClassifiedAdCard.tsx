import React, { useMemo } from 'react';
import { ClassifiedAd } from '../types';

interface ClassifiedAdCardProps {
  ad: ClassifiedAd;
  isOwner: boolean;
  onDelete?: (id: string) => void;
}

const PhoneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg>;
const WhatsAppIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="currentColor"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>;

const ClassifiedAdCard: React.FC<ClassifiedAdCardProps> = ({ ad, isOwner, onDelete }) => {
  if (!ad) return null;
  const { title = "శీర్షిక లేదు", price, location = "లొకేషన్ లేదు", description = "వివరాలు లేవు", imageUrl, contactPhone, whatsappNumber, timestamp, id } = ad;

  const handleCall = () => contactPhone && window.open(`tel:${contactPhone}`, '_self');
  const handleWhatsApp = () => {
    const number = whatsappNumber || contactPhone;
    if (!number) return;
    const cleanNum = number.replace(/\D/g, '');
    const finalNum = cleanNum.length === 10 ? `91${cleanNum}` : cleanNum;
    window.open(`https://wa.me/${finalNum}?text=I'm interested in: ${title}`, '_blank');
  };

  const formattedDate = useMemo(() => timestamp ? new Date(timestamp).toLocaleDateString('en-IN') : '', [timestamp]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-full border border-gray-200">
      <div className="h-40 bg-gray-200 relative">
        <img src={imageUrl || 'https://via.placeholder.com/300x200'} alt={title} className="w-full h-full object-cover" />
        {isOwner && onDelete && (
            <button onClick={() => onDelete(id)} className="absolute top-2 left-2 bg-red-600 text-white p-1 rounded-full"><DeleteIcon /></button>
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <h3 className="font-ramabhadra text-lg text-gray-800 line-clamp-1">{title}</h3>
        <p className="text-red-600 font-bold text-xl">₹ {price?.toLocaleString('en-IN')}</p>
        <p className="text-gray-500 text-sm mb-2">{location}</p>
        <div className="mt-auto flex space-x-2">
          <button onClick={handleCall} className="flex-1 bg-blue-600 text-white py-2 rounded text-sm font-bold">కాల్</button>
          <button onClick={handleWhatsApp} className="flex-1 bg-green-500 text-white py-2 rounded text-sm font-bold">చాట్</button>
        </div>
      </div>
    </div>
  );
};

const DeleteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clipRule="evenodd" /></svg>;

export default ClassifiedAdCard;