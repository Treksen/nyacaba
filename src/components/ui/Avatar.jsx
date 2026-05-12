import { useState, useEffect } from 'react';
import { initials } from '../../lib/format';

/**
 * Avatar — renders an uploaded photo if one is supplied, otherwise falls
 * back to a coloured circle with the person's initials.
 *
 * Props:
 *   src     – url to the avatar image (optional)
 *   name    – full name, used for initials fallback + alt text
 *   size    – sm | md | lg | xl | 2xl
 *   className – extra classes (e.g. to override rounded-full → rounded-2xl)
 */
const SIZE = {
  sm:   'w-7 h-7 text-[10px]',
  md:   'w-10 h-10 text-xs',
  lg:   'w-12 h-12 text-sm',
  xl:   'w-14 h-14 text-base',
  '2xl':'w-20 h-20 text-xl',
  '3xl':'w-28 h-28 text-2xl',
};

export default function Avatar({ src, name = '', size = 'md', className = '', alt }) {
  const cls = SIZE[size] || SIZE.md;
  const [errored, setErrored] = useState(false);

  // Reset errored state when src changes (e.g. after a re-upload)
  useEffect(() => { setErrored(false); }, [src]);

  if (src && !errored) {
    return (
      <span
        className={`relative inline-block ${cls} rounded-full overflow-hidden bg-cream-200 shrink-0 ${className}`}
        aria-label={alt || name || 'Profile photo'}
      >
        <img
          src={src}
          alt={alt || name || ''}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
          onError={() => setErrored(true)}
        />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${cls} rounded-full bg-primary-900 text-cream-50 font-display font-semibold shrink-0 ${className}`}
      aria-label={alt || name || 'Profile placeholder'}
    >
      {initials(name) || '·'}
    </span>
  );
}
