'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { getGlobalDueQuestions, submitQuizResult } from '@/app/actions/quizActions'

export default function GlobalReviewSession() {
    const router = useRouter()

    // Game State
    const [questions, setQuestions] = useState([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [loading, setLoading] = useState(true)
    const [sessionComplete, setSessionComplete] = useState(false)

    // Interaction State
    const [selectedChoice, setSelectedChoice] = useState(null)
    const [isAnswered, setIsAnswered] = useState(false)
    const [feedback, setFeedback] = useState(null)

    // Timer State
    const [timer, setTimer] = useState(0)
    const timerRef = useRef(null)

    // 1. Initialize Session
    const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in user's timezone
    useEffect(() => {
        const init = async () => {
            const { questions: qData } = await getGlobalDueQuestions(localToday)
            if (qData && qData.length > 0) {
                setQuestions(qData)
            }
            setLoading(false)
        }
        init()
    }, [])

    // 2. Timer Logic
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!loading && !sessionComplete && !isAnswered && questions.length > 0) {
            setTimer(0)
            timerRef.current = setInterval(() => {
                setTimer(prev => prev + 1)
            }, 1000)
        }
        return () => clearInterval(timerRef.current)
    }, [currentIndex, isAnswered, loading, sessionComplete, questions.length])

    // 3. Handle Answer
    const handleAnswer = async (choice) => {
        if (isAnswered) return
        clearInterval(timerRef.current)
        const timeTaken = timer

        setIsAnswered(true)
        setSelectedChoice(choice)

        const currentQ = questions[currentIndex]
        const isCorrect = choice === currentQ.correct_answer

        setFeedback(isCorrect ? 'correct' : 'wrong')

        // Send to Server
        await submitQuizResult(currentQ.course_id, currentQ.id, isCorrect, timeTaken, localToday)
    }

    // 4. Next Question
    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(prev => prev + 1)
            setIsAnswered(false)
            setSelectedChoice(null)
            setFeedback(null)
            setTimer(0)
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

    const currentQ = questions[currentIndex]

    return (
        <div
            className={`
                min-h-screen bg-transparent flex flex-col max-w-2xl md:max-w-4xl mx-auto p-4 md:p-4 pb-32 md:pb-4
                md:min-h-0 md:h-[calc(100dvh-10rem)] md:max-h-[calc(100dvh-10rem)] md:overflow-hidden
            `}
        >
            {/* Desktop: scroll only the middle; keep feedback bar pinned at bottom of this column */}
            <div className="flex flex-col flex-1 min-h-0 md:min-h-0">
                <div className="flex-1 min-h-0 md:overflow-y-auto md:overscroll-contain md:pr-1 space-y-3 md:space-y-3">
                    {/* Header & Progress */}
                    <div className="flex justify-between items-center mb-0 md:mb-0">
                        <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-indigo-600 mb-0.5 truncate max-w-[220px] md:max-w-md">
                                {currentQ.course_name || 'Course'}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[220px] md:max-w-md">
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

                        <div
                            className={`text-sm font-mono font-bold px-3 py-1 rounded-full transition-colors shrink-0 ${timer < 5 ? 'bg-green-100 text-green-700' :
                                timer < 12 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                                }`}
                        >
                            {timer}s
                        </div>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-white/10 h-1.5 md:h-1.5 rounded-full overflow-hidden">
                        <div
                            className="bg-indigo-600 h-full rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${((currentIndex) / questions.length) * 100}%` }}
                        />
                    </div>

                    {/* Question Card — compact on desktop; scroll inside if the prompt is long */}
                    <div className="bg-white dark:bg-white/5 p-4 md:p-4 rounded-2xl md:rounded-2xl shadow-sm border border-gray-100 dark:border-white/10 flex items-center justify-center min-h-[120px] md:min-h-0 md:max-h-[min(200px,32vh)] md:overflow-y-auto">
                        <h2 className="text-lg md:text-lg font-bold text-gray-800 dark:text-gray-100 text-center leading-snug">
                            {currentQ.question_text}
                        </h2>
                    </div>

                    {/* Choices: 2×2 on md+ to save vertical space */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-2 pb-2">
                        {currentQ.choices.map((choice, idx) => {
                            let style = "bg-white border-2 border-gray-100 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-200 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-500/10"

                            if (isAnswered) {
                                if (choice === currentQ.correct_answer) {
                                    style = "bg-green-500 border-green-600 text-white shadow-md md:scale-[1.01]"
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
                                    className={`py-3 px-4 md:py-2.5 md:px-3 rounded-xl md:rounded-xl text-base md:text-sm font-medium text-left transition-all duration-200 shadow-sm active:scale-[0.98] min-h-[44px] ${style}`}
                                >
                                    {choice}
                                </button>
                            )
                        })}
                    </div>
                </div>

            {/* Footer / Next Button */}
            {isAnswered && (
                <>
                    {/* Mobile: fixed action bar (no scrolling needed) */}
                    <div className="md:hidden fixed inset-x-0 bottom-0 z-50 p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
                        <div
                            className={`
                w-full p-4 rounded-2xl flex items-center justify-between gap-3 shadow-2xl border backdrop-blur-sm bg-white/95 dark:bg-neutral-900/85
                ${feedback === 'correct'
                                    ? 'border-green-200 dark:border-green-500/30'
                                    : 'border-red-200 dark:border-red-500/30'}
              `}
                        >
                            <div className="min-w-0">
                                <span className={`font-bold text-base block ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                    {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                    {feedback === 'correct' && timer <= 5 && "⚡ Super fast! (+5 Quality)"}
                                    {feedback === 'correct' && timer > 5 && timer <= 12 && "👍 Good pace! (+4 Quality)"}
                                    {feedback === 'correct' && timer > 12 && "🐢 A bit slow. (+3 Quality)"}
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

                    {/* Desktop: pinned below scroll area — always visible without page scroll */}
                    <div className="hidden md:block shrink-0 pt-2 mt-auto border-t border-gray-100 dark:border-white/10">
                        <div
                            className={`
                w-full p-3 rounded-xl flex justify-between items-center gap-4 shadow-md
                ${feedback === 'correct'
                                    ? 'bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30'
                                    : 'bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30'}
            `}
                        >
                            <div className="min-w-0">
                                <span className={`font-bold text-base block ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                                    {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-300">
                                    {feedback === 'correct' && timer <= 5 && "⚡ Super fast! (+5 Quality)"}
                                    {feedback === 'correct' && timer > 5 && timer <= 12 && "👍 Good pace! (+4 Quality)"}
                                    {feedback === 'correct' && timer > 12 && "🐢 A bit slow. (+3 Quality)"}
                                    {feedback === 'wrong' && "Resetting progress."}
                                </span>
                            </div>
                            <button
                                onClick={handleNext}
                                className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold transition shadow-md"
                            >
                                Next Question
                            </button>
                        </div>
                    </div>
                </>
            )}
            </div>

        </div>
    )
}
