import React, { useEffect } from 'react';

const AdCard: React.FC = () => {
    useEffect(() => {
        const pushAd = () => {
            try {
                const ads = window.adsbygoogle || [];
                // Check if this specific ins element already has an ad
                const ins = document.querySelector('.adsbygoogle:not([data-adsbygoogle-status="done"])');
                if (ins) {
                    const rect = ins.getBoundingClientRect();
                    if (rect.width > 0) {
                        ads.push({});
                    } else {
                        console.warn("AdSense: Ad container has 0 width, skipping push.");
                    }
                }
            } catch (e) {
                console.error("AdSense error:", e);
            }
        };

        // Small delay to ensure DOM is ready and element is visible
        const timer = setTimeout(pushAd, 500);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="w-full h-full snap-start snap-always shrink-0 bg-black flex items-center justify-center p-4">
            <ins className="adsbygoogle"
                 style={{ display: 'block' }}
                 data-ad-client="ca-pub-5787901991150360"
                 data-ad-slot="7964147976"
                 data-ad-format="auto"
                 data-full-width-responsive="true"></ins>
        </div>
    );
};

export default AdCard;
