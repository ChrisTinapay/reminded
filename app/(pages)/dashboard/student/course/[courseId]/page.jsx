'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/app/_lib/supabaseClient'
import { uploadMaterialToStorage } from '@/app/actions/generateQuestions'
import { enqueueQuizJobFromStorageRef, getJobQueueJob, retryJobQueueJob } from '@/app/actions/jobQueue'
import { distributeAnswerPositions } from '@/lib/llm/distributeAnswerPositions'
import { saveQuestion } from '@/app/actions/questions'
import { fetchCoursePageData, saveLearningMaterial, fetchLearningMaterials, deleteLearningMaterial, updateCourseName, updateTopicName, deleteCourse } from '@/app/actions/courses'
import CriticalMassGame from '@/app/components/CriticalMassGame'
import PdfPageSelector from '@/app/components/PdfPageSelector'
import ConfirmDialog from '@/app/components/ConfirmDialog'

export default function CourseLobby() {
  const params = useParams()
  const router = useRouter()
  const courseId = params.courseId

  // State
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, mastered: 0, due: 0 })
  const [materials, setMaterials] = useState([])
  const [topicDue, setTopicDue] = useState({})

  // Course Name Editing
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Upload & Generate State
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedQuestions, setGeneratedQuestions] = useState([])
  const [isReviewing, setIsReviewing] = useState(false)
  const [activeJobId, setActiveJobId] = useState(null)
  const [jobStatus, setJobStatus] = useState(null) // 'pending'|'processing'|'completed'|'failed'
  const [jobAttempts, setJobAttempts] = useState(0)
  const [jobLastError, setJobLastError] = useState(null)
  const [jobStartedAt, setJobStartedAt] = useState(null) // ms epoch
  const jobStartedAtRef = useRef(null) // ms epoch (for polling closures)
  const [completionStartedAt, setCompletionStartedAt] = useState(null) // ms epoch
  const completionTimeoutRef = useRef(null)
  const completionPayloadRef = useRef(null)
  const [hudNow, setHudNow] = useState(() => Date.now())
  const [pdfToSelect, setPdfToSelect] = useState(null) // File before page selection
  const [uploadedFile, setUploadedFile] = useState(null) // Raw File object for deferred upload
  const [uploadedFileName, setUploadedFileName] = useState(null)
  const [uploadedStorageFileId, setUploadedStorageFileId] = useState(null)
  const [draftMaterialId, setDraftMaterialId] = useState(null)
  const [topicName, setTopicName] = useState('')

  // Toast notifications
  const [toast, setToast] = useState(null) // { type: 'success'|'error', message }
  const toastTimerRef = useRef(null)
  const jobPollRef = useRef(null)
  const longWaitNotifiedRef = useRef(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletingCourse, setDeletingCourse] = useState(false)
  const showToast = (type, message) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ type, message })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
      if (jobPollRef.current) clearInterval(jobPollRef.current)
      if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current)
    }
  }, [])

  // Force periodic re-render while generating so the in-game HUD animates smoothly.
  useEffect(() => {
    if (!isGenerating) return
    const id = setInterval(() => setHudNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [isGenerating])

  const handleDeleteCourse = async () => {
    if (!course?.id) return
    try {
      setDeletingCourse(true)
      setLoading(true)
      const res = await deleteCourse(course.id)
      if (!res?.success) throw new Error(res?.error || 'Failed to delete course')
      showToast('success', 'Course deleted.')
      router.push('/dashboard/student')
    } catch (err) {
      showToast('error', 'Error deleting course: ' + (err?.message || String(err)))
    } finally {
      setDeletingCourse(false)
      setLoading(false)
      setShowDeleteDialog(false)
    }
  }

  useEffect(() => {
    const fetchData = async () => {
      const localToday = new Date().toLocaleDateString('en-CA')
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/dashboard/student')
        return
      }

      try {
        const data = await fetchCoursePageData(courseId, localToday)

        if (!data) {
          alert('Course not found!')
          router.push('/dashboard/student')
          return
        }

        setCourse(data.course)
        setEditedName(data.course.course_name)
        setStats(data.stats)
        setMaterials(data.materials)
        setTopicDue(data.topicDue)
      } catch (err) {
        console.error("Failed to fetch course data:", err)
        alert('Course not found!')
        router.push('/dashboard/student')
      }

      setLoading(false)
    }
    if (courseId) fetchData()
  }, [courseId, router])

  // --- Course Name Edit ---
  const handleSaveName = async () => {
    if (!editedName.trim() || editedName.trim() === course.course_name) {
      setIsEditingName(false)
      setEditedName(course.course_name)
      return
    }
    setSavingName(true)
    try {
      await updateCourseName(courseId, editedName.trim())
      setCourse({ ...course, course_name: editedName.trim() })
      setIsEditingName(false)
    } catch (err) {
      alert('Error updating name: ' + err.message)
    } finally {
      setSavingName(false)
    }
  }

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') handleSaveName()
    if (e.key === 'Escape') { setIsEditingName(false); setEditedName(course.course_name) }
  }

  // --- Question Review Editing ---
  const handleReviewEdit = (index, field, value) => {
    const updated = [...generatedQuestions];
    updated[index][field] = value;
    setGeneratedQuestions(updated);
  };

  const handleReviewChoiceEdit = (qIndex, cIndex, value) => {
    const updated = [...generatedQuestions];
    updated[qIndex].choices[cIndex] = value;
    setGeneratedQuestions(updated);
  };

  const handleReviewDelete = (index) => {
    if (confirm('Remove this question from the draft?')) {
      const updated = generatedQuestions.filter((_, i) => i !== index);
      setGeneratedQuestions(updated);
    }
  };

  const handlePublish = async () => {
    if (!topicName.trim()) {
      showToast('error', 'Please enter a topic name before publishing.')
      return;
    }

    setLoading(true);
    try {
      // Step 1: Upload file to Supabase Storage NOW (at publish time)
      let filePath = null;
      if (uploadedStorageFileId) {
        filePath = uploadedStorageFileId
      } else if (uploadedFile) {
        const storageFormData = new FormData();
        storageFormData.append('file', uploadedFile);
        const storageResult = await uploadMaterialToStorage(storageFormData);
        if (storageResult.success) {
          filePath = storageResult.fileId;
          setUploadedStorageFileId(storageResult.fileId)
        }
      }

      let materialIdToUse = draftMaterialId

      if (materialIdToUse) {
        const topicRes = await updateTopicName(materialIdToUse, topicName.trim())
        if (!topicRes?.success) throw new Error(topicRes?.error || 'Failed to update topic name')
      } else {
        const materialResult = await saveLearningMaterial({
          course_id: courseId,
          file_name: uploadedFileName,
          file_path: filePath,
          topic_name: topicName.trim(),
        });

        if (!materialResult.success) throw new Error('Failed to save material');
        materialIdToUse = materialResult.id
      }

      // Step 3: Distribute answer positions before saving
      const distributedQuestions = distributeAnswerPositions(generatedQuestions);

      // Step 4: Save questions
      for (const q of distributedQuestions) {
        await saveQuestion({
          course_id: courseId,
          material_id: materialIdToUse,
          question_text: q.question_text,
          choices: q.choices,
          correct_answer: q.correct_answer,
        });
      }

      showToast('success', `Topic "${topicName.trim()}" created with ${distributedQuestions.length} questions!`)
      setGeneratedQuestions([]);
      setIsReviewing(false);
      setUploadedFile(null);
      setUploadedFileName(null);
      setUploadedStorageFileId(null)
      setDraftMaterialId(null)
      setTopicName('');

      // Refresh data
      const localToday = new Date().toLocaleDateString('en-CA')
      const data = await fetchCoursePageData(courseId, localToday)
      if (data) {
        setStats(data.stats)
        setMaterials(data.materials)
        setTopicDue(data.topicDue)
      }
    } catch (error) {
      console.error(error);
      showToast('error', 'Publish Error: ' + error.message)
    } finally {
      setLoading(false);
    }
  };

  // --- File Upload (AI scan only — no storage upload) ---
  const handleFileUpload = async (file) => {
    // If the user hasn't selected pages yet, show the selector first.
    // Once they confirm, we call this again with the extracted file.
    if (!pdfToSelect && file && file.type === 'application/pdf') {
      // allow direct start if caller explicitly passes an extracted file
    }
    setIsGenerating(true);
    longWaitNotifiedRef.current = false
    setJobAttempts(0)
    setJobLastError(null)
    setDraftMaterialId(null)
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload once up-front so the worker can download it without embedding base64 in job_queue
      const storageResult = await uploadMaterialToStorage(formData)
      if (!storageResult.success) throw new Error(storageResult.error || 'Failed to upload PDF')
      if (!storageResult.fileId) throw new Error('Storage did not return fileId')

      setUploadedStorageFileId(storageResult.fileId)
      setUploadedFile(file); // keep local copy (optional) for UI only
      setUploadedFileName(file.name);
      setTopicName(file.name.replace(/\.pdf$/i, ''));

      // Enqueue background job (worker will process)
      const enqueueResult = await enqueueQuizJobFromStorageRef({
        courseId,
        storageBucket: 'materials',
        storagePath: storageResult.fileId,
        fileName: file.name,
        mimeType: file.type,
      })
      if (!enqueueResult.success) throw new Error(enqueueResult.error)

      const jobId = enqueueResult.jobId
      setActiveJobId(jobId)
      setJobStatus('pending')
      const startedAt = Date.now()
      setJobStartedAt(startedAt)
      jobStartedAtRef.current = startedAt
      showToast('success', 'Queued. Generating questions in the background...')

      // Poll until completed/failed
      if (jobPollRef.current) clearInterval(jobPollRef.current)
      jobPollRef.current = setInterval(async () => {
        const jobRes = await getJobQueueJob(jobId)
        if (!jobRes.success) return
        const job = jobRes.data
        setJobStatus(job.status)
        setJobAttempts(job.attempts ?? 0)
        setJobLastError(job.last_error ?? null)

        if (job.status === 'completed') {
          clearInterval(jobPollRef.current)
          jobPollRef.current = null
          const questions = job?.result?.questions || []
          const mid = job?.result?.meta?.materialId
          completionPayloadRef.current = {
            questions,
            materialId: mid != null && mid !== '' ? String(mid) : null,
          }

          // Intentionally keep the game running a bit longer so the HUD can
          // "sync" to the process and finish 85%→100%.
          const doneAt = Date.now()
          setCompletionStartedAt(doneAt)

          if (completionTimeoutRef.current) clearTimeout(completionTimeoutRef.current)
          completionTimeoutRef.current = setTimeout(async () => {
            const payload = completionPayloadRef.current
            completionPayloadRef.current = null
            setCompletionStartedAt(null)

            setActiveJobId(null)
            setJobStatus(null)
            setIsReviewing(false)
            setIsGenerating(false)

            if (payload?.materialId) setDraftMaterialId(payload.materialId)
            setGeneratedQuestions(payload?.questions || [])

            if ((payload?.questions || []).length > 0) {
              showToast('success', 'Quiz is ready and saved. You can leave this page anytime.')
              const localToday = new Date().toLocaleDateString('en-CA')
              const data = await fetchCoursePageData(courseId, localToday)
              if (data) {
                setStats(data.stats)
                setMaterials(data.materials)
                setTopicDue(data.topicDue)
              }
            } else {
              showToast('error', 'Job finished but no questions were returned. Try another PDF or retry.')
            }
          }, 15000)
        }

        if (job.status === 'failed') {
          clearInterval(jobPollRef.current)
          jobPollRef.current = null
          setActiveJobId(null)
          setJobStatus(null)
          setIsGenerating(false)
          showToast('error', 'Generation failed: ' + (job.last_error || 'Unknown error'))
        }

        // One-time hint: usually means the VPS worker is not running or env is wrong
        if (
          Date.now() - (jobStartedAtRef.current ?? Date.now()) > 90000 &&
          job.status === 'pending' &&
          !longWaitNotifiedRef.current
        ) {
          longWaitNotifiedRef.current = true
          showToast(
            'error',
            'Still queued. If this continues, the background worker is probably not running — start it on your server (worker: npm run build && node dist/index.js) and set SUPABASE_SERVICE_ROLE_KEY + GOOGLE_GENERATIVE_AI_API_KEY.',
          )
        }
      }, 2000)
    } catch (error) {
      showToast('error', 'Error: ' + error.message)
      setJobStatus(null)
      setIsGenerating(false)
      if (jobPollRef.current) {
        clearInterval(jobPollRef.current)
        jobPollRef.current = null
      }
    } finally {
      // keep spinner until job completes/fails
    }
  };

  const processingHud = (() => {
    if (!isGenerating) return null
    void hudNow
    const started = jobStartedAtRef.current ?? jobStartedAt ?? Date.now()
    const elapsedS = Math.max(0, (Date.now() - started) / 1000)

    // Best-effort model (we don't have real granular progress from worker):
    // - pending: quick ramp to 12% over ~18s
    // - processing: ramp 12%→95% over ~70s
    // - then hold near 95% until completion
    const pendingCap = 0.12
    const pendingDur = 18
    const procDur = 70
    let p = 0.02
    let eta = undefined
    const phase = completionStartedAt != null ? 'finalizing' : (jobStatus || 'queued')

    // When the worker finishes, we intentionally animate 85%→100% over 15s.
    if (completionStartedAt != null) {
      const t = Math.max(0, (Date.now() - completionStartedAt) / 1000)
      const pFinal = Math.min(1, 0.85 + (t / 15) * 0.15)
      const etaFinal = Math.max(0, 15 - t)
      return {
        progress: pFinal,
        phaseLabel: phase,
        etaSeconds: etaFinal,
      }
    }

    if (phase === 'pending' || phase === 'queued') {
      p = Math.min(pendingCap, 0.02 + (elapsedS / pendingDur) * (pendingCap - 0.02))
      eta = Math.max(0, pendingDur - elapsedS) + procDur
    } else if (phase === 'processing') {
      const t = Math.max(0, elapsedS - pendingDur)
      p = Math.min(0.95, pendingCap + (t / procDur) * (0.95 - pendingCap))
      eta = Math.max(0, procDur - t)
    } else {
      // Unknown: keep it moving but conservative.
      p = Math.min(0.95, 0.15 + (elapsedS / 120) * 0.8)
    }

    // Gentle “breathing” near the end so it doesn't look frozen.
    if (p >= 0.94) {
      const wobble = (Math.sin(Date.now() / 520) + 1) / 2 // 0..1
      p = 0.94 + wobble * 0.01
    }

    return {
      progress: Math.max(0, Math.min(0.99, p)),
      phaseLabel: phase,
      etaSeconds: typeof eta === 'number' ? eta : undefined,
    }
  })()

  const handleRetryJob = async () => {
    if (!activeJobId) return
    const res = await retryJobQueueJob(activeJobId)
    if (!res?.success) {
      showToast('error', res?.error || 'Retry failed')
      return
    }
    showToast('success', 'Retry queued. Waiting for worker...')
    longWaitNotifiedRef.current = false
    setJobStatus('pending')
  }

  if (loading) return <div className="p-12 text-center text-gray-500 dark:text-gray-400 font-inter">Loading course data...</div>
  if (!course) return <div className="p-12 text-center text-gray-700 dark:text-gray-300 font-inter">Course not found.</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">

      <ConfirmDialog
        open={showDeleteDialog}
        title="Delete course?"
        description={
          course?.course_name
            ? `This will permanently delete "${course.course_name}", including all topics, questions, and progress.`
            : 'This will permanently delete this course, including all topics, questions, and progress.'
        }
        confirmText="Delete course"
        cancelText="Cancel"
        tone="danger"
        busy={deletingCourse}
        onClose={() => {
          if (deletingCourse) return
          setShowDeleteDialog(false)
        }}
        onConfirm={handleDeleteCourse}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border backdrop-blur-sm transition-all animate-[slideIn_0.3s_ease-out] ${toast.type === 'success'
            ? 'bg-green-50/95 border-green-200 text-green-800 dark:bg-green-500/10 dark:border-green-500/30 dark:text-green-200'
            : 'bg-red-50/95 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200'
          }`}>
          <span className="text-lg">{toast.type === 'success' ? '✅' : '❌'}</span>
          <p className="text-sm font-medium max-w-xs">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center font-inter text-sm text-gray-500 dark:text-gray-400">
        <Link href="/dashboard/student" className="hover:text-blue-600 dark:hover:text-indigo-300">Dashboard</Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-gray-100 font-medium">{course.course_name}</span>
      </div>

      {/* Hero Header with Editable Name */}
      <div className="brand-card p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-600 to-violet-500"></div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  autoFocus
                  className="text-3xl font-bold text-gray-900 dark:text-gray-100 border-b-2 border-indigo-500 bg-transparent outline-none pb-1 pr-2"
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                  title="Save"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <button
                  onClick={() => { setIsEditingName(false); setEditedName(course.course_name); }}
                  className="p-1.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/15"
                  title="Cancel"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{course.course_name}</h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors dark:hover:bg-indigo-500/10 dark:hover:text-indigo-200"
                  title="Edit course name"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              </div>
            )}
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Your personal study space</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="inline-flex items-center justify-center gap-2 border border-red-200 bg-red-50 text-red-700 font-semibold py-3 px-5 rounded-full hover:bg-red-100 transition-colors dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-500/15"
              title="Delete course"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete course
            </button>
            {stats.due > 0 ? (
              <Link
                href={`/dashboard/student/course/${courseId}/review?topic=${encodeURIComponent(course.course_name + ' — All Topics')}`}
                className="group relative inline-flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Review {course.course_name} ({stats.due} Due)</span>
              </Link>
            ) : (
              <div className="inline-flex items-center justify-center bg-green-100 text-green-700 font-bold py-3 px-8 rounded-full dark:bg-green-500/10 dark:text-green-200 dark:border dark:border-green-500/30">
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>All Caught Up!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-blue-50 dark:bg-blue-500/10 p-6 rounded-xl border border-blue-100 dark:border-blue-500/20 flex flex-col items-center">
          <h3 className="text-blue-800 dark:text-blue-200 font-semibold mb-1 text-sm uppercase tracking-wide">Total Questions</h3>
          <p className="text-4xl font-black text-blue-900 dark:text-blue-100">{stats.total}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-500/10 p-6 rounded-xl border border-green-100 dark:border-green-500/20 flex flex-col items-center">
          <h3 className="text-green-800 dark:text-green-200 font-semibold mb-1 text-sm uppercase tracking-wide">Mastered</h3>
          <p className="text-4xl font-black text-green-900 dark:text-green-100">{stats.mastered}</p>
          <p className="text-xs text-green-700 dark:text-green-200/80 mt-2">Long-term Memory</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-500/10 p-6 rounded-xl border border-orange-100 dark:border-orange-500/20 flex flex-col items-center">
          <h3 className="text-orange-800 dark:text-orange-200 font-semibold mb-1 text-sm uppercase tracking-wide">Due for Review</h3>
          <p className="text-4xl font-black text-orange-900 dark:text-orange-100">{stats.due}</p>
          <p className="text-xs text-orange-700 dark:text-orange-200/80 mt-2">Needs Attention</p>
        </div>
      </div>

      {/* Topics Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Topics</h2>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-inter">{materials.length} topic{materials.length !== 1 ? 's' : ''}</span>
        </div>

        {materials.length > 0 ? (
          <div className="space-y-5 mb-8">
            {materials.map((mat) => (
              <div key={`topic-${mat.id}`} className="brand-card overflow-hidden hover:shadow-md transition-all">
                <div className="h-1.5 bg-gradient-to-r from-indigo-500 to-violet-400"></div>
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">{mat.topic_name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-sm text-gray-400 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          {mat.question_count} questions
                        </span>
                        <span>•</span>
                        <span>{new Date(mat.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Two Buttons: Start Study Session + Topic Management */}
                  <div className="flex flex-wrap gap-3">
                    {(() => {
                      const dueCount = topicDue[mat.id] || 0;
                      if (dueCount > 0) {
                        return (
                          <Link
                            href={`/dashboard/student/course/${courseId}/review?materialId=${mat.id}&topic=${encodeURIComponent(mat.topic_name)}`}
                            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-full shadow-md transition-all transform hover:scale-[1.03]"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Study {mat.topic_name} ({dueCount} due)
                          </Link>
                        );
                      }
                      return (
                        <span className="inline-flex items-center gap-2 bg-green-100 text-green-700 font-semibold py-2.5 px-5 rounded-full">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          All Caught Up
                        </span>
                      );
                    })()}

                    <Link
                      href={`/dashboard/student/course/${courseId}/topic/${mat.id}`}
                      className="inline-flex items-center gap-2 py-2.5 px-4 text-sm font-medium text-gray-700 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors dark:text-gray-200 dark:bg-white/10 dark:hover:bg-white/15"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Topic Management
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 border-dashed mb-8">
            <p className="text-gray-500 dark:text-gray-400">No topics yet. Upload a PDF below to create your first topic!</p>
          </div>
        )}
      </div>

      {/* Upload / Create New Topic Section */}
      <div>
        {isReviewing ? (
          <div className="space-y-6">
            <div className="p-5 rounded-xl shadow-sm border border-yellow-200 bg-yellow-50 dark:bg-yellow-500/10 dark:border-yellow-500/30">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold font-poppins text-gray-800 dark:text-gray-100">Create New Topic</h2>
                  <p className="text-sm font-inter text-gray-800/75 dark:text-gray-300">Name your topic and review the generated questions before saving.</p>
                </div>
                <div className="space-x-2 flex">
                  <button onClick={() => { setIsReviewing(false); setTopicName(''); }} className="text-gray-700 hover:text-gray-900 px-3 py-1 font-medium dark:text-gray-200 dark:hover:text-gray-50">Discard</button>
                  <button onClick={handlePublish} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium shadow-sm">Save Topic &amp; Questions</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">Topic Name</label>
                <input
                  type="text"
                  value={topicName}
                  onChange={(e) => setTopicName(e.target.value)}
                  placeholder="e.g. Chapter 1: Introduction to Biology"
                  className="w-full p-3 border border-yellow-300 dark:border-yellow-500/40 rounded-lg bg-white dark:bg-white/5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>

            {generatedQuestions.map((q, qIndex) => (
              <div key={`new-q-${qIndex}`} className="bg-white dark:bg-white/5 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-white/10">
                <div className="flex justify-between mb-3">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold uppercase rounded">Q{qIndex + 1}</span>
                  <button onClick={() => handleReviewDelete(qIndex)} className="text-red-400 hover:text-red-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <textarea
                  value={q.question_text}
                  onChange={(e) => handleReviewEdit(qIndex, 'question_text', e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-white/10 rounded-md focus:ring-2 focus:ring-indigo-500 font-medium text-gray-800 dark:text-gray-100 bg-white dark:bg-white/5 mb-4"
                  rows={2}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {q.choices.map((choice, cIndex) => (
                    <div key={`choice-${qIndex}-${cIndex}`} className="flex items-center">
                      <input
                        type="radio"
                        name={`correct-${qIndex}`}
                        checked={q.correct_answer === choice}
                        onChange={() => handleReviewEdit(qIndex, 'correct_answer', choice)}
                        className="mr-3 h-4 w-4 text-indigo-600 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={choice}
                        onChange={(e) => handleReviewChoiceEdit(qIndex, cIndex, e.target.value)}
                        className={`w-full p-2 border rounded-md text-sm bg-white dark:bg-white/5 dark:text-gray-100 dark:border-white/10 ${q.correct_answer === choice ? 'border-green-500 bg-green-50 ring-1 ring-green-500 text-green-900 dark:bg-green-500/10 dark:text-green-200' : 'border-gray-300 text-gray-700'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="brand-surface rounded-lg shadow-sm border brand-border">
            <div className="p-4 border-b brand-border"><h2 className="text-lg font-bold font-poppins text-gray-800 dark:text-gray-100">Add New Topic</h2></div>
            <div className="p-8">
              {isGenerating ? (
                <div className="text-center p-6 sm:p-10 space-y-3">
                  <div className="mx-auto w-full max-w-[520px] h-[420px] sm:h-[440px] md:h-[360px] mb-3">
                    <CriticalMassGame
                      status="polling"
                      progress={processingHud?.progress}
                      phaseLabel={processingHud?.phaseLabel}
                      etaSeconds={processingHud?.etaSeconds}
                      showHint={false}
                    />
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Tap during vibration for <span className="font-semibold text-indigo-600 dark:text-indigo-300">Perfect</span> flip
                  </p>
                  <p className="text-gray-800 dark:text-gray-100 font-inter font-semibold">
                    Generating questions…
                  </p>
                  {jobLastError ? (
                    <p className="text-sm text-red-600 max-w-md mx-auto">{jobLastError}</p>
                  ) : null}
                  <button
                    onClick={handleRetryJob}
                    disabled={!activeJobId}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium border bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-100"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  {pdfToSelect ? (
                    <div className="space-y-4">
                      <PdfPageSelector
                        initialFile={pdfToSelect}
                        onExtract={(newFile) => {
                          setPdfToSelect(null)
                          handleFileUpload(newFile)
                        }}
                        className="text-left"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPdfToSelect(null)}
                          className="inline-flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium border bg-white hover:bg-gray-50 dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/10 dark:text-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 dark:border-white/15 rounded-lg p-12 text-center hover:border-blue-500 dark:hover:border-indigo-400/40 hover:bg-blue-50 dark:hover:bg-indigo-500/10 transition cursor-pointer relative">
                      <input
                        type="file"
                        accept=".pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f) setPdfToSelect(f)
                          e.currentTarget.value = ''
                        }}
                      />
                      <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mt-2 font-inter text-gray-600 dark:text-gray-300"><span className="font-medium text-blue-600 dark:text-indigo-300">Upload a PDF</span> to choose pages</p>
                      <p className="text-sm font-inter text-gray-400 dark:text-gray-400 mt-1">You’ll pick the exact pages to analyze before we generate questions.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}