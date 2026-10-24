import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { pluralize } from '@/lib/plural'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { courseDetailPath, ROUTES } from '@/routes'
import { importCourseSchema, type OutlineFormValues } from './courseSchemas'
import { OUTLINE_EXAMPLE, toOutlineTopics } from './outline'
import { OutlineEditor, OutlineErrors, OutlinePreview } from './OutlineWorkspace'
import { useOutlineForm } from './useOutlineForm'
import { useImportCourse, useUnsavedChangesWarning } from './useOutline'

const GENERIC_ERROR = "Couldn't import the course. Please try again."

/** A new course with its whole tree, from one outline (UI_DESIGN.md §4). */
export function ImportCoursePage() {
  useDocumentTitle('Import a course')
  const navigate = useNavigate()
  const importCourse = useImportCourse()
  const outline = useOutlineForm({ schema: importCourseSchema, course: null, withTitle: true, genericError: GENERIC_ERROR })
  const { form, parsed } = outline
  // The title follows the outline's "# " line until the user types their own.
  const [titleEdited, setTitleEdited] = useState(false)
  useUnsavedChangesWarning(outline.text.trim() !== '' && !importCourse.isSuccess)

  useEffect(() => {
    if (!titleEdited) form.setValue('title', parsed.title ?? '')
  }, [form, parsed.title, titleEdited])

  function onSubmit(values: OutlineFormValues) {
    const submitted = outline.current()
    if (!submitted) return
    outline.setFormError(null)
    importCourse.mutate(
      { title: values.title, description: submitted.description || null, topics: toOutlineTopics(submitted) },
      {
        onSuccess: (course) => {
          const subtopics = course.topics.reduce((total, topic) => total + topic.subtopics.length, 0)
          toast.success(
            `Imported “${course.title}” with ${pluralize(course.topics.length, 'topic')} and ${pluralize(subtopics, 'subtopic')}`,
          )
          navigate(courseDetailPath(course.id))
        },
        onError: (error) => outline.showServerError(error, submitted, values.outline),
      },
    )
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to={ROUTES.courses}>
          <ArrowLeft aria-hidden />
          All courses
        </Link>
      </Button>
      <PageHeader
        title="Import a course"
        description="Write or paste an outline: the course, its topics, subtopics and notes, all at once."
      />
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          {outline.formError && (
            <Alert variant="destructive">
              <AlertDescription>{outline.formError}</AlertDescription>
            </Alert>
          )}
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <OutlineEditor
              control={form.control}
              textareaRef={outline.textareaRef}
              empty={outline.text.trim() === ''}
              onInsertExample={() => outline.insertExample(OUTLINE_EXAMPLE)}
            >
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course title</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="off"
                        placeholder="Taken from the “# ” line"
                        {...field}
                        onChange={(event) => {
                          setTitleEdited(true)
                          field.onChange(event)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </OutlineEditor>
            <OutlinePreview preview={outline.preview} showStatus={false}>
              <OutlineErrors errors={outline.errors} onSelectLine={outline.selectLine} />
            </OutlinePreview>
          </div>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to={ROUTES.courses}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={!outline.canSave || importCourse.isPending}>
              {importCourse.isPending ? 'Importing…' : 'Import course'}
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}
