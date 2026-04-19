'use client';

import { driver } from 'driver.js';
import type { Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useEffect, useRef, type MutableRefObject } from 'react';
import { usePathname } from 'next/navigation';

/** Legacy single flag — treated as all phases complete. */
const LEGACY_TOUR_KEY = 'reminded_tour_completed';
const PHASE_1_DASHBOARD = 'reminded_tour_phase_1_dashboard';
const PHASE_2_CREATE_FORM = 'reminded_tour_phase_2_create_form';
const PHASE_3_COURSE_UPLOAD = 'reminded_tour_phase_3_course_upload';

/** Match student home; allow optional trailing slash (Next / hosting quirks). */
const PATH_DASHBOARD_HOME = /^\/dashboard\/student\/?$/;
const PATH_CREATE_COURSE = /^\/dashboard\/student\/create-course\/?$/;
const PATH_COURSE_LOBBY = /^\/dashboard\/student\/course\/[^/]+\/?$/;

const PHASE_1_ANCHORS = [
  '#tour-dashboard-hero',
  '#tour-dashboard-create-btn',
  '#tour-dashboard-courses-section',
] as const;

const PHASE_2_ANCHORS = [
  '#tour-create-course-card',
  '#tour-create-course-name',
  '#tour-create-course-submit',
] as const;

const PHASE_3_ANCHORS = [
  '#tour-course-header',
  '#tour-topics',
  '#tour-add-topic-card',
  '#tour-queue-status',
] as const;

const ANCHOR_POLL_MS = 200;
const ANCHOR_MAX_WAIT_MS = 60_000;
const PERSIST_GRACE_MS = 400;

function migrateLegacyPhases(): void {
  try {
    if (window.localStorage.getItem(LEGACY_TOUR_KEY) === null) return;
    if (window.localStorage.getItem(PHASE_1_DASHBOARD) === null) {
      window.localStorage.setItem(PHASE_1_DASHBOARD, '1');
    }
    if (window.localStorage.getItem(PHASE_2_CREATE_FORM) === null) {
      window.localStorage.setItem(PHASE_2_CREATE_FORM, '1');
    }
    if (window.localStorage.getItem(PHASE_3_COURSE_UPLOAD) === null) {
      window.localStorage.setItem(PHASE_3_COURSE_UPLOAD, '1');
    }
  } catch {
    // ignore
  }
}

function readPhase(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function writePhase(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}

function readLegacyOnly(): boolean {
  try {
    return window.localStorage.getItem(LEGACY_TOUR_KEY) !== null;
  } catch {
    return false;
  }
}

function writeLegacyCompleted(): void {
  try {
    window.localStorage.setItem(LEGACY_TOUR_KEY, 'true');
  } catch {
    // ignore
  }
}

function anchorsPresent(selectors: readonly string[]): boolean {
  return selectors.every((sel) => document.querySelector(sel) != null);
}

function waitForAnchors(
  selectors: readonly string[],
  maxWaitMs: number,
  pollMs: number,
): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + maxWaitMs;
    const id = window.setInterval(() => {
      if (anchorsPresent(selectors)) {
        window.clearInterval(id);
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        window.clearInterval(id);
        resolve(false);
      }
    }, pollMs);
  });
}

function buildBaseConfig(
  steps: NonNullable<Config['steps']>,
  onPersist: () => void,
  mayPersistRef: MutableRefObject<boolean>,
  persistTimerRef: MutableRefObject<number | null>,
): Config {
  return {
    showProgress: true,
    animate: true,
    allowClose: true,
    popoverClass: 'reminded-driver-popover',
    overlayColor: '#0a0a0a',
    overlayOpacity: 0.72,
    doneBtnText: 'Finish',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    onDestroyed: () => {
      if (mayPersistRef.current) {
        onPersist();
      }
      mayPersistRef.current = false;
      if (persistTimerRef.current != null) {
        window.clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    },
    steps,
  };
}

export default function OnboardingTour() {
  const pathname = usePathname() ?? '';
  const driverInstanceRef = useRef<ReturnType<typeof driver> | null>(null);
  const mayPersistRef = useRef(false);
  const persistGraceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (typeof window === 'undefined') return;

    migrateLegacyPhases();

    const isFullyDone =
      readLegacyOnly() ||
      (readPhase(PHASE_1_DASHBOARD) &&
        readPhase(PHASE_2_CREATE_FORM) &&
        readPhase(PHASE_3_COURSE_UPLOAD));

    if (isFullyDone) return;

    const clearGraceAndDriver = () => {
      if (persistGraceTimerRef.current != null) {
        window.clearTimeout(persistGraceTimerRef.current);
        persistGraceTimerRef.current = null;
      }
      mayPersistRef.current = false;
      driverInstanceRef.current?.destroy();
      driverInstanceRef.current = null;
    };

    void (async () => {
      /** Phase 1 — student dashboard home */
      if (!readPhase(PHASE_1_DASHBOARD) && PATH_DASHBOARD_HOME.test(pathname)) {
        const ready = await waitForAnchors(
          [...PHASE_1_ANCHORS],
          ANCHOR_MAX_WAIT_MS,
          ANCHOR_POLL_MS,
        );
        if (cancelled || !ready || readPhase(PHASE_1_DASHBOARD)) return;

        mayPersistRef.current = false;
        clearGraceAndDriver();

        const driverObj = driver(
          buildBaseConfig(
            [
              {
                popover: {
                  title: 'Welcome to RemindED',
                  description:
                    'We will start on your dashboard: create a course, then add your first PDF topic.',
                  align: 'center',
                },
              },
              {
                element: '#tour-dashboard-hero',
                popover: {
                  title: 'Reviews & streak',
                  description:
                    'When you have cards due, use Study Now to review across all your courses.',
                  side: 'bottom',
                  align: 'start',
                },
              },
              {
                element: '#tour-dashboard-create-btn',
                popover: {
                  title: 'Create a course',
                  description:
                    'Tap here to name a course (for example a class or book). After you create it, open the course and we will show you how to upload a PDF.',
                  side: 'bottom',
                  align: 'start',
                },
              },
              {
                element: '#tour-dashboard-courses-section',
                popover: {
                  title: 'Your courses',
                  description:
                    'Each card opens that course. New courses appear here after you create them.',
                  side: 'top',
                  align: 'start',
                },
              },
            ],
            () => writePhase(PHASE_1_DASHBOARD),
            mayPersistRef,
            persistGraceTimerRef,
          ),
        );

        driverInstanceRef.current = driverObj;
        if (cancelled) {
          driverObj.destroy();
          driverInstanceRef.current = null;
          return;
        }
        driverObj.drive();
        persistGraceTimerRef.current = window.setTimeout(() => {
          persistGraceTimerRef.current = null;
          if (!cancelled) mayPersistRef.current = true;
        }, PERSIST_GRACE_MS);
        return;
      }

      /** Phase 2 — create course form (after dashboard segment, or keys set on success) */
      if (
        !readPhase(PHASE_2_CREATE_FORM) &&
        PATH_CREATE_COURSE.test(pathname) &&
        readPhase(PHASE_1_DASHBOARD)
      ) {
        const ready = await waitForAnchors(
          [...PHASE_2_ANCHORS],
          ANCHOR_MAX_WAIT_MS,
          ANCHOR_POLL_MS,
        );
        if (cancelled || !ready || readPhase(PHASE_2_CREATE_FORM)) return;

        mayPersistRef.current = false;
        clearGraceAndDriver();

        const driverObj = driver(
          buildBaseConfig(
            [
              {
                popover: {
                  title: 'Create your course',
                  description:
                    'Give this course a clear name, then create it. Next, open the course from your dashboard to continue the tour with PDF upload.',
                  align: 'center',
                },
              },
              {
                element: '#tour-create-course-name',
                popover: {
                  title: 'Course name',
                  description:
                    'This label is shown on your dashboard and helps you find the course later.',
                  side: 'bottom',
                  align: 'start',
                },
              },
              {
                element: '#tour-create-course-submit',
                popover: {
                  title: 'Create',
                  description:
                    'Submit to save. Afterward, go to Dashboard and open your new course—the tour will pick up with uploading a PDF.',
                  side: 'top',
                  align: 'start',
                },
              },
            ],
            () => writePhase(PHASE_2_CREATE_FORM),
            mayPersistRef,
            persistGraceTimerRef,
          ),
        );

        driverInstanceRef.current = driverObj;
        if (cancelled) {
          driverObj.destroy();
          driverInstanceRef.current = null;
          return;
        }
        driverObj.drive();
        persistGraceTimerRef.current = window.setTimeout(() => {
          persistGraceTimerRef.current = null;
          if (!cancelled) mayPersistRef.current = true;
        }, PERSIST_GRACE_MS);
        return;
      }

      /** Phase 3 — course lobby (PDF / queue) — requires phase 2 (or bootstrap from app) */
      if (!readPhase(PHASE_3_COURSE_UPLOAD) && PATH_COURSE_LOBBY.test(pathname)) {
        if (!readPhase(PHASE_2_CREATE_FORM)) return;

        const ready = await waitForAnchors(
          [...PHASE_3_ANCHORS],
          ANCHOR_MAX_WAIT_MS,
          ANCHOR_POLL_MS,
        );
        if (cancelled || !ready || readPhase(PHASE_3_COURSE_UPLOAD)) return;

        mayPersistRef.current = false;
        clearGraceAndDriver();

        const driverObj = driver(
          buildBaseConfig(
            [
              {
                popover: {
                  title: 'Add your first topic',
                  description:
                    'Inside a course you upload a PDF, pick pages, and RemindED generates spaced-repetition questions.',
                  align: 'center',
                },
              },
              {
                element: '#tour-add-topic-card',
                popover: {
                  title: 'Upload PDF',
                  description:
                    'Start by selecting the pages of your textbook or notes here (drop zone or PDF picker).',
                  side: 'bottom',
                  align: 'start',
                },
              },
              {
                element: '#tour-queue-status',
                popover: {
                  title: 'Processing queue',
                  description:
                    'Watch the worker process your chunks here while questions are generated.',
                  side: 'left',
                  align: 'start',
                },
              },
              {
                element: '#tour-course-header',
                popover: {
                  title: 'Your course',
                  description:
                    'Rename your course, review due counts, or delete the course from this header.',
                  side: 'bottom',
                  align: 'start',
                },
              },
              {
                element: '#tour-topics',
                popover: {
                  title: 'Topics',
                  description:
                    'Each topic holds questions and study links. Adjust this copy when your UI changes.',
                  side: 'top',
                  align: 'start',
                },
              },
            ],
            () => {
              writePhase(PHASE_3_COURSE_UPLOAD);
              writeLegacyCompleted();
            },
            mayPersistRef,
            persistGraceTimerRef,
          ),
        );

        driverInstanceRef.current = driverObj;
        if (cancelled) {
          driverObj.destroy();
          driverInstanceRef.current = null;
          return;
        }
        driverObj.drive();
        persistGraceTimerRef.current = window.setTimeout(() => {
          persistGraceTimerRef.current = null;
          if (!cancelled) mayPersistRef.current = true;
        }, PERSIST_GRACE_MS);
      }
    })();

    return () => {
      cancelled = true;
      clearGraceAndDriver();
    };
  }, [pathname]);

  return null;
}
