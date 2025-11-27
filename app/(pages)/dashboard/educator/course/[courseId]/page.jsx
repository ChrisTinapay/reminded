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
  const [studentCount, setStudentCount] = useState(0)
  
  // AI & File States (For New Uploads)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [isReviewing, setIsReviewing] = useState(false)
  
  const [uploadedFilePath, setUploadedFilePath] = useState(null)
  const [uploadedFileName, setUploadedFileName] = useState(null)

  useEffect(() => {
    const fetchCourseDetails = async () => {
      // 1. Fetch Course Info
      const { data: courseData, error } = await supabase
        .from('courses')
        .select(`*, academic_levels(name), programs(name)`)
        .eq('id', courseId)
        .single()

      if (error) {
        alert('Course not found!')
        router.push('/dashboard/educator')
        return
      }
      
      setCourse(courseData)

      // 2. Count Students
      if (courseData) {
        const { count } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true })
          .eq('role', 'student')
          .eq('academic_level_id', courseData.academic_level_id)
          .eq('program_id', courseData.program_id)
        
        setStudentCount(count || 0)
      }
      
      setLoading(false)
    }

    if (courseId) fetchCourseDetails()
  }, [courseId, router])

  // --- PRE-PUBLISH EDITING FUNCTIONS (Only for Review Mode) ---
  const handleReviewEdit = (index, field, value) => {
    const updated = [...generatedQuestions]
    updated[index][field] = value
    setGeneratedQuestions(updated)
  }

  const handleReviewChoiceEdit = (qIndex, cIndex, value) => {
    const updated = [...generatedQuestions]
    updated[qIndex].choices[cIndex] = value
    setGeneratedQuestions(updated)
  }

  const handleReviewDelete = (index) => {
    if(confirm("Remove this question from the draft?")) {
        const updated = generatedQuestions.filter((_, i) => i !== index)
        setGeneratedQuestions(updated)
    }
  }

  const handlePublish = async () => {
    setLoading(true)
    try {
      // 1. Save Material
      const { data: materialData, error: materialError } = await supabase
        .from('learning_materials')
        .insert({
          course_id: courseId,
          file_name: uploadedFileName,
          file_path: uploadedFilePath
        })
        .select().single()

      if (materialError) throw new Error("Failed to save material: " + materialError.message)

      // 2. Prepare Questions
      const questionsToInsert = generatedQuestions.map(q => ({
        course_id: courseId,
        material_id: materialData.id,
        question_text: q.question_text,
        choices: q.choices,
        correct_answer: q.correct_answer,
        bloom_level: q.bloom_level
      }))

      // 3. Save Questions
      const { error: questionsError } = await supabase.from('questions').insert(questionsToInsert)

      if (questionsError) throw new Error(questionsError.message)

      alert("Success! Questions added to the bank.")
      setGeneratedQuestions([])
      setIsReviewing(false)
      setUploadedFileName(null)
      setUploadedFilePath(null)
      
      // Optional: Redirect to questions page to see them
      router.push(`/dashboard/educator/course/${courseId}/questions`)

    } catch (error) {
      console.error(error)
      alert("Publish Error: " + error.message)
    } finally {
      setLoading(false)
    }
  }

  // --- FILE UPLOAD ---
  const handleFileUpload = async (file) => {
    setIsGenerating(true)
    try {
      const filename = `${Date.now()}_${file.name}`
      const { data: uploadData, error: uploadError } = await supabase
        .storage.from('course_materials').upload(filename, file)

      if (uploadError) throw new Error(uploadError.message)

      setUploadedFilePath(uploadData.path)
      setUploadedFileName(file.name)

      const aiResult = await generateQuestionsFromPDF(uploadData.path)
      if (!aiResult.success) throw new Error(aiResult.error)

      setGeneratedQuestions(aiResult.data)
      setIsReviewing(true)
      
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{course.course_name}</h1>
                <div className="flex items-center mt-2 gap-3">
                    <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-sm font-semibold">{course.programs?.name}</span>
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm font-medium">{course.academic_levels?.name}</span>
                </div>
            </div>
            
            <div className="flex gap-3">
                {/* NEW BUTTON: View Question Bank */}
                <Link 
                    href={`/dashboard/educator/course/${courseId}/questions`}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 flex items-center gap-2 shadow-sm transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                    Question Bank
                </Link>

                <Link 
                    href={`/dashboard/educator/course/${courseId}/students`}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                    Students
                </Link>
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Content Area */}
        <div className="lg:col-span-2">
          
          {/* --- VIEW 1: REVIEW MODE (PRE-PUBLISH) --- */}
          {isReviewing ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm border border-yellow-200 bg-yellow-50">
                <div>
                    <h2 className="text-xl font-bold text-gray-800">Review New Questions</h2>
                    <p className="text-sm text-gray-600">These are not saved yet. Review and publish.</p>
                </div>
                <div className="space-x-2">
                    <button onClick={() => setIsReviewing(false)} className="text-gray-500 hover:text-gray-700 px-3 py-1">Discard</button>
                    <button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium shadow-sm">Add to Bank</button>
                </div>
              </div>

              {generatedQuestions.map((q, qIndex) => (
                <div key={qIndex} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                  {/* Question Header */}
                  <div className="flex justify-between mb-3">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded">{q.bloom_level}</span>
                    <button onClick={() => handleReviewDelete(qIndex)} className="text-red-400 hover:text-red-600">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>

                  {/* Question Text Input */}
                  <textarea
                    value={q.question_text}
                    onChange={(e) => handleReviewEdit(qIndex, 'question_text', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-800 mb-4"
                    rows={2}
                  />

                  {/* Choices Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {q.choices.map((choice, cIndex) => (
                      <div key={cIndex} className="flex items-center">
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={q.correct_answer === choice}
                          onChange={() => handleReviewEdit(qIndex, 'correct_answer', choice)}
                          className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) => handleReviewChoiceEdit(qIndex, cIndex, e.target.value)}
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
            
            /* --- VIEW 2: UPLOAD MODE --- */
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
                            <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                            <p className="mt-2 text-gray-600"><span className="font-medium text-blue-600">Click to Upload PDF</span> (Max 10MB)</p>
                            <p className="text-sm text-gray-400 mt-1">Generates questions automatically</p>
                        </div>
                    )}
                </div>
            </div>
          )}
        </div>

        {/* Right Column: Quick Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Class Overview</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Enrolled Students</span>
                <span className="font-bold text-xl">{studentCount}</span>
              </div>
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <Link 
                    href={`/dashboard/educator/course/${courseId}/students`}
                    className="block w-full text-center bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-md text-sm font-medium transition"
                >
                    View Class Roster
                </Link>
                {/* Secondary link to question bank here too */}
                <Link 
                    href={`/dashboard/educator/course/${courseId}/questions`}
                    className="block w-full text-center bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-md text-sm font-medium transition"
                >
                    Manage Question Bank
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}