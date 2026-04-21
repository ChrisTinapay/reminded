import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Pencil,
  Play,
  Settings,
  Trash2,
} from 'lucide-react'

export interface CourseTopicData {
  id: string
  title: string
  totalQuestions: number
  dueCount: number
  lastReviewedDate: string | null
}

export interface CourseData {
  courseName: string
  totalQuestions: number
  masteredCount: number
  topics: CourseTopicData[]
}

const mockCourseData: CourseData = {
  courseName: 'Biology 101',
  totalQuestions: 240,
  masteredCount: 86,
  topics: [
    { id: 't1', title: 'Cell Structure', totalQuestions: 55, dueCount: 7, lastReviewedDate: '2026-04-18' },
    { id: 't2', title: 'Genetics', totalQuestions: 60, dueCount: 0, lastReviewedDate: '2026-04-20' },
    { id: 't3', title: 'Evolution', totalQuestions: 48, dueCount: 2, lastReviewedDate: '2026-04-19' },
    { id: 't4', title: 'Ecology', totalQuestions: 77, dueCount: 0, lastReviewedDate: null },
  ],
}

function formatLastReviewedDate(lastReviewedDate: string | null) {
  if (!lastReviewedDate) return 'Not reviewed yet'
  const d = new Date(lastReviewedDate)
  if (Number.isNaN(d.getTime())) return lastReviewedDate
  return d.toLocaleDateString()
}

export default function CourseDashboard({
  data = mockCourseData,
}: {
  data?: CourseData
}) {
  const totalDueForReview = data.topics.reduce((sum, t) => sum + t.dueCount, 0)
  const needsAttention = totalDueForReview > 0
  const topicsCountLabel = `${data.topics.length} topic${data.topics.length === 1 ? '' : 's'}`

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm brand-muted">
        <span>Dashboard</span>
        <span className="mx-2">/</span>
        <span className="brand-primary font-medium">{data.courseName}</span>
      </div>

      {/* Course Header Card */}
      <div className="brand-card p-6 sm:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold brand-primary truncate">{data.courseName}</h1>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-lg p-2 brand-muted hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                aria-label="Edit course name"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm brand-muted mt-1">Your personal study space</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold border border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200"
            >
              <Trash2 className="h-4 w-4" />
              Delete course
            </button>

            {needsAttention ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="h-4 w-4" />
                ⚠ Reviews Pending
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" />
                ✓ All Caught Up!
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="brand-card p-6">
          <p className="text-xs font-semibold tracking-wider uppercase brand-muted">Total Questions</p>
          <p className="mt-2 text-4xl font-black brand-primary tabular-nums">{data.totalQuestions}</p>
        </div>

        <div className="brand-card p-6">
          <p className="text-xs font-semibold tracking-wider uppercase brand-muted">Mastered</p>
          <p className="mt-2 text-4xl font-black brand-primary tabular-nums">{data.masteredCount}</p>
          <p className="mt-2 text-xs brand-muted">Long-term Memory</p>
        </div>

        <div className="brand-card p-6">
          <p className="text-xs font-semibold tracking-wider uppercase brand-muted">Due for Review</p>
          <p className="mt-2 text-4xl font-black brand-primary tabular-nums">{totalDueForReview}</p>
          <p className="mt-2 text-xs brand-muted">Needs Attention</p>
        </div>
      </div>

      {/* Topics Section */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <h2 className="text-xl font-bold brand-primary">Topics</h2>
          <span className="text-sm brand-muted">{topicsCountLabel}</span>
        </div>

        <div className="grid grid-cols-1 gap-5">
          {data.topics.map((topic) => {
            const topicNeedsReview = topic.dueCount > 0
            return (
              <div key={topic.id} className="brand-card p-6">
                <div className="flex flex-col gap-4">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold brand-primary truncate">{topic.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-sm brand-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4" />
                        <span className="tabular-nums">{topic.totalQuestions}</span> questions
                      </span>
                      <span aria-hidden="true">•</span>
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="h-4 w-4" />
                        {formatLastReviewedDate(topic.lastReviewedDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {topicNeedsReview ? (
                      <Link
                        href="#"
                        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white brand-cta hover:opacity-95 transition-opacity"
                      >
                        <Play className="h-4 w-4" />
                        ▶ Study {topic.title} ({topic.dueCount} due)
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400 cursor-not-allowed"
                      >
                        Complete for today
                      </button>
                    )}

                    <button
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/10 dark:text-gray-200 dark:hover:bg-white/15 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      Topic Management
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

