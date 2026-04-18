'use client';

import { useEffect, useMemo, useState } from 'react';

const DISMISS_KEY = 'reminded:iosInstallModalDismissed';

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return Boolean(nav.standalone) || window.matchMedia?.('(display-mode: standalone)')?.matches === true;
}

function isIosDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/i.test(ua);
  const iPadOS13Plus =
    window.navigator.platform === 'MacIntel' &&
    typeof window.navigator.maxTouchPoints === 'number' &&
    window.navigator.maxTouchPoints > 1;
  return iOS || iPadOS13Plus;
}

function isSafariBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent || '';
  const isWebkitSafari = /Safari/i.test(ua) && !/Chrome|CriOS|EdgiOS|FxiOS|OPiOS|DuckDuckGo/i.test(ua);
  return isWebkitSafari;
}

function ShareIcon(props: { className?: string }) {
  return (
    <svg
      className={props.className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8.5 6.5 12 3l3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10h-.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11A2.5 2.5 0 0 0 20 18.5v-6A2.5 2.5 0 0 0 17.5 10H17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function IosInstallModal() {
  const shouldPrompt = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return isIosDevice() && isSafariBrowser() && !isStandaloneMode();
  }, []);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!shouldPrompt) return;
    try {
      const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
      if (!dismissed) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [shouldPrompt]);

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#131312] shadow-2xl">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Install ReMindED</p>
              <p className="mt-1 text-sm text-white/80">
                To install ReMindED, tap the{' '}
                <span className="inline-flex items-center gap-1 font-medium text-white">
                  <ShareIcon className="inline-block h-4 w-4" />
                  Share
                </span>{' '}
                icon below and select{' '}
                <span className="font-medium text-white">'Add to Home Screen'</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                try {
                  window.localStorage.setItem(DISMISS_KEY, '1');
                } catch {
                  // ignore storage failures
                }
                setOpen(false);
              }}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/10"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}

