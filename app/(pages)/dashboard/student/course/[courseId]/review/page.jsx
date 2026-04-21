'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { getDueQuestions, submitQuizResult } from '@/app/actions/quizActions'
import { useReviewLatencyClock } from '@/hooks/useReviewLatencyClock'

export default function ReviewSession() {
  const params = useParams()
  const searchParams = useSearchParams()
  const courseId = params.courseId
  const materialId = searchParams.get('materialId')
  const topicLabel = searchParams.get('topic') || 'Study Session'

  // Game State
  const [questions, setQuestions] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sessionComplete, setSessionComplete] = useState(false)

  // Interaction State
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [isAnswered, setIsAnswered] = useState(false)
  const [feedback, setFeedback] = useState(null) // 'correct' or 'wrong'

  const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in user's timezone

  const currentQ = questions[currentIndex]
  const questionKey = useMemo(
    () => `${currentIndex}-${currentQ?.id ?? ''}`,
    [currentIndex, currentQ?.id],
  )
  const clockEnabled = !loading && !sessionComplete && !isAnswered && questions.length > 0
  const { displaySeconds, stopAndGetLatencySeconds } = useReviewLatencyClock({
    enabled: clockEnabled,
    questionKey,
  })

  const didInitRef = useRef(false)

  // Prevent accidentally leaving mid-session (refresh/close).
  useEffect(() => {
    if (loading || sessionComplete || questions.length === 0) return

    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [loading, sessionComplete, questions.length])

  // 1. Initialize Session
  useEffect(() => {
    // In development, React may run effects twice. Guard so the question/choice
    // randomization doesn't "swap" after the user already sees question 1.
    if (didInitRef.current) return
    didInitRef.current = true

    const init = async () => {
      const { questions: qData } = await getDueQuestions(courseId, materialId, localToday)
      if (qData && qData.length > 0) {
        setQuestions(qData)
      }
      setLoading(false)
    }
    init()
  }, [courseId, materialId])

  // 3. Handle Answer
  const handleAnswer = async (choice) => {
    if (isAnswered) return

    const responseLatency = stopAndGetLatencySeconds()

    setIsAnswered(true)
    setSelectedChoice(choice)

    const q = questions[currentIndex]
    const isCorrect = choice === q.correct_answer

    setFeedback(isCorrect ? 'correct' : 'wrong')

    await submitQuizResult({
      courseId,
      questionId: q.id,
      isCorrect,
      responseLatency,
      clientToday: localToday,
    })
  }

  // 5. Next Question
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setIsAnswered(false)
      setSelectedChoice(null)
      setFeedback(null)
    } else {
      setSessionComplete(true)
    }
  }

  if (loading) return <div className="h-screen flex items-center justify-center text-gray-500 dark:text-gray-400">Preparing session...</div>

  // --- COMPLETED STATE ---
  if (sessionComplete || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[80vh] px-6 text-center">
        <div className="bg-white dark:bg-white/5 p-10 rounded-3xl shadow-xl max-w-md w-full border border-gray-100 dark:border-white/10">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">Session Complete! 🎉</h2>
          <p className="text-sm text-indigo-600 font-medium mb-4">{topicLabel}</p>
          <p className="text-gray-600 dark:text-gray-300 mb-8">
            {questions.length === 0
              ? "No questions due for review right now. You're all caught up!"
              : "Great job! Your spaced repetition data has been updated."}
          </p>
          <button
            onClick={() => window.location.href = `/dashboard/student/course/${courseId}`}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition"
          >
            Back to Course
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent pb-32 md:pb-0">
      {/* Desktop: centered card */} 
      <div className="hidden md:flex min-h-[calc(100dvh-10rem)] items-center justify-center px-6">
        <div className="w-full max-w-3xl brand-card overflow-hidden">
          <div className="h-1.5 bg-brand-gradient" />
          <div className="p-6">
            <div className="flex items-start justify-between gap-6">
              <div className="min-w-0">
                <div className="text-xs font-bold text-indigo-600 truncate max-w-xl">{topicLabel}</div>
                <div className="mt-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length}{' '}
                  <span className="text-gray-300 dark:text-white/20">•</span>{' '}
                  {currentQ._is_new ? (
                    <span className="text-blue-600">New Material</span>
                  ) : (
                    <span className="text-orange-600">Review</span>
                  )}
                  {currentQ.retention_state ? (
                    <>
                      <span className="text-gray-300 dark:text-white/20">•</span>{' '}
                      <span
                        className={
                          `rounded-full border px-2 py-0.5 text-[10px] font-extrabold tracking-wider ` +
                          (currentQ.retention_state === 'Mastered'
                            ? 'text-[#86efac] border-[#166534]/45 bg-[#0f1a12]'
                            : currentQ.retention_state === 'Learning'
                              ? 'text-[#93c5fd] border-[#1d4ed8]/45 bg-[#0b1220]'
                              : 'text-[#fdba74] border-[#9a3412]/45 bg-[#1f120b]')
                        }
                      >
                        {String(currentQ.retention_state).toUpperCase()}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className={`shrink-0 text-sm font-mono font-bold px-3 py-1 rounded-full transition-colors ${displaySeconds < 10 ? 'bg-green-100 text-green-700' : displaySeconds < 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {displaySeconds.toFixed(1)}s
              </div>
            </div>

            <div className="mt-4 w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
              />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-6 flex items-center justify-center min-h-[150px] max-h-[min(260px,35vh)] overflow-auto">
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 text-center leading-snug">
                  {currentQ.question_text}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {currentQ.choices.map((choice, idx) => {
                  let style = "bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/10"
                  if (isAnswered) {
                    if (choice === currentQ.correct_answer) style = "bg-green-500 border-green-600 text-white shadow-md scale-[1.01]"
                    else if (choice === selectedChoice) style = "bg-red-500 border-red-600 text-white"
                    else style = "bg-gray-50 border-transparent text-gray-300 opacity-50 cursor-not-allowed dark:bg-white/5 dark:text-white/30"
                  }
                  return (
                    <button
                      key={`review-choice-${idx}`}
                      onClick={() => handleAnswer(choice)}
                      disabled={isAnswered}
                      className={`min-h-[52px] px-4 py-3 rounded-2xl text-base font-semibold text-left transition-all duration-200 shadow-sm active:scale-[0.98] ${style}`}
                    >
                      {choice}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className={`font-bold text-base block ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : feedback === 'wrong' ? 'text-red-800 dark:text-red-200' : 'text-gray-600 dark:text-gray-300'}`}>
                    {isAnswered ? (feedback === 'correct' ? 'Correct!' : 'Incorrect') : 'Pick an answer to continue'}
                  </span>
                  <span className="text-xs text-gray-600 dark:text-gray-300">
                    {!isAnswered ? 'After you answer, “Next Question” will appear here.' : (
                      <>
                        {feedback === 'correct' && displaySeconds <= 10 && "⚡ Super fast! (+5 Quality)"}
                        {feedback === 'correct' && displaySeconds > 10 && displaySeconds <= 20 && "👍 Good pace! (+4 Quality)"}
                        {feedback === 'correct' && displaySeconds > 20 && "🐢 A bit slow. (+3 Quality)"}
                        {feedback === 'wrong' && "Resetting progress."}
                      </>
                    )}
                  </span>
                </div>
                <button
                  onClick={handleNext}
                  disabled={!isAnswered}
                  className="shrink-0 inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-white/10 dark:disabled:text-white/40 text-white px-6 py-3 rounded-xl text-sm font-bold transition shadow-md"
                >
                  Next Question
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: existing flow */}
      <div className="md:hidden min-h-screen bg-transparent flex flex-col max-w-2xl mx-auto p-4 md:p-6 pb-32 md:pb-6">
        {/* Header & Progress */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-indigo-600 mb-1 truncate max-w-[200px]">{topicLabel}</span>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Question {currentIndex + 1} of {questions.length}</span>
            {currentQ._is_new ? (
              <span className="text-xs font-bold text-blue-600">New Material</span>
            ) : (
              <span className="text-xs font-bold text-orange-600">Review</span>
            )}
          </div>
          <div className={`text-sm font-mono font-bold px-3 py-1 rounded-full transition-colors ${displaySeconds < 10 ? 'bg-green-100 text-green-700' : displaySeconds < 20 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
            {displaySeconds.toFixed(1)}s
          </div>
        </div>

        <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full mb-8 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
          ></div>
        </div>

        <div className="bg-white dark:bg-white/5 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 mb-6 flex-grow flex items-center justify-center min-h-[180px]">
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center leading-relaxed">
            {currentQ.question_text}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-8">
          {currentQ.choices.map((choice, idx) => {
            let style = "bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/10"
            if (isAnswered) {
              if (choice === currentQ.correct_answer) style = "bg-green-500 border-green-600 text-white shadow-md scale-[1.02]"
              else if (choice === selectedChoice) style = "bg-red-500 border-red-600 text-white"
              else style = "bg-gray-50 border-transparent text-gray-300 opacity-50 cursor-not-allowed dark:bg-white/5 dark:text-white/30"
            }
            return (
              <button
                key={`review-choice-${idx}`}
                onClick={() => handleAnswer(choice)}
                disabled={isAnswered}
                className={`p-5 rounded-2xl text-lg font-medium text-left transition-all duration-200 shadow-sm active:scale-[0.98] ${style}`}
              >
                {choice}
              </button>
            )
          })}
        </div>

        {isAnswered && (
          <div className="md:hidden fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <div
              className={`
                w-full p-4 rounded-2xl flex items-center justify-between gap-3 shadow-2xl border backdrop-blur-sm bg-white/95 dark:bg-neutral-900/85
                ${feedback === 'correct' ? 'border-green-200 dark:border-green-500/30' : 'border-red-200 dark:border-red-500/30'}
              `}
            >
              <div className="min-w-0">
                <span className={`font-bold text-base block ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                </span>
                <span className="text-xs text-gray-600 dark:text-gray-300">
                  {feedback === 'correct' && displaySeconds <= 10 && "⚡ Super fast! (+5 Quality)"}
                  {feedback === 'correct' && displaySeconds > 10 && displaySeconds <= 20 && "👍 Good pace! (+4 Quality)"}
                  {feedback === 'correct' && displaySeconds > 20 && "🐢 A bit slow. (+3 Quality)"}
                  {feedback === 'wrong' && "Resetting progress."}
                </span>
              </div>
              <button
                onClick={handleNext}
                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold transition shadow-md"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}