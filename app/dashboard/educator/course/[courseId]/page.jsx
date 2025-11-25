// app/dashboard/educator/course/[courseId]/page.jsx
'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient'
import { generateQuestionsFromPDF } from '@/app/actions/generateQuestions'

export default function CourseManagement() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  
  // AI States
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [isReviewing, setIsReviewing] = useState(false) // Toggles between Upload vs Edit View

  useEffect(() => {
    const fetchCourseDetails = async () => {
      const { data, error } = await supabase
        .from('courses')
        .select(`*, academic_levels(name), programs(name)`)
        .eq('id', courseId)
        .single()

      if (error) {
        alert('Course not found!')
        router.push('/dashboard/educator')
      } else {
        setCourse(data)
      }
      setLoading(false)
    }
    if (courseId) fetchCourseDetails()
  }, [courseId, router])

  // --- EDITING FUNCTIONS ---
  const handleQuestionEdit = (index, field, value) => {
    const updated = [...generatedQuestions]
    updated[index][field] = value
    setGeneratedQuestions(updated)
  }

  const handleChoiceEdit = (qIndex, cIndex, value) => {
    const updated = [...generatedQuestions]
    updated[qIndex].choices[cIndex] = value
    setGeneratedQuestions(updated)
  }

  const handleDeleteQuestion = (index) => {
    if(confirm("Are you sure you want to delete this question?")) {
        const updated = generatedQuestions.filter((_, i) => i !== index)
        setGeneratedQuestions(updated)
    }
  }

  const handlePublish = async () => {
    alert("Next Step: We will save these " + generatedQuestions.length + " questions to the database tables!")
    // We will implement the database save here next
  }

  // --- FILE UPLOAD ---
  const handleFileUpload = async (file) => {
    setIsGenerating(true)
    try {
      const filename = `${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('course_materials')
        .upload(filename, file)

      if (uploadError) throw new Error(uploadError.message)

      const aiResult = await generateQuestionsFromPDF(uploadData.path)
      if (!aiResult.success) throw new Error(aiResult.error)

      setGeneratedQuestions(aiResult.data)
      setIsReviewing(true) // Switch to Review Mode immediately
      
    } catch (error) {
      alert("Error: " + error.message)
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) return <div className="p-8 text-center">Loading...</div>
  if (!course) return <div className="p-8 text-center">Course not found.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Top Nav */}
      <div className="mb-6 flex items-center text-sm text-gray-500">
        <Link href="/dashboard/educator" className="hover:text-blue-600">Dashboard</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{course.course_name}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{course.course_name}</h1>
        <div className="flex items-center mt-2 gap-3">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{course.programs?.name}</span>
            <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">{course.academic_levels?.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Content Area */}
        <div className="lg:col-span-2">
          
          {/* --- VIEW 1: REVIEW MODE (The Questions) --- */}
          {isReviewing ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border">
                <h2 className="text-xl font-bold text-gray-800">Review Questions ({generatedQuestions.length})</h2>
                <div className="space-x-2">
                    <button onClick={() => setIsReviewing(false)} className="text-gray-500 hover:text-gray-700 px-3 py-1">Cancel</button>
                    <button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium">Publish Course</button>
                </div>
              </div>

              {generatedQuestions.map((q, qIndex) => (
                <div key={qIndex} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  {/* Question Header */}
                  <div className="flex justify-between mb-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded">{q.bloom_level}</span>
                    <button onClick={() => handleDeleteQuestion(qIndex)} className="text-red-400 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>

                  {/* Question Text Input */}
                  <textarea
                    value={q.question_text}
                    onChange={(e) => handleQuestionEdit(qIndex, 'question_text', e.target.value)}
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
                          name={`correct-${qIndex}`}
                          checked={q.correct_answer === choice}
                          onChange={() => handleQuestionEdit(qIndex, 'correct_answer', choice)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        {/* Text Input for Choice */}
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => handleChoiceEdit(qIndex, cIndex, e.target.value)}
                          className={`w-full p-2 border rounded-md text-sm text-gray-800 ${
                            q.correct_answer === choice ? 'border-green-500 bg-green-50 ring-1 ring-green-500' : 'border-gray-300'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            
            /* --- VIEW 2: UPLOAD MODE (The Dropzone) --- */
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[400px]">
                <div className="p-4 border-b border-gray-200"><h2 className="text-lg font-bold text-gray-800">Upload Material</h2></div>
                <div className="p-8">
                    {isGenerating ? (
                        <div className="text-center p-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-gray-600">Gemini is analyzing your PDF...</p>
                        </div>
                    ) : (
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 hover:bg-blue-50 transition cursor-pointer relative">
                            <input type="file" accept=".pdf" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                            />
                            <p className="mt-2 text-gray-600"><span className="font-medium text-blue-600">Click to Upload PDF</span> (Max 10MB)</p>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Course Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between"><span className="text-gray-600">Generated</span><span className="font-bold">{generatedQuestions.length}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}