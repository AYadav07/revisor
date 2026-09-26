import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContentLoading } from '@/components/ContentLoading'
import { EmptyState } from '@/components/EmptyState'
import { LoadError } from '@/components/LoadError'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { parseIdParam } from '@/lib/ids'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ROUTES } from '@/routes'
import { AddSubtopicDialog } from './AddSubtopicDialog'
import { AddTopicForm } from './AddTopicForm'
import { courseProgress, nextTopicOrderIndex, type TreeAction } from './courseTree'
import { DeleteCourseDialog, DeleteSubtopicDialog, DeleteTopicDialog } from './DeleteDialogs'
import { EditCourseDialog } from './EditCourseDialog'
import { EditSubtopicDialog } from './EditSubtopicDialog'
import { RenameTopicDialog } from './RenameTopicDialog'
import { TopicAccordion } from './TopicAccordion'
import { isCourseNotFound, useCourseTree } from './useCourseTree'

function BackToCourses() {
  return (
    <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
      <Link to={ROUTES.courses}>
        <ArrowLeft aria-hidden />
        All courses
      </Link>
    </Button>
  )
}

/** One course: its topics and subtopics, in one fetch, with the controls to grow and start them. */
export function CourseDetailPage() {
  const courseId = parseIdParam(useParams().id)
  const { data: tree, isPending, isError, error, refetch, isFetching } = useCourseTree(courseId)
  const [action, setAction] = useState<TreeAction | null>(null)
  const closeAction = () => setAction(null)
  const notFound = courseId === null || (isError && isCourseNotFound(error))
  useDocumentTitle(notFound ? 'Course not found' : tree?.title)

  // "Not a real id", "doesn't exist" and "belongs to someone else" all look the same on purpose:
  // the API answers 404 for both of the latter, and this page mustn't reveal which it was.
  if (notFound) {
    return (
      <>
        <BackToCourses />
        <EmptyState
          title="Course not found"
          description="It may have been deleted, or it isn't one of yours."
          action={
            <Button asChild>
              <Link to={ROUTES.courses}>Back to your courses</Link>
            </Button>
          }
        />
      </>
    )
  }

  return (
    <>
      <BackToCourses />

      {isPending && <ContentLoading label="Loading course" />}

      {isError && <LoadError message="Couldn't load this course." onRetry={() => refetch()} retrying={isFetching} />}

      {tree && (
        <>
          <PageHeader
            title={tree.title}
            description={tree.description}
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setAction({ type: 'editCourse' })}>
                  Edit course
                </Button>
                <Button variant="outline" size="sm" onClick={() => setAction({ type: 'deleteCourse' })}>
                  Delete course
                </Button>
              </div>
            }
          />
          <p className="mb-4 text-sm text-muted-foreground">
            {courseProgress(tree).learned} of {courseProgress(tree).total} subtopics learned
          </p>

          {tree.topics.length === 0 ? (
            <EmptyState title="No topics yet" description="Add your first topic below, then fill it with subtopics." />
          ) : (
            <TopicAccordion courseId={tree.id} topics={tree.topics} onAction={setAction} />
          )}

          <AddTopicForm courseId={tree.id} nextOrderIndex={nextTopicOrderIndex(tree.topics)} />
          <AddSubtopicDialog
            courseId={tree.id}
            topic={action?.type === 'addSubtopic' ? action.topic : null}
            onClose={closeAction}
          />
          <RenameTopicDialog
            courseId={tree.id}
            topic={action?.type === 'renameTopic' ? action.topic : null}
            onClose={closeAction}
          />
          <DeleteTopicDialog
            courseId={tree.id}
            topic={action?.type === 'deleteTopic' ? action.topic : null}
            onClose={closeAction}
          />
          <EditSubtopicDialog
            courseId={tree.id}
            subtopic={action?.type === 'editSubtopic' ? action.subtopic : null}
            onClose={closeAction}
          />
          <DeleteSubtopicDialog
            courseId={tree.id}
            subtopic={action?.type === 'deleteSubtopic' ? action.subtopic : null}
            onClose={closeAction}
          />
          <EditCourseDialog courseId={tree.id} course={action?.type === 'editCourse' ? tree : null} onClose={closeAction} />
          <DeleteCourseDialog course={tree} open={action?.type === 'deleteCourse'} onClose={closeAction} />
        </>
      )}
    </>
  )
}
