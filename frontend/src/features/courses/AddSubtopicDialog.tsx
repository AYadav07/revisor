import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
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
import { subtopicSchema, toSubtopicRequest, type SubtopicValues } from './courseSchemas'
import { SubtopicFields } from './formFields'
import { useCreateSubtopic } from './useCourseTree'

interface AddSubtopicDialogProps {
  courseId: number
  /** The topic being added to; the dialog is open exactly when this is set. */
  topic: { id: number; title: string } | null
  onClose: () => void
}

const GENERIC_ERROR = "Couldn't add the subtopic. Please try again."

export function AddSubtopicDialog({ courseId, topic, onClose }: AddSubtopicDialogProps) {
  const createSubtopic = useCreateSubtopic(courseId)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<SubtopicValues>({
    resolver: zodResolver(subtopicSchema),
    defaultValues: { title: '', notes: '' },
  })

  // Every way of closing starts the next opening from scratch.
  function close() {
    form.reset()
    setFormError(null)
    onClose()
  }

  function onSubmit(values: SubtopicValues) {
    if (!topic) return
    setFormError(null)
    createSubtopic.mutate(
      { topicId: topic.id, request: toSubtopicRequest(values) },
      {
        onSuccess: close,
        onError: (error) => showApiError(error, form, ['title', 'notes'], setFormError, GENERIC_ERROR),
      },
    )
  }

  return (
    <Dialog open={topic !== null} onOpenChange={(open) => !open && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subtopic{topic ? ` to ${topic.title}` : ''}</DialogTitle>
          <DialogDescription>
            A subtopic is one thing to learn and then revise, like “L4 vs L7 load balancing”.
          </DialogDescription>
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
              <Button type="button" variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" disabled={createSubtopic.isPending}>
                {createSubtopic.isPending ? 'Adding…' : 'Add subtopic'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
