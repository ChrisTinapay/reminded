import { useEffect, useRef } from 'react'

export default function ConfirmDialog({
  open,
  title = 'Confirm',
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  tone = 'danger', // 'danger' | 'primary'
  busy = false,
  onConfirm,
  onClose,
}) {
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => confirmRef.current?.focus?.(), 0)
    return () => clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const confirmClass =
    tone === 'primary'
      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
      : 'bg-red-600 hover:bg-red-700 text-white'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md brand-card overflow-hidden shadow-2xl"
      >
        <div className="h-1.5 bg-gradient-to-r from-indigo-600 to-violet-500" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`mt-0.5 w-10 h-10 rounded-xl flex items-center justify-center ${tone === 'primary'
              ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-200'
              : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
              }`}
            >
              {tone === 'primary' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86l-7.5 13A1.5 1.5 0 004.09 19h15.82a1.5 1.5 0 001.3-2.14l-7.5-13a1.5 1.5 0 00-2.6 0z" />
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>
              {description ? (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{description}</p>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {cancelText ? (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold border bg-white hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-100"
              >
                {cancelText}
              </button>
            ) : null}
            <button
              ref={confirmRef}
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className={`inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${confirmClass}`}
            >
              {busy ? 'Working…' : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

