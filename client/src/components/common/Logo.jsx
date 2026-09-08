// Official iRequestDologon mark, served from the project's own Cloudinary
// account (the same asset the admin landing page uses).
//
// The source file is a JPG on a white background, so it is always rendered
// inside a white rounded tile — that keeps it legible on the dark forest
// sidebar as well as on the mint page backgrounds.
export const LOGO_URL =
  'https://res.cloudinary.com/dvw7ky1xq/image/upload/v1776177600/Irequest_Logo_kbbr2b.jpg';

export default function Logo({ size = 36, rounded = 'rounded-2xl', className = '' }) {
  return (
    <span
      className={`inline-flex items-center justify-center bg-white overflow-hidden shrink-0 shadow-sm ${rounded} ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={LOGO_URL}
        alt="iRequestDologon"
        className="w-full h-full object-contain"
        loading="lazy"
        decoding="async"
      />
    </span>
  );
}
