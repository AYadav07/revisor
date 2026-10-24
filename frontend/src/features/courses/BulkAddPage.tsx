import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { CourseTree, OutlineConflictChoice, OutlineResult } from '@/api'
import { ContentLoading } from '@/components/ContentLoading'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { parseIdParam } from '@/lib/ids'
import { pluralize } from '@/lib/plural'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { courseDetailPath, ROUTES } from '@/routes'
import { bulkAddSchema } from './courseSchemas'
import { OUTLINE_EXAMPLE, toOutlineTopics } from './outline'
import { OutlineEditor, OutlineErrors, OutlinePreview } from './OutlineWorkspace'
import { isCourseNotFound, useCourseTree } from './useCourseTree'
import { useApplyOutline, useUnsavedChangesWarning } from './useOutline'
import { useOutlineForm } from './useOutlineForm'

const GENERIC_ERROR = "Couldn't add the outline. Please try again."

/** "Added 3 topics and 24 subtopics, updated 1, skipped 2" — the server's own counts. */
export function describeOutlineResult(result: OutlineResult): string {
  const added = `Added ${pluralize(result.topicsCreated, 'topic')} and ${pluralize(result.subtopicsCreated, 'subtopic')}`
  return [
    added,
    ...(result.subtopicsUpdated > 0 ? [`updated ${result.subtopicsUpdated}`] : []),
    ...(result.subtopicsSkipped > 0 ? [`skipped ${result.subtopicsSkipped}`] : []),
  ].join(', ')
}

/** Topics and subtopics added to an existing course from an outline (UI_DESIGN.md §4). */
export function BulkAddPage() {
  const courseId = parseIdParam(useParams().id)
  const { data: tree, isPending, isError, error, refetch, isFetching } = useCourseTree(courseId)
  const notFound = courseId === null || (isError && isCourseNotFound(error))
  useDocumentTitle(notFound ? 'Course not found' : tree && `Bulk add · ${tree.title}`)

  if (notFound) {
    return (
      <EmptyState
        title="Course not found"
        description="It may have been deleted, or it isn't one of yours."
        action={
          <Button asChild>
            <Link to={ROUTES.courses}>Back to your courses</Link>
          </Button>
        }
      />
    )
  }
  if (isPending) return <ContentLoading label="Loading course" />
  if (isError || !tree) {
    return <LoadError message="Couldn't load this course." onRetry={() => refetch()} retrying={isFetching} />
  }
  return <BulkAddForm tree={tree} />
}

function BulkAddForm({ tree }: { tree: CourseTree }) {
  const navigate = useNavigate()
  const applyOutline = useApplyOutline(tree.id)
  const outline = useOutlineForm({ schema: bulkAddSchema, course: tree, withTitle: false, genericError: GENERIC_ERROR })
  const { form, parsed, preview } = outline
  const [choices, setChoices] = useState<Record<string, OutlineConflictChoice>>({})
  useUnsavedChangesWarning(outline.text.trim() !== '' && !applyOutline.isSuccess)

  function chooseAll(choice: OutlineConflictChoice) {
    const all: Record<string, OutlineConflictChoice> = {}
    for (const topic of preview.topics) {
      for (const subtopic of topic.subtopics) {
        if (subtopic.status === 'conflict') all[subtopic.key] = choice
      }
    }
    setChoices((current) => ({ ...current, ...all }))
  }

  function onSubmit() {
    const submitted = outline.current()
    if (!submitted) return
    const text = form.getValues('outline')
    outline.setFormError(null)
    applyOutline.mutate(
      { topics: toOutlineTopics(submitted, choices) },
      {
        onSuccess: (result) => {
          toast.success(describeOutlineResult(result))
          navigate(courseDetailPath(tree.id))
        },
        onError: (error) => outline.showServerError(error, submitted, text),
      },
    )
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
        <Link to={courseDetailPath(tree.id)}>
          <ArrowLeft aria-hidden />
          {tree.title}
        </Link>
      </Button>
      <PageHeader
        title="Bulk add"
        description={`Add topics and subtopics to “${tree.title}” from an outline. Topics that already exist are added to.`}
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
            />
            <OutlinePreview
              preview={preview}
              showStatus
              choices={choices}
              onChoose={(key, choice) => setChoices((current) => ({ ...current, [key]: choice }))}
              onChooseAll={chooseAll}
            >
              <OutlineErrors errors={outline.errors} onSelectLine={outline.selectLine} />
              {(parsed.title !== null || parsed.description !== '') && (
                <p className="text-sm text-muted-foreground">
                  The course title (“# ”) and description (“&gt; ”) lines are ignored when adding to a course.
                </p>
              )}
            </OutlinePreview>
          </div>
          <div className="flex justify-end gap-2">
            <Button asChild variant="outline">
              <Link to={courseDetailPath(tree.id)}>Cancel</Link>
            </Button>
            <Button type="submit" disabled={!outline.canSave || applyOutline.isPending}>
              {applyOutline.isPending ? 'Adding…' : 'Add to course'}
            </Button>
          </div>
        </form>
      </Form>
    </>
  )
}
