import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { showApiError } from '@/lib/formErrors'
import { courseSchema, toCourseRequest, type CourseValues } from './courseSchemas'
import { CourseFields } from './formFields'
import { useUpdateCourse } from './useCourses'

interface EditCourseDialogProps {
  courseId: number
  /** The course being edited; the dialog is open exactly when this is set. */
  course: { title: string; description: string | null } | null
  onClose: () => void
}

const GENERIC_ERROR = "Couldn't save the course. Please try again."

export function EditCourseDialog({ courseId, course, onClose }: EditCourseDialogProps) {
  return (
    <Dialog open={course !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {course && <EditCourseForm courseId={courseId} course={course} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

// Mounted only while the dialog is open, so each opening starts from the course's current values.
function EditCourseForm({
  courseId,
  course,
  onClose,
}: {
  courseId: number
  course: { title: string; description: string | null }
  onClose: () => void
}) {
  const updateCourse = useUpdateCourse(courseId)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CourseValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: course.title, description: course.description ?? '' },
  })

  function onSubmit(values: CourseValues) {
    setFormError(null)
    updateCourse.mutate(toCourseRequest(values), {
      onSuccess: () => {
        toast.success('Course updated')
        onClose()
      },
      onError: (error) => showApiError(error, form, ['title', 'description'], setFormError, GENERIC_ERROR),
    })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit course</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <CourseFields control={form.control} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateCourse.isPending}>
              {updateCourse.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
