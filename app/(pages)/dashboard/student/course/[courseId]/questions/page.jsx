'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';

import { fetchQuestions, fetchQuestionsByMaterial, updateQuestion, deleteQuestion } from '@/app/actions/questions';
import { fetchCourseDetails, fetchLearningMaterials } from '@/app/actions/courses';

export default function QuestionEditor() {
  const params = useParams();
  const searchParams = useSearchParams();
  const courseId = params.courseId;
  const materialId = searchParams.get('materialId');

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [courseName, setCourseName] = useState('');
  const [topicName, setTopicName] = useState('');

  // Track unsaved changes
  const [dirtyQuestions, setDirtyQuestions] = useState(new Set());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const course = await fetchCourseDetails(courseId);
        if (course) setCourseName(course.course_name);
      } catch (err) {
        console.error("Failed to fetch course details for header:", err);
      }

      // If materialId is provided, fetch questions for that topic only
      if (materialId) {
        try {
          const materials = await fetchLearningMaterials(courseId);
          const currentMaterial = materials.find(m => String(m.id) === String(materialId));
          if (currentMaterial) setTopicName(currentMaterial.topic_name);
        } catch (err) {
          console.error("Failed to fetch material info:", err);
        }

        try {
          const questionsData = await fetchQuestionsByMaterial(materialId);
          setQuestions(questionsData);
        } catch (error) {
          console.error("Failed to fetch questions by material:", error);
        }
      } else {
        // Fetch all questions for the course
        try {
          const questionsData = await fetchQuestions(courseId);
          setQuestions(questionsData);
        } catch (error) {
          console.error("Failed to fetch questions:", error);
        }
      }
      setLoading(false);
    };

    fetchData();
  }, [courseId, materialId]);

  // --- EDIT HANDLERS ---
  const handleQuestionChange = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
    markAsDirty(updated[index].id);
  };

  const handleChoiceChange = (qIndex, cIndex, value) => {
    const updated = [...questions];
    updated[qIndex].choices[cIndex] = value;
    setQuestions(updated);
    markAsDirty(updated[qIndex].id);
  };

  const markAsDirty = (id) => {
    setDirtyQuestions((prev) => new Set(prev).add(id));
  };

  // --- DATABASE ACTIONS ---
  const handleSaveChanges = async (index) => {
    const questionToSave = questions[index];

    try {
      const response = await updateQuestion(questionToSave);

      if (response && response.success) {
        const newDirty = new Set(dirtyQuestions);
        newDirty.delete(questionToSave.id);
        setDirtyQuestions(newDirty);
        alert('Question updated successfully!');
      }
    } catch (err) {
      alert('Error updating: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure? This will permanently delete this question.')) return;

    try {
      const response = await deleteQuestion(id);

      if (response && response.success) {
        setQuestions(questions.filter((q) => q.id !== id));
      }
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  };

  if (loading)
    return (
      <div className="p-8 text-center font-inter brand-secondary">
        Loading Question Editor...
      </div>
    );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div className="mb-6">
        <div className="flex items-center text-sm brand-secondary mb-2">
          <Link
            href={`/dashboard/student/course/${courseId}`}
            className="hover:text-gray-500 dark:hover:text-gray-300 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Course
          </Link>
          <span className="mx-2">/</span>
          <span className="brand-primary font-inter">Question Editor</span>
        </div>
        <h1 className="text-3xl font-poppins font-bold brand-primary">
          {topicName ? `${topicName}` : 'All Questions'}
        </h1>
        <p className="brand-secondary">{courseName} • {questions.length} question{questions.length !== 1 ? 's' : ''}</p>
      </div>

      {questions.length === 0 ? (
        <div className="text-center p-12 dark:bg-neutral-800 rounded-lg border border-dashed border-gray-300 dark:border-indigo-600">
          <p className="brand-secondary">
            No questions found{topicName ? ` for "${topicName}"` : ' for this course'}.
          </p>
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
              key={q.id}
              className={`dark:bg-neutral-800 p-6 rounded-lg shadow-sm border transition-colors ${dirtyQuestions.has(q.id)
                ? 'border-orange-300 ring-1 ring-orange-200'
                : 'border-gray-200 dark:border-indigo-600'
                }`}
            >
              {/* Card Header */}
              <div className="flex justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 font-inter bg-indigo-100 text-indigo-600 text-xs font-bold uppercase rounded">
                    {q.bloom_level}
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
                    onClick={() => handleDelete(q.id)}
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
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium dark:text-gray-100/75 text-gray-800/75 mb-4"
                rows={2}
              />

              {/* Choices Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {q.choices.map((choice, cIndex) => (
                  <div key={`${q.id}-choice-${cIndex}`} className="flex items-center">
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
                      className={`w-full p-2 border rounded-md text-sm text-gray-800/75 dark:text-gray-100/75 transition-colors ${q.correct_answer === choice
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-500 dark:text-green-950/75'
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
  );
}
