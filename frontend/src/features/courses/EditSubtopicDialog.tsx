import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { showApiError } from '@/lib/formErrors'
import { subtopicSchema, toSubtopicRequest, type SubtopicValues } from './courseSchemas'
import { SubtopicFields } from './formFields'
import { useUpdateSubtopic } from './useCourseTree'

interface Subtopic {
  id: number
  title: string
  notes: string | null
}

interface EditSubtopicDialogProps {
  courseId: number
  /** The subtopic being edited; the dialog is open exactly when this is set. */
  subtopic: Subtopic | null
  onClose: () => void
}

const GENERIC_ERROR = "Couldn't save the subtopic. Please try again."

export function EditSubtopicDialog({ courseId, subtopic, onClose }: EditSubtopicDialogProps) {
  return (
    <Dialog open={subtopic !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>
        {subtopic && <EditSubtopicForm courseId={courseId} subtopic={subtopic} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditSubtopicForm({ courseId, subtopic, onClose }: { courseId: number; subtopic: Subtopic; onClose: () => void }) {
  const updateSubtopic = useUpdateSubtopic(courseId)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SubtopicValues>({
    resolver: zodResolver(subtopicSchema),
    defaultValues: { title: subtopic.title, notes: subtopic.notes ?? '' },
  })

  function onSubmit(values: SubtopicValues) {
    setFormError(null)
    updateSubtopic.mutate(
      { subtopicId: subtopic.id, request: toSubtopicRequest(values) },
      {
        onSuccess: () => {
          toast.success('Subtopic updated')
          onClose()
        },
        onError: (error) => showApiError(error, form, ['title', 'notes'], setFormError, GENERIC_ERROR),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit subtopic</DialogTitle>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-4">
          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <SubtopicFields control={form.control} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateSubtopic.isPending}>
              {updateSubtopic.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
