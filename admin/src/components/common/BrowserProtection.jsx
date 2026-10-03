import { useEffect } from 'react';

// This is a browser-side deterrent only. Server-side role checks remain the
// real protection for every admin and resident action.
export default function BrowserProtection() {
  useEffect(() => {
    const blockContextMenu = (event) => event.preventDefault();
    const blockDeveloperShortcut = (event) => {
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (
        event.key === 'F12' ||
        (modifier && event.shiftKey && ['i', 'j', 'c'].includes(key)) ||
        (modifier && key === 'u')
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener('contextmenu', blockContextMenu);
    window.addEventListener('keydown', blockDeveloperShortcut, true);
    return () => {
      document.removeEventListener('contextmenu', blockContextMenu);
      window.removeEventListener('keydown', blockDeveloperShortcut, true);
    };
  }, []);

  return null;
}
