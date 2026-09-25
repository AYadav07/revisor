import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { showApiError } from '@/lib/formErrors'
import { topicSchema, type TopicValues } from './courseSchemas'
import { useUpdateTopic } from './useCourseTree'

interface Topic {
  id: number
  title: string
  orderIndex: number
}

interface RenameTopicDialogProps {
  courseId: number
  /** The topic being renamed; the dialog is open exactly when this is set. */
  topic: Topic | null
  onClose: () => void
}

const GENERIC_ERROR = "Couldn't rename the topic. Please try again."

export function RenameTopicDialog({ courseId, topic, onClose }: RenameTopicDialogProps) {
  return (
    <Dialog open={topic !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent aria-describedby={undefined}>{topic && <RenameTopicForm courseId={courseId} topic={topic} onClose={onClose} />}</DialogContent>
    </Dialog>
  )
}

function RenameTopicForm({ courseId, topic, onClose }: { courseId: number; topic: Topic; onClose: () => void }) {
  const updateTopic = useUpdateTopic(courseId)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<TopicValues>({ resolver: zodResolver(topicSchema), defaultValues: { title: topic.title } })

  function onSubmit(values: TopicValues) {
    setFormError(null)
    // The API replaces the whole topic, so its position is sent back unchanged.
    updateTopic.mutate(
      { topicId: topic.id, request: { title: values.title, orderIndex: topic.orderIndex } },
      {
        onSuccess: () => {
          toast.success('Topic renamed')
          onClose()
        },
        onError: (error) => showApiError(error, form, ['title'], setFormError, GENERIC_ERROR),
      },
    )
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Rename topic</DialogTitle>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTopic.isPending}>
              {updateTopic.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  )
}
