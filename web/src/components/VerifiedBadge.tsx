import React from 'react';

interface VerifiedBadgeProps {
  size?: number;
  className?: string;
  title?: string;
}

/**
 * X.com (Twitter) style verified checkmark badge in green color (#00BA7C).
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  size = 14,
  className = '',
  title = 'మండల విలేకరి (Verified Mandal Reporter)'
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={`inline-block flex-shrink-0 align-middle ${className}`}
      aria-label={title}
    >
      <title>{title}</title>
      {/* Twitter/X Verified Scalloped Rosette in Green */}
      <path
        fill="#00BA7C"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      {/* Crisp White Center Checkmark */}
      <path
        fill="#FFFFFF"
        d="M10.54 16.2l-3.74-3.74 1.41-1.42 2.33 2.33 4.88-5.3 1.47 1.36-6.35 6.77z"
      />
    </svg>
  );
};

export default VerifiedBadge;
