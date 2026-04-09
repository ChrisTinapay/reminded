'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { getDueQuestions, submitQuizResult } from '@/app/actions/quizActions'

export default function ReviewSession() {
  const params = useParams()
  const router = useRouter()
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

  // Timer State
  const [timer, setTimer] = useState(0)
  const timerRef = useRef(null)

  // 1. Initialize Session
  const localToday = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in user's timezone
  useEffect(() => {
    const init = async () => {
      const { questions: qData } = await getDueQuestions(courseId, materialId, localToday)
      if (qData && qData.length > 0) {
        setQuestions(qData)
      }
      setLoading(false)
    }
    init()
  }, [courseId, materialId])

  // 2. Timer Logic (Starts when question appears)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loading && !sessionComplete && !isAnswered && questions.length > 0) {
      setTimer(0) // Reset timer
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(timerRef.current)
  }, [currentIndex, isAnswered, loading, sessionComplete, questions.length])

  // 3. Handle Answer
  const handleAnswer = async (choice) => {
    if (isAnswered) return

    // Stop Timer
    clearInterval(timerRef.current)
    const timeTaken = timer

    setIsAnswered(true)
    setSelectedChoice(choice)

    const currentQ = questions[currentIndex]
    const isCorrect = choice === currentQ.correct_answer

    setFeedback(isCorrect ? 'correct' : 'wrong')

    // 4. Send to Server (Background)
    await submitQuizResult(courseId, currentQ.id, isCorrect, timeTaken, localToday)
  }

  // 5. Next Question
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

  const currentQ = questions[currentIndex]

  return (
    <div className="min-h-screen bg-transparent flex flex-col max-w-2xl mx-auto p-4 md:p-6">

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

        {/* Visual Timer */}
        <div className={`text-sm font-mono font-bold px-3 py-1 rounded-full transition-colors ${timer < 5 ? 'bg-green-100 text-green-700' :
          timer < 12 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
          }`}>
          {timer}s
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
          // Dynamic Styles
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
              key={`review-choice-${idx}`}
              onClick={() => handleAnswer(choice)}
              disabled={isAnswered}
              className={`
                        p-5 rounded-2xl text-lg font-medium text-left transition-all duration-200 
                        shadow-sm active:scale-[0.98]
                        ${style}
                    `}
            >
              {choice}
            </button>
          )
        })}
      </div>

      {/* Footer / Next Button */}
      <div className="h-24 flex items-end">
        {isAnswered && (
          <div className={`
                w-full p-4 rounded-xl flex justify-between items-center shadow-lg animate-in slide-in-from-bottom-2 fade-in
                ${feedback === 'correct'
              ? 'bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30'
              : 'bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30'}
            `}>
            <div>
              <span className={`font-bold text-lg block ${feedback === 'correct' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {feedback === 'correct' ? 'Correct!' : 'Incorrect'}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {feedback === 'correct' && timer <= 5 && "⚡ Super fast! (+5 Quality)"}
                {feedback === 'correct' && timer > 5 && timer <= 12 && "👍 Good pace! (+4 Quality)"}
                {feedback === 'correct' && timer > 12 && "🐢 A bit slow. (+3 Quality)"}
                {feedback === 'wrong' && "Resetting progress."}
              </span>
            </div>
            <button
              onClick={handleNext}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-lg font-bold transition shadow-md"
            >
              Next Question
            </button>
          </div>
        )}
      </div>

    </div>
  )
}