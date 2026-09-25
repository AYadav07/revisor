import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { showApiError } from '@/lib/formErrors'
import { topicSchema, type TopicValues } from './courseSchemas'
import { useCreateTopic } from './useCourseTree'

interface AddTopicFormProps {
  courseId: number
  /** Position for the new topic: after all the existing ones. */
  nextOrderIndex: number
}

const GENERIC_ERROR = "Couldn't add the topic. Please try again."

/** A one-line form at the foot of the tree for adding a topic (UI_DESIGN.md §4). */
export function AddTopicForm({ courseId, nextOrderIndex }: AddTopicFormProps) {
  const createTopic = useCreateTopic(courseId)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<TopicValues>({ resolver: zodResolver(topicSchema), defaultValues: { title: '' } })

  function onSubmit(values: TopicValues) {
    setFormError(null)
    createTopic.mutate(
      { title: values.title, orderIndex: nextOrderIndex },
      {
        onSuccess: () => {
          // Not form.reset(): that empties RHF's field registry, so the focus call would find nothing.
          form.resetField('title')
          form.setFocus('title') // ready for the next one
        },
        onError: (error) => showApiError(error, form, ['title'], setFormError, GENERIC_ERROR),
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mt-6 space-y-2">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-start gap-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel className="sr-only">New topic title</FormLabel>
                <FormControl>
                  <Input placeholder="New topic title" autoComplete="off" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" disabled={createTopic.isPending}>
            {createTopic.isPending ? 'Adding…' : 'Add topic'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
