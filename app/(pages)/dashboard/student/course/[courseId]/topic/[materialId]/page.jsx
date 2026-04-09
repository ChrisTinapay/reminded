'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { fetchCourseDetails, fetchLearningMaterials, deleteLearningMaterial, updateTopicName, checkTopicHasProgress } from '@/app/actions/courses'
import { fetchQuestionsByMaterial, updateQuestion, deleteQuestion } from '@/app/actions/questions'
import { getSignedMaterialUrl } from '@/app/actions/materials'

export default function TopicManagement() {
    const params = useParams()
    const router = useRouter()
    const courseId = params.courseId
    const materialId = params.materialId

    const [courseName, setCourseName] = useState('')
    const [material, setMaterial] = useState(null)
    const [questions, setQuestions] = useState([])
    const [loading, setLoading] = useState(true)
    const [dirtyQuestions, setDirtyQuestions] = useState(new Set())

    // Topic Name Editing
    const [isEditingTopicName, setIsEditingTopicName] = useState(false)
    const [editedTopicName, setEditedTopicName] = useState('')
    const [savingTopicName, setSavingTopicName] = useState(false)

    // QE Warning Modal + visibility
    const [showQEWarning, setShowQEWarning] = useState(false)
    const [showQuestions, setShowQuestions] = useState(false)

    // Progress lock
    const [hasProgress, setHasProgress] = useState(false)
    const [materialUrl, setMaterialUrl] = useState(null)

    useEffect(() => {
        const fetchData = async () => {
            try {
                const course = await fetchCourseDetails(courseId)
                if (course) setCourseName(course.course_name)

                const materials = await fetchLearningMaterials(courseId)
                const currentMat = materials.find(m => String(m.id) === String(materialId))
                if (currentMat) {
                    setMaterial(currentMat)
                    setEditedTopicName(currentMat.topic_name)
                }

                const [qData, progressStatus] = await Promise.all([
                    fetchQuestionsByMaterial(materialId),
                    checkTopicHasProgress(materialId)
                ])
                setQuestions(qData)
                setHasProgress(progressStatus)

                if (currentMat?.id) {
                    const urlRes = await getSignedMaterialUrl(currentMat.id)
                    if (urlRes?.success) setMaterialUrl(urlRes.url)
                }
            } catch (err) {
                console.error("Failed to fetch topic data:", err)
            }
            setLoading(false)
        }
        if (courseId && materialId) fetchData()
    }, [courseId, materialId])

    // --- Topic Name Edit ---
    const handleSaveTopicName = async () => {
        if (!editedTopicName.trim() || editedTopicName.trim() === material.topic_name) {
            setIsEditingTopicName(false)
            setEditedTopicName(material.topic_name)
            return
        }
        setSavingTopicName(true)
        try {
            await updateTopicName(materialId, editedTopicName.trim())
            setMaterial({ ...material, topic_name: editedTopicName.trim() })
            setIsEditingTopicName(false)
        } catch (err) {
            alert('Error updating topic name: ' + err.message)
        } finally {
            setSavingTopicName(false)
        }
    }

    const handleTopicNameKeyDown = (e) => {
        if (e.key === 'Enter') handleSaveTopicName()
        if (e.key === 'Escape') { setIsEditingTopicName(false); setEditedTopicName(material.topic_name) }
    }

    // --- Delete Material ---
    const handleDeleteMaterial = async () => {
        if (!confirm('Delete this learning material? This will also delete all associated questions permanently.')) return
        try {
            await deleteLearningMaterial(materialId)
            router.push(`/dashboard/student/course/${courseId}`)
        } catch (err) {
            alert('Error deleting: ' + err.message)
        }
    }

    // --- Question Editing ---
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
        setDirtyQuestions((prev) => new Set(prev).add(id))
    }

    const handleSaveChanges = async (index) => {
        const questionToSave = questions[index]
        try {
            const response = await updateQuestion(questionToSave)
            if (response && response.success) {
                const newDirty = new Set(dirtyQuestions)
                newDirty.delete(questionToSave.id)
                setDirtyQuestions(newDirty)
                alert('Question updated successfully!')
            }
        } catch (err) {
            alert('Error updating: ' + err.message)
        }
    }

    const handleDeleteQuestion = async (id) => {
        if (!confirm('Are you sure? This will permanently delete this question.')) return
        try {
            const response = await deleteQuestion(id)
            if (response && response.success) {
                setQuestions(questions.filter((q) => q.id !== id))
            }
        } catch (err) {
            alert('Error deleting: ' + err.message)
        }
    }

    if (loading) return <div className="p-12 text-center text-gray-500 font-inter">Loading topic...</div>
    if (!material) return <div className="p-12 text-center font-inter">Topic not found.</div>

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8">

            {/* QE Warning Modal */}
            {showQEWarning && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative">
                        <div className="flex justify-center mb-4">
                            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
                                <svg className="w-7 h-7 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Heads Up!</h3>
                        <p className="text-gray-600 text-center text-sm leading-relaxed mb-6">
                            The Question Editor shows all questions <strong>with their correct answers</strong>.
                            Viewing this before your study session may <strong>reduce the effectiveness</strong> of spaced repetition
                            and hinder your learning process.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowQEWarning(false)}
                                className="flex-1 py-3 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                Go Back
                            </button>
                            <button
                                onClick={() => { setShowQEWarning(false); setShowQuestions(true); }}
                                className="flex-1 py-3 px-4 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition-colors"
                            >
                                I Understand, Continue
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Breadcrumb */}
            <div className="flex items-center font-inter text-sm text-gray-500">
                <Link href="/dashboard/student" className="hover:text-blue-600">Dashboard</Link>
                <span className="mx-2">/</span>
                <Link href={`/dashboard/student/course/${courseId}`} className="hover:text-blue-600">{courseName}</Link>
                <span className="mx-2">/</span>
                <span className="text-gray-900 font-medium">{material.topic_name}</span>
            </div>

            {/* Topic Header with Edit */}
            <div>
                {isEditingTopicName ? (
                    <div className="flex items-center gap-2">
                        <input
                            type="text"
                            value={editedTopicName}
                            onChange={(e) => setEditedTopicName(e.target.value)}
                            onKeyDown={handleTopicNameKeyDown}
                            autoFocus
                            className="text-3xl font-bold text-gray-900 border-b-2 border-indigo-500 bg-transparent outline-none pb-1 pr-2"
                        />
                        <button
                            onClick={handleSaveTopicName}
                            disabled={savingTopicName}
                            className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                            title="Save"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </button>
                        <button
                            onClick={() => { setIsEditingTopicName(false); setEditedTopicName(material.topic_name); }}
                            className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Cancel"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">{material.topic_name}</h1>
                        <button
                            onClick={() => setIsEditingTopicName(true)}
                            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Edit topic name"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                        </button>
                    </div>
                )}
                <p className="text-gray-500 text-sm mt-1">Topic Management</p>
            </div>

            {/* Learning Material Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Learning Material</h2>

                <div className="flex items-center justify-between p-4 border rounded-xl group hover:bg-gray-50 transition-colors">
                    <a
                        href={materialUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center flex-1 min-w-0 ${materialUrl ? '' : 'pointer-events-none opacity-60'}`}
                    >
                        <div className="bg-indigo-100 p-3 rounded-lg text-indigo-600 mr-4 group-hover:bg-indigo-600 group-hover:text-white transition-colors flex-shrink-0">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-indigo-700 font-semibold truncate group-hover:text-indigo-900 transition-colors">{material.file_name}</h3>
                            <p className="text-sm text-gray-500">Uploaded {new Date(material.created_at).toLocaleDateString()}</p>
                        </div>
                    </a>
                    <button
                        onClick={handleDeleteMaterial}
                        className="ml-4 flex-shrink-0 flex items-center gap-2 py-2 px-4 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                    </button>
                </div>
            </div>

            {/* Question Editor Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-xl font-bold text-gray-900">Question Editor</h2>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{questions.length} question{questions.length !== 1 ? 's' : ''}</span>
                        {showQuestions && (
                            <button
                                onClick={() => setShowQuestions(false)}
                                className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 py-1.5 px-3 rounded-lg transition-colors"
                                title="Minimize Question Editor"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                                Minimize
                            </button>
                        )}
                    </div>
                </div>

                {/* Locked state: has progress */}
                {hasProgress && !showQuestions ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <p className="text-gray-600 mb-2 max-w-md mx-auto text-sm font-medium">Question Editor is locked</p>
                        <p className="text-gray-400 mb-4 max-w-sm mx-auto text-xs">You have already started studying this topic. Editing questions after answering them may compromise your learning progress.</p>
                    </div>
                ) : !showQuestions ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <p className="text-gray-600 mb-4 max-w-sm mx-auto text-sm">Questions are hidden to protect your learning. Only reveal them if you need to edit.</p>
                        <button
                            onClick={() => setShowQEWarning(true)}
                            className="inline-flex items-center gap-2 py-2.5 px-5 text-sm font-medium text-amber-700 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors border border-amber-200"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Reveal Question Editor
                        </button>
                    </div>
                ) : questions.length === 0 ? (
                    <div className="text-center py-8">
                        <p className="text-gray-500">No questions found for this topic.</p>
                        <Link
                            href={`/dashboard/student/course/${courseId}`}
                            className="text-blue-600 font-medium hover:underline mt-2 inline-block"
                        >
                            Upload a PDF to generate questions
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {questions.map((q, qIndex) => (
                            <div
                                key={`qe-${q.id}-${qIndex}`}
                                className={`p-6 rounded-lg shadow-sm border transition-colors ${dirtyQuestions.has(q.id)
                                    ? 'border-orange-300 ring-1 ring-orange-200'
                                    : 'border-gray-200'
                                    }`}
                            >
                                {/* Card Header */}
                                <div className="flex justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-1 font-inter bg-indigo-100 text-indigo-600 text-xs font-bold uppercase rounded">
                                            Q{qIndex + 1}
                                        </span>
                                        {dirtyQuestions.has(q.id) && (
                                            <span className="text-xs font-inter font-semibold text-orange-600 animate-pulse">
                                                ● Unsaved Changes
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {dirtyQuestions.has(q.id) && (
                                            <button
                                                onClick={() => handleSaveChanges(qIndex)}
                                                className="text-xs font-semibold font-inter bg-orange-500 text-white px-3 py-1 rounded hover:bg-orange-600 transition"
                                            >
                                                Save Update
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeleteQuestion(q.id)}
                                            className="text-gray-400 hover:text-red-600 transition"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>

                                {/* Question Text */}
                                <textarea
                                    value={q.question_text}
                                    onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                                    className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-800 mb-4"
                                    rows={2}
                                />

                                {/* Choices Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {q.choices.map((choice, cIndex) => (
                                        <div key={`qe-${q.id}-choice-${cIndex}`} className="flex items-center">
                                            <input
                                                type="radio"
                                                name={`correct-${q.id}`}
                                                checked={q.correct_answer === choice}
                                                onChange={() => handleQuestionChange(qIndex, 'correct_answer', choice)}
                                                className="mr-3 h-4 w-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={choice}
                                                onChange={(e) => handleChoiceChange(qIndex, cIndex, e.target.value)}
                                                className={`w-full p-2 border rounded-md text-sm text-gray-800 transition-colors ${q.correct_answer === choice
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
        </div>
    )
}
