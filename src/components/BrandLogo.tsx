import React from 'react';
import { cn } from '../lib/utils';
import { useSettingsStore } from '../store/useSettingsStore';
import { cloudinaryImageUrl } from '../lib/cloudinaryAssets';

const DEFAULT_BRAND_LOGO = cloudinaryImageUrl('brgy-san-andres-logo.avif');
const FALLBACK_BRAND_LOGO = '/images/brgy-san-andres-logo.avif';

type BrandLogoProps = {
  src?: string | null;
  alt?: string;
  className?: string;
  fallback?: React.ReactNode;
};

export default function BrandLogo({
  src,
  alt = 'Barangay San Andres logo',
  className,
  fallback,
}: BrandLogoProps) {
  const { settings } = useSettingsStore();
  const resolvedSrc = src || settings.logo_path || DEFAULT_BRAND_LOGO;

  return (
    <>
      {resolvedSrc ? (
        <img
          src={resolvedSrc}
          alt={alt}
          className={cn('object-contain bg-white/5', className)}
          onError={(event) => {
            const img = event.currentTarget;
            img.onerror = null;
            img.src = FALLBACK_BRAND_LOGO;
          }}
        />
      ) : (
        fallback || null
      )}
    </>
  );
}
