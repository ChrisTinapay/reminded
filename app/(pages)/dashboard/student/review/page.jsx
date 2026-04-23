'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { getGlobalDueQuestions, submitQuizResult } from '@/app/actions/quizActions'
import { useReviewLatencyClock } from '@/hooks/useReviewLatencyClock'

export default function GlobalReviewSession() {

    // Game State
    const [questions, setQuestions] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [sessionComplete, setSessionComplete] = useState(false)

    // Interaction State
    const [selectedChoice, setSelectedChoice] = useState(null)
    const [selectedAnswer, setSelectedAnswer] = useState(null)
    const [isAnswered, setIsAnswered] = useState(false)
    const [feedback, setFeedback] = useState(null)
    const [latencyMs, setLatencyMs] = useState(0)
    const [qualityScore, setQualityScore] = useState(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in user's timezone

    const currentQ = questions[currentIndex]
    const questionKey = useMemo(
        () => `${currentIndex}-${currentQ?.id ?? ''}`,
        [currentIndex, currentQ?.id],
    )
    const clockEnabled = !loading && !sessionComplete && !isAnswered && questions.length > 0
    const { stopAndGetLatencyMs } = useReviewLatencyClock({
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

    useEffect(() => {
        // In development, React may run effects twice. Guard so the question/choice
        // randomization doesn't "swap" after the user already sees question 1.
        if (didInitRef.current) return
        didInitRef.current = true

        const init = async () => {
            const { questions: qData } = await getGlobalDueQuestions(localToday)
            if (qData && qData.length > 0) {
                setQuestions(qData)
            }
            setLoading(false)
        }
        init()
    }, [])

    // 3. Handle Answer
    const handleAnswer = (choice) => {
        if (isAnswered) return

        const ms = stopAndGetLatencyMs()

        setIsAnswered(true)
        setSelectedChoice(choice)
        setSelectedAnswer(choice)
        setLatencyMs(ms)

        const q = questions[currentIndex]
        const isCorrect = choice === q.correct_answer

        setFeedback(isCorrect ? 'correct' : 'wrong')
    }

    const submitMeta = async (qScore) => {
        if (qualityScore != null) return
        setQualityScore(qScore)
        setIsSubmitting(true)
        try {
            const q = questions[currentIndex]
            const isCorrect = selectedChoice === q.correct_answer
            await submitQuizResult({
                courseId: q.course_id,
                questionId: q.id,
                isCorrect,
                latency: latencyMs,
                qualityScore: qScore,
                selectedAnswer,
                clientToday: localToday,
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // 4. Next Question
    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setIsAnswered(false)
            setSelectedChoice(null)
            setSelectedAnswer(null)
            setFeedback(null)
            setLatencyMs(0)
            setQualityScore(null)
            setIsSubmitting(false)
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
                    <p className="text-sm text-indigo-600 font-medium mb-4">Daily Review</p>
                    <p className="text-gray-600 dark:text-gray-300 mb-8">
                        {questions.length === 0
                            ? "No questions due for review right now. You're all caught up!"
                            : "Great job! Your spaced repetition data has been updated across all courses."}
                    </p>
                    <button
                        onClick={() => window.location.href = '/dashboard/student'}
                        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition"
                    >
                        Back to Dashboard
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-transparent pb-32 md:pb-0">
            {/* Desktop: centered card, no page scrolling needed */}
            <div className="hidden md:flex min-h-[calc(100dvh-10rem)] items-center justify-center px-6">
                <div className="w-full max-w-3xl brand-card overflow-hidden">
                    <div className="h-1.5 bg-brand-gradient" />
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-6">
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-indigo-600 truncate max-w-xl">
                                    {currentQ.course_name || 'Course'}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xl mt-0.5">
                                    {currentQ.topic_name || 'Topic'}
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    <span>Question {currentIndex + 1} of {questions.length}</span>
                                    <span className="text-gray-300 dark:text-white/20">•</span>
                                    {currentQ._is_new ? (
                                        <span className="text-blue-600">New Material</span>
                                    ) : (
                                        <span className="text-orange-600">Review</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Progress */}
                        <div className="mt-4 w-full bg-gray-200 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                            <div
                                className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                            />
                        </div>

                        {/* Main content */}
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
                                        if (choice === currentQ.correct_answer) {
                                            style = "bg-green-500 border-green-600 text-white shadow-md scale-[1.01]"
                                        } else if (choice === selectedChoice) {
                                            style = "bg-red-500 border-red-600 text-white"
                                        } else {
                                            style = "bg-gray-50 border-transparent text-gray-300 opacity-50 cursor-not-allowed dark:bg-white/5 dark:text-white/30"
                                        }
                                    }

                                    return (
                                        <button
                                            key={`global-choice-${idx}`}
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

                        {/* Desktop footer (always in-card, reserve height to avoid layout shift) */}
                        <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/10">
                            <div className="min-h-[164px]">
                                {!isAnswered ? (
                                    <div className="text-sm text-gray-600 dark:text-gray-300 font-semibold">
                                        Pick an answer to continue
                                    </div>
                                ) : (
                                    <>
                                        <div className={`font-bold text-base ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                            {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                                        </div>

                                        <div className="mt-3 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-[#131312]">
                                            <div className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                {feedback === 'correct' ? 'How hard was it to recall this?' : 'What happened?'}
                                            </div>
                                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {feedback === 'correct' ? (
                                                    <>
                                                        <button
                                                            onClick={() => submitMeta(5)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 5
                                                                    ? "border-blue-500/60 bg-blue-600/20 text-blue-900 ring-2 ring-blue-500/35 dark:text-blue-100"
                                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-900 hover:bg-blue-500/15 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/20")
                                                            }
                                                        >
                                                            Easy — 5
                                                        </button>
                                                        <button
                                                            onClick={() => submitMeta(4)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 4
                                                                    ? "border-green-500/60 bg-green-600/20 text-green-900 ring-2 ring-green-500/35 dark:text-green-100"
                                                                    : "border-green-500/30 bg-green-500/10 text-green-900 hover:bg-green-500/15 dark:bg-green-500/15 dark:text-green-100 dark:hover:bg-green-500/20")
                                                            }
                                                        >
                                                            Good — 4
                                                        </button>
                                                        <button
                                                            onClick={() => submitMeta(3)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 3
                                                                    ? "border-orange-500/60 bg-orange-600/20 text-orange-900 ring-2 ring-orange-500/35 dark:text-orange-100"
                                                                    : "border-orange-500/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/15 dark:bg-orange-500/15 dark:text-orange-100 dark:hover:bg-orange-500/20")
                                                            }
                                                        >
                                                            Hard — 3
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => submitMeta(2)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 2
                                                                    ? "border-orange-500/60 bg-orange-600/20 text-orange-900 ring-2 ring-orange-500/35 dark:text-orange-100"
                                                                    : "border-orange-500/30 bg-orange-500/10 text-orange-900 hover:bg-orange-500/15 dark:bg-orange-500/15 dark:text-orange-100 dark:hover:bg-orange-500/20")
                                                            }
                                                        >
                                                            Slipped up — 2
                                                        </button>
                                                        <button
                                                            onClick={() => submitMeta(1)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 1
                                                                    ? "border-green-500/60 bg-green-600/20 text-green-900 ring-2 ring-green-500/35 dark:text-green-100"
                                                                    : "border-green-500/30 bg-green-500/10 text-green-900 hover:bg-green-500/15 dark:bg-green-500/15 dark:text-green-100 dark:hover:bg-green-500/20")
                                                            }
                                                        >
                                                            Hard to remember — 1
                                                        </button>
                                                        <button
                                                            onClick={() => submitMeta(0)}
                                                            disabled={qualityScore != null || isSubmitting}
                                                            className={
                                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#131312] " +
                                                                (qualityScore === 0
                                                                    ? "border-blue-500/60 bg-blue-600/20 text-blue-900 ring-2 ring-blue-500/35 dark:text-blue-100"
                                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-900 hover:bg-blue-500/15 dark:bg-blue-500/15 dark:text-blue-100 dark:hover:bg-blue-500/20")
                                                            }
                                                        >
                                                            Forgotten — 0
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        <div className="mt-3 flex items-center justify-between gap-4">
                                            <div className="text-xs text-gray-500 dark:text-gray-400">
                                                {qualityScore == null ? 'Choose an option to submit.' : (isSubmitting ? 'Saving…' : 'Saved.')}
                                            </div>
                                            <button
                                                onClick={handleNext}
                                                disabled={qualityScore == null || isSubmitting}
                                                className="shrink-0 inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 disabled:text-gray-600 dark:disabled:bg-white/10 dark:disabled:text-white/40 text-white px-6 py-3 rounded-xl text-sm font-bold transition shadow-md"
                                            >
                                                Next Question
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile: keep existing layout */}
            <div className="md:hidden min-h-screen bg-transparent flex flex-col max-w-2xl mx-auto p-4 md:p-6 pb-32 md:pb-6">

                {/* Header & Progress */}
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-indigo-600 mb-0.5 truncate max-w-[200px]">
                            {currentQ.course_name || 'Course'}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                            {currentQ.topic_name || 'Topic'}
                        </span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-1">
                            Question {currentIndex + 1} of {questions.length}
                        </span>
                        {currentQ._is_new ? (
                            <span className="text-xs font-bold text-blue-600">New Material</span>
                        ) : (
                            <span className="text-xs font-bold text-orange-600">Review</span>
                        )}
                    </div>

                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                        Daily Review
                    </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-white/10 h-2 rounded-full mb-8 overflow-hidden">
                    <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                    ></div>
                </div>

                {/* Question Card */}
                <div className="bg-white dark:bg-white/5 p-8 rounded-3xl shadow-sm border border-gray-100 dark:border-white/10 mb-6 flex-grow flex items-center justify-center min-h-[180px]">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 text-center leading-relaxed">
                        {currentQ.question_text}
                    </h2>
                </div>

                {/* Choices Grid */}
                <div className="grid grid-cols-1 gap-4 mb-8">
                    {currentQ.choices.map((choice, idx) => {
                        let style = "bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/10"

                        if (isAnswered) {
                            if (choice === currentQ.correct_answer) {
                                style = "bg-green-500 border-green-600 text-white shadow-md scale-[1.02]"
                            } else if (choice === selectedChoice) {
                                style = "bg-red-500 border-red-600 text-white"
                            } else {
                                style = "bg-gray-50 border-transparent text-gray-300 opacity-50 cursor-not-allowed dark:bg-white/5 dark:text-white/30"
                            }
                        }

                        return (
                            <button
                                key={`global-choice-${idx}`}
                                onClick={() => handleAnswer(choice)}
                                disabled={isAnswered}
                                className={`p-5 rounded-2xl text-lg font-medium text-left transition-all duration-200 shadow-sm active:scale-[0.98] ${style}`}
                            >
                                {choice}
                            </button>
                        )
                    })}
                </div>

                {/* Mobile: metacognitive step + Next */}
                {isAnswered && (
                    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                        <div className="w-full rounded-2xl shadow-2xl border border-gray-100/70 bg-white/95 p-4 backdrop-blur-sm dark:border-white/10 dark:bg-[#131312]/95">
                            <div className={`font-bold text-base ${feedback === 'correct' ? 'text-green-700 dark:text-green-200' : 'text-red-700 dark:text-red-200'}`}>
                                {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                            </div>
                            <div className="mt-2 text-sm font-bold text-gray-800 dark:text-gray-200">
                                {feedback === 'correct' ? 'How hard was it to recall this?' : 'What happened?'}
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2">
                                {feedback === 'correct' ? (
                                    <>
                                        <button
                                            onClick={() => submitMeta(5)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 5
                                                    ? "border-blue-500/60 bg-blue-600/20 text-blue-900 ring-2 ring-blue-500/35 dark:text-blue-100"
                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100")
                                            }
                                        >
                                            Easy — 5
                                        </button>
                                        <button
                                            onClick={() => submitMeta(4)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 4
                                                    ? "border-green-500/60 bg-green-600/20 text-green-900 ring-2 ring-green-500/35 dark:text-green-100"
                                                    : "border-green-500/30 bg-green-500/10 text-green-900 dark:bg-green-500/15 dark:text-green-100")
                                            }
                                        >
                                            Good — 4
                                        </button>
                                        <button
                                            onClick={() => submitMeta(3)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 3
                                                    ? "border-orange-500/60 bg-orange-600/20 text-orange-900 ring-2 ring-orange-500/35 dark:text-orange-100"
                                                    : "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:bg-orange-500/15 dark:text-orange-100")
                                            }
                                        >
                                            Hard — 3
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => submitMeta(2)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 2
                                                    ? "border-orange-500/60 bg-orange-600/20 text-orange-900 ring-2 ring-orange-500/35 dark:text-orange-100"
                                                    : "border-orange-500/30 bg-orange-500/10 text-orange-900 dark:bg-orange-500/15 dark:text-orange-100")
                                            }
                                        >
                                            Slipped up — 2
                                        </button>
                                        <button
                                            onClick={() => submitMeta(1)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 1
                                                    ? "border-green-500/60 bg-green-600/20 text-green-900 ring-2 ring-green-500/35 dark:text-green-100"
                                                    : "border-green-500/30 bg-green-500/10 text-green-900 dark:bg-green-500/15 dark:text-green-100")
                                            }
                                        >
                                            Hard to remember — 1
                                        </button>
                                        <button
                                            onClick={() => submitMeta(0)}
                                            disabled={qualityScore != null || isSubmitting}
                                            className={
                                                "rounded-xl px-4 py-3 text-sm font-bold border transition-all " +
                                                "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 " +
                                                (qualityScore === 0
                                                    ? "border-blue-500/60 bg-blue-600/20 text-blue-900 ring-2 ring-blue-500/35 dark:text-blue-100"
                                                    : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:bg-blue-500/15 dark:text-blue-100")
                                            }
                                        >
                                            Forgotten — 0
                                        </button>
                                    </>
                                )}
                            </div>
                            <button
                                onClick={handleNext}
                                disabled={qualityScore == null || isSubmitting}
                                className="mt-3 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-white/10 disabled:text-white/40 text-white px-5 py-3 rounded-xl font-bold transition shadow-md"
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
