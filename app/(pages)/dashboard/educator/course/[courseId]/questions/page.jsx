'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient.js' 

export default function QuestionBank() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId

  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [courseName, setCourseName] = useState('')
  
  // Track which questions have unsaved changes to show a "Save" button
  const [dirtyQuestions, setDirtyQuestions] = useState(new Set())

  useEffect(() => {
    const fetchData = async () => {
      // 1. Get Course Name for Header
      const { data: course } = await supabase
        .from('courses')
        .select('course_name')
        .eq('id', courseId)
        .single()
      
      if (course) setCourseName(course.course_name)

      // 2. Get Questions
      const { data: questionsData, error } = await supabase
        .from('questions')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false })

      if (error) {
        alert('Error fetching questions')
      } else {
        // Ensure choices is parsed if it comes as a string (though Supabase client usually handles JSONB automatically)
        const formatted = questionsData.map(q => ({
          ...q,
          choices: typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices
        }))
        setQuestions(formatted)
      }
      setLoading(false)
    }

    fetchData()
  }, [courseId])

  // --- EDIT HANDLERS ---
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions]
    updated[index][field] = value
    setQuestions(updated)
    markAsDirty(updated[index].id)
  }

  const handleChoiceChange = (qIndex, cIndex, value) => {
    const updated = [...questions]
    updated[qIndex].choices[cIndex] = value
    setQuestions(updated)
    markAsDirty(updated[qIndex].id)
  }

  const markAsDirty = (id) => {
    setDirtyQuestions(prev => new Set(prev).add(id))
  }

  // --- DATABASE ACTIONS ---
  const handleSaveChanges = async (index) => {
    const questionToSave = questions[index]
    
    try {
      const { error } = await supabase
        .from('questions')
        .update({
          question_text: questionToSave.question_text,
          choices: questionToSave.choices, // specific syntax for JSONB
          correct_answer: questionToSave.correct_answer,
          bloom_level: questionToSave.bloom_level
        })
        .eq('id', questionToSave.id)

      if (error) throw error

      // Remove from dirty set
      const newDirty = new Set(dirtyQuestions)
      newDirty.delete(questionToSave.id)
      setDirtyQuestions(newDirty)
      
      alert('Question updated successfully!')
    } catch (err) {
      alert('Error updating: ' + err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm("Are you sure? This will remove the question from all student quizzes.")) return

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', id)

      if (error) throw error

      setQuestions(questions.filter(q => q.id !== id))
    } catch (err) {
      alert('Error deleting: ' + err.message)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading Question Bank...</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div className="mb-6">
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <Link href={`/dashboard/educator/course/${courseId}`} className="hover:text-blue-600 flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Course
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">Question Bank</span>
        </div>
        <h1 className="text-3xl font-bold text-gray-900">Manage Questions</h1>
        <p className="text-gray-600">{courseName}</p>
      </div>

      {questions.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No questions found for this course yet.</p>
          <Link href={`/dashboard/educator/course/${courseId}`} className="text-blue-600 font-medium hover:underline mt-2 inline-block">
            Upload PDF to generate questions
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {questions.map((q, qIndex) => (
            <div key={q.id} className={`bg-white p-6 rounded-lg shadow-sm border transition-colors ${dirtyQuestions.has(q.id) ? 'border-orange-300 ring-1 ring-orange-200' : 'border-gray-200'}`}>
              
              {/* Card Header */}
              <div className="flex justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded">
                    {q.bloom_level}
                  </span>
                  {dirtyQuestions.has(q.id) && (
                    <span className="text-xs font-semibold text-orange-600 animate-pulse">
                      ● Unsaved Changes
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                    {dirtyQuestions.has(q.id) && (
                        <button 
                            onClick={() => handleSaveChanges(qIndex)}
                            className="text-xs bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition"
                        >
                            Save Update
                        </button>
                    )}
                    <button onClick={() => handleDelete(q.id)} className="text-gray-400 hover:text-red-600 transition">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                </div>
              </div>

              {/* Question Text Input */}
              <textarea
                value={q.question_text}
                onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800 mb-4"
                rows={2}
              />

              {/* Choices Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.choices.map((choice, cIndex) => (
                  <div key={cIndex} className="flex items-center">
                    {/* Radio for Correct Answer */}
                    <input
                      type="radio"
                      name={`correct-${q.id}`} // Unique name per question group
                      checked={q.correct_answer === choice}
                      onChange={() => handleQuestionChange(qIndex, 'correct_answer', choice)}
                      className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    {/* Text Input for Choice */}
                    <input
                      type="text"
                      value={choice}
                      onChange={(e) => handleChoiceChange(qIndex, cIndex, e.target.value)}
                      className={`w-full p-2 border rounded-md text-sm text-gray-800 transition-colors ${
                        q.correct_answer === choice 
                          ? 'border-green-500 bg-green-50 ring-1 ring-green-500' 
                          : 'border-gray-300 focus:border-blue-400'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}