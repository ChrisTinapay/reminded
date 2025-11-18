'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../_lib/supabaseClient' // Note: Updated path based on your folder move

export default function CreateCourse() {
  const router = useRouter()
  
  // Form States
  const [courseName, setCourseName] = useState('')
  const [academicLevelId, setAcademicLevelId] = useState('')
  const [programId, setProgramId] = useState('')
  
  // Data Lists (for the dropdowns)
  const [levelsList, setLevelsList] = useState([])
  const [programsList, setProgramsList] = useState([])
  
  // Loading States
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // 1. FETCH DATA: When page loads, get the lists for the dropdowns
  useEffect(() => {
    const fetchData = async () => {
      // Fetch Academic Levels
      const { data: levels } = await supabase
        .from('academic_levels')
        .select('id, name')
        .order('name', { ascending: true })
      
      // Fetch Programs
      const { data: programs } = await supabase
        .from('programs')
        .select('id, name')
        .order('name', { ascending: true }) // We can filter by is_archived later

      if (levels) setLevelsList(levels)
      if (programs) setProgramsList(programs)
      setInitialLoading(false)
    }

    fetchData()
  }, [])

  // 2. CREATE NEW ITEM Logic (The "Create as you go" feature)
  const createNewItem = async (table, name) => {
    if (!name) return null
    const { data, error } = await supabase
      .from(table)
      .insert({ name }) // ID is auto-generated
      .select()
      .single()
    
    if (error) {
      alert(`Error creating item: ${error.message}`)
      return null
    }
    return data
  }

  // Prompt the user to add a new level/program
  const handleCreateNew = async (type) => {
    const name = prompt(`Enter the name of the new ${type}:`)
    if (!name) return

    if (type === 'Academic Level') {
      const newItem = await createNewItem('academic_levels', name)
      if (newItem) {
        setLevelsList([...levelsList, newItem]) // Add to list immediately
        setAcademicLevelId(newItem.id) // Select it immediately
      }
    } else if (type === 'Program') {
      const newItem = await createNewItem('programs', name)
      if (newItem) {
        setProgramsList([...programsList, newItem])
        setProgramId(newItem.id)
      }
    }
  }

  // 3. SAVE COURSE Logic
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    
    // Get the current user (the educator)
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert("You must be logged in.")
      return
    }

    // Insert the new course into the database
    const { error } = await supabase
      .from('courses')
      .insert({
        course_name: courseName,
        educator_id: user.id, // Link to the teacher
        academic_level_id: academicLevelId, // Link to the level ID
        program_id: programId // Link to the program ID
      })

    if (error) {
      alert(`Error creating course: ${error.message}`)
      setLoading(false)
    } else {
      // Success! Redirect back to dashboard
      alert('Course created successfully!')
      router.push('/dashboard/educator')
    }
  }

  if (initialLoading) return <div className="p-8 text-center">Loading options...</div>

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 py-12">
      <div className="w-full max-w-lg p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-8">
          Create Your Course
        </h1>
        
        <form className="space-y-6" onSubmit={handleSubmit}>
          
          {/* Course Name Input */}
          <div>
            <label htmlFor="courseName" className="block text-sm font-medium text-gray-700">
              Course Name
            </label>
            <input
              id="courseName"
              type="text"
              required
              placeholder="e.g., Graphic Design"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            />
          </div>

          {/* Academic Level Dropdown */}
          <div>
            <label htmlFor="academicLevel" className="block text-sm font-medium text-gray-700">
              Academic Level
            </label>
            <div className="flex gap-2">
              <select
                id="academicLevel"
                required
                value={academicLevelId}
                onChange={(e) => setAcademicLevelId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">Select a Level...</option>
                {levelsList.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
              {/* Create New Button */}
              <button
                type="button"
                onClick={() => handleCreateNew('Academic Level')}
                className="mt-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-sm"
              >
                + New
              </button>
            </div>
          </div>

          {/* Program Dropdown */}
          <div>
            <label htmlFor="program" className="block text-sm font-medium text-gray-700">
              Program
            </label>
            <div className="flex gap-2">
              <select
                id="program"
                required
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 bg-white shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              >
                <option value="">Select a Program...</option>
                {programsList.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </select>
              {/* Create New Button */}
              <button
                type="button"
                onClick={() => handleCreateNew('Program')}
                className="mt-1 px-3 py-2 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 text-sm"
              >
                + New
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-blue-600 px-4 py-3 font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Course'}
          </button>
        </form>
      </div>
    </div>
  )
}