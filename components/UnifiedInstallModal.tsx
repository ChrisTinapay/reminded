'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const DISMISS_STORAGE_KEY = 'reminded_install_dismissed';
const FALLBACK_DELAY_MS = 2500;

export type DeviceOs = 'ios' | 'android' | 'desktop' | 'unknown';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const displayStandalone =
    window.matchMedia?.('(display-mode: standalone)')?.matches === true;
  return Boolean(nav.standalone) || displayStandalone;
}

function detectDeviceOs(ua: string, nav: Navigator): DeviceOs {
  const iOS =
    /iPad|iPhone|iPod/i.test(ua) ||
    (nav.platform === 'MacIntel' &&
      typeof nav.maxTouchPoints === 'number' &&
      nav.maxTouchPoints > 1);
  if (iOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Mobi|Tablet|IEMobile|WPDesktop/i.test(ua)) return 'unknown';
  if (/Windows NT|Macintosh|X11|Linux x86_64|CrOS/i.test(ua)) return 'desktop';
  return 'unknown';
}

/**
 * In-app / embedded browser signatures (QR scanners, social apps, WebViews).
 */
function detectInAppBrowser(ua: string, deviceOs: DeviceOs): boolean {
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return true;
  if (/Instagram/i.test(ua)) return true;
  if (/Line\//i.test(ua)) return true;
  if (/MicroMessenger/i.test(ua)) return true;
  if (/; wv\)/i.test(ua)) return true;

  if (deviceOs === 'ios') {
    const hasSafariToken = /Safari/i.test(ua);
    if (!hasSafariToken) return true;
  }

  return false;
}

function readDismissedFromStorage(): boolean {
  try {
    const v = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    return v !== null && v !== '';
  } catch {
    return false;
  }
}

function writeDismissedToStorage(): void {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
  } catch {
    // ignore quota / private mode
  }
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

export default function UnifiedInstallModal() {
  const [hydrated, setHydrated] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deviceOs, setDeviceOs] = useState<DeviceOs>('unknown');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showFallback, setShowFallback] = useState(false);

  const promptReceivedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFallbackTimer = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const ua = window.navigator.userAgent || '';
    const os = detectDeviceOs(ua, window.navigator);
    const inApp = detectInAppBrowser(ua, os);

    setDeviceOs(os);
    setIsInAppBrowser(inApp);

    if (isStandaloneMode()) {
      setIsStandalone(true);
      setHydrated(true);
      return;
    }

    if (readDismissedFromStorage()) {
      setIsDismissed(true);
      setHydrated(true);
      return;
    }

    if (inApp) {
      setHydrated(true);
      return;
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptReceivedRef.current = true;
      setShowFallback(false);
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      clearFallbackTimer();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    fallbackTimerRef.current = setTimeout(() => {
      if (!promptReceivedRef.current) {
        setShowFallback(true);
      }
    }, FALLBACK_DELAY_MS);

    setHydrated(true);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      clearFallbackTimer();
    };
  }, [clearFallbackTimer]);

  const handleDismiss = useCallback(() => {
    writeDismissedToStorage();
    setIsDismissed(true);
    clearFallbackTimer();
  }, [clearFallbackTimer]);

  const handleInstallClick = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => undefined);
    } catch {
      // user dismissed or prompt failed
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (!hydrated) return null;
  if (isStandalone) return null;
  if (isDismissed) return null;

  /** Priority: in-app trap → native prompt → iOS / Android manual fallback. */
  const panel =
    isInAppBrowser ? (
      <div className="rounded-xl border-2 border-red-500/70 bg-red-950/20 p-3">
        <p id="unified-install-title" className="text-sm font-semibold text-red-200">
          ReMindED cannot be installed from this mini-browser.
        </p>
        <p className="mt-2 text-sm text-white/85">
          Tap the menu icon and select &apos;Open in Chrome/Safari&apos;.
        </p>
      </div>
    ) : deferredPrompt ? (
      <div>
        <p id="unified-install-title" className="text-sm font-semibold text-white">
          Install ReMindED
        </p>
        <p className="mt-1 text-sm text-white/75">
          Add this app to your device for quick access and a full-screen experience.
        </p>
        <button
          type="button"
          onClick={handleInstallClick}
          className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-[#131312] hover:bg-white/90"
        >
          Install ReMindED
        </button>
      </div>
    ) : showFallback && deviceOs === 'ios' ? (
      <div>
        <p id="unified-install-title" className="text-sm font-semibold text-white">
          Install ReMindED
        </p>
        <p className="mt-2 text-sm text-white/80">
          To install: Tap the{' '}
          <span className="inline-flex items-center gap-1 font-medium text-white">
            <ShareIcon className="inline-block h-4 w-4" />
            Share
          </span>{' '}
          button below, then Add to Home Screen.
        </p>
      </div>
    ) : showFallback && deviceOs === 'android' ? (
      <div>
        <p id="unified-install-title" className="text-sm font-semibold text-white">
          Install ReMindED
        </p>
        <p className="mt-2 text-sm text-white/80">
          To install: Tap the Three Dots (⋮) in your browser menu, then Add to Home
          screen.
        </p>
      </div>
    ) : null;

  if (!panel) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-install-title"
    >
      <div className="mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#131312] shadow-2xl">
        <div className="p-4">
          {panel}

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10"
            >
              Not Now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
