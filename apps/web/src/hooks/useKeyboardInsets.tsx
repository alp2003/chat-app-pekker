// hooks/useKeyboardInsets.ts
import { useEffect, useState } from 'react';

/**
 * Returns extra bottom inset (px) to keep UI above the on-screen keyboard on iOS/Safari.
 * Modern iOS (16.4+) honors interactive-widget=resize so this will usually be 0,
 * but we keep it for older iOS and odd PWAs.
 */
export function useKeyboardInsets() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // Amount of viewport hidden by the keyboard (roughly)
      const bottomCovered = Math.max(
        0,
        window.innerHeight - (vv.height + vv.offsetTop)
      );
      setInset(Math.round(bottomCovered));
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return inset;
}
