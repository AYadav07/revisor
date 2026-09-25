import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ApiError, type CourseTree, type SubtopicTreeNode, type TopicTreeNode } from '@/api'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { pluralize } from '@/lib/plural'
import { ROUTES } from '@/routes'
import { courseProgress } from './courseTree'
import { courseKeys } from './queryKeys'
import { useDeleteCourse } from './useCourses'
import { useDeleteSubtopic, useDeleteTopic } from './useCourseTree'

const isNotFound = (error: unknown) => error instanceof ApiError && error.status === 404

/** Keeps a delete dialog's failure message, cleared whenever it closes. */
function useDeleteError(onClose: () => void) {
  const [error, setError] = useState<string | null>(null)
  return {
    error,
    fail: setError,
    close: () => {
      setError(null)
      onClose()
    },
  }
}

interface DeleteTopicDialogProps {
  courseId: number
  topic: TopicTreeNode | null
  onClose: () => void
}

export function DeleteTopicDialog({ courseId, topic, onClose }: DeleteTopicDialogProps) {
  const deleteTopic = useDeleteTopic(courseId)
  const { error, fail, close } = useDeleteError(onClose)

  function confirm() {
    if (!topic) return
    deleteTopic.mutate(topic.id, {
      onSuccess: () => {
        toast.success(`Deleted “${topic.title}”`)
        close()
      },
      // Already gone (deleted in another tab): the goal is met, so just close.
      onError: (e) => (isNotFound(e) ? close() : fail("Couldn't delete the topic. Please try again.")),
    })
  }

  return (
    <ConfirmDialog
      open={topic !== null}
      title={topic ? `Delete “${topic.title}”?` : ''}
      description={
        topic
          ? `This removes the topic and its ${pluralize(topic.subtopics.length, 'subtopic')} from your course and from your review schedule.`
          : ''
      }
      confirmLabel="Delete topic"
      pendingLabel="Deleting…"
      pending={deleteTopic.isPending}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    />
  )
}

interface DeleteSubtopicDialogProps {
  courseId: number
  subtopic: SubtopicTreeNode | null
  onClose: () => void
}

export function DeleteSubtopicDialog({ courseId, subtopic, onClose }: DeleteSubtopicDialogProps) {
  const deleteSubtopic = useDeleteSubtopic(courseId)
  const { error, fail, close } = useDeleteError(onClose)

  function confirm() {
    if (!subtopic) return
    deleteSubtopic.mutate(subtopic.id, {
      onSuccess: () => {
        toast.success(`Deleted “${subtopic.title}”`)
        close()
      },
      onError: (e) => (isNotFound(e) ? close() : fail("Couldn't delete the subtopic. Please try again.")),
    })
  }

  return (
    <ConfirmDialog
      open={subtopic !== null}
      title={subtopic ? `Delete “${subtopic.title}”?` : ''}
      description="It will no longer appear in your course or your review schedule."
      confirmLabel="Delete subtopic"
      pendingLabel="Deleting…"
      pending={deleteSubtopic.isPending}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    />
  )
}

interface DeleteCourseDialogProps {
  course: CourseTree
  open: boolean
  onClose: () => void
}

export function DeleteCourseDialog({ course, open, onClose }: DeleteCourseDialogProps) {
  const deleteCourse = useDeleteCourse(course.id)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { error, fail, close } = useDeleteError(onClose)
  const { total } = courseProgress(course)

  // Leave first, then drop the tree from the cache: removing it while this page is still mounted
  // would have it refetch, get a 404 and flash "Course not found" on the way out.
  function leave() {
    navigate(ROUTES.courses)
    queryClient.removeQueries({ queryKey: courseKeys.detail(course.id) })
  }

  function confirm() {
    deleteCourse.mutate(undefined, {
      onSuccess: () => {
        toast.success(`Deleted “${course.title}”`)
        leave()
      },
      onError: (e) => (isNotFound(e) ? leave() : fail("Couldn't delete the course. Please try again.")),
    })
  }

  return (
    <ConfirmDialog
      open={open}
      title={`Delete “${course.title}”?`}
      description={`This permanently deletes the course, its ${pluralize(course.topics.length, 'topic')}, its ${pluralize(total, 'subtopic')} and all their review history. It can't be undone.`}
      confirmLabel="Delete course"
      pendingLabel="Deleting…"
      pending={deleteCourse.isPending}
      error={error}
      onConfirm={confirm}
      onCancel={close}
    />
  )
}
