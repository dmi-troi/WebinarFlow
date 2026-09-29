'use client';

import { useEffect, useState } from 'react';

const DEFAULT_LOGO = '/logo-eurokappa-transparent.png';
const LOGO_EVENT = 'webinarflow:branding-updated';

let cachedLogo: string | null | undefined;
let logoPromise: Promise<string | null> | null = null;

async function loadLogo(): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  if (!logoPromise) {
    logoPromise = fetch('/api/settings', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Не удалось загрузить брендинг');
        const data = (await response.json()) as { brandingLogo?: unknown };
        return typeof data.brandingLogo === 'string' && data.brandingLogo.startsWith('data:image/')
          ? data.brandingLogo
          : null;
      })
      .catch(() => null)
      .finally(() => {
        logoPromise = null;
      });
  }

  cachedLogo = await logoPromise;
  return cachedLogo;
}

export function resetBrandLogoCache() {
  cachedLogo = undefined;
  logoPromise = null;
}

export function BrandLogo({
  className = 'h-10',
  alt = 'WebinarFlow',
}: {
  className?: string;
  alt?: string;
}) {
  const [logo, setLogo] = useState<string | null>(cachedLogo ?? null);

  useEffect(() => {
    let active = true;
    if (cachedLogo === undefined) {
      loadLogo().then((value) => {
        if (active) setLogo(value);
      });
    } else {
      setLogo(cachedLogo);
    }

    const handleUpdate = () => {
      resetBrandLogoCache();
      loadLogo().then((value) => {
        if (active) setLogo(value);
      });
    };

    window.addEventListener(LOGO_EVENT, handleUpdate);
    return () => {
      active = false;
      window.removeEventListener(LOGO_EVENT, handleUpdate);
    };
  }, []);

  return (
    <img
      src={logo || DEFAULT_LOGO}
      alt={alt}
      className={`object-contain shrink-0 ${className}`}
    />
  );
}

export function notifyBrandLogoUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(LOGO_EVENT));
  }
}
