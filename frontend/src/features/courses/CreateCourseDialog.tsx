import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ApiError } from '@/api'
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { courseSchema, toCourseRequest, type CourseValues } from './courseSchemas'
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
      onError: (error) => {
        if (error instanceof ApiError && error.status === 400) {
          const { title, description } = error.fieldErrors
          if (title) form.setError('title', { type: 'server', message: title })
          if (description) form.setError('description', { type: 'server', message: description })
          if (!title && !description) setFormError(error.message)
        } else {
          setFormError(error instanceof ApiError && error.status === 0 ? error.message : GENERIC_ERROR)
        }
      },
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
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optional)</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
