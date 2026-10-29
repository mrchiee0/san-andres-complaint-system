const cloudName = (import.meta as ImportMeta & {
  env?: { VITE_CLOUDINARY_CLOUD_NAME?: string };
}).env?.VITE_CLOUDINARY_CLOUD_NAME;

export function cloudinaryImageUrl(publicId: string): string {
  if (!cloudName) return `/images/${publicId}`;

  const assetPath = ['san-andres-site', ...publicId.split('/')]
    .map(encodeURIComponent)
    .join('/');
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${assetPath}`;
}
