import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { showApiError } from '@/lib/formErrors'
import { courseSchema, toCourseRequest, type CourseValues } from './courseSchemas'
import { CourseFields } from './formFields'
import { useCreateCourse } from './useCourses'

interface CreateCourseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const GENERIC_ERROR = "Couldn't create the course. Please try again."

export function CreateCourseDialog({ open, onOpenChange }: CreateCourseDialogProps) {
  const createCourse = useCreateCourse()
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<CourseValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { title: '', description: '' },
  })

  // Every way of closing (Cancel, Escape, the overlay, success) starts the next opening from scratch.
  function handleOpenChange(next: boolean) {
    if (!next) {
      form.reset()
      setFormError(null)
    }
    onOpenChange(next)
  }

  function onSubmit(values: CourseValues) {
    setFormError(null)
    createCourse.mutate(toCourseRequest(values), {
      onSuccess: (course) => {
        toast.success(`Created “${course.title}”`)
        handleOpenChange(false)
      },
      onError: (error) => showApiError(error, form, ['title', 'description'], setFormError, GENERIC_ERROR),
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New course</DialogTitle>
          <DialogDescription>
            A course groups the topics you want to revise, like “System Design” or “Data Structures”.
          </DialogDescription>
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
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createCourse.isPending}>
                {createCourse.isPending ? 'Creating…' : 'Create course'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
