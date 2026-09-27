import { CourseAvatar } from '@/components/CourseAvatar'
import { ArrowLeft, ListTree, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ContentLoading } from '@/components/ContentLoading'
import { EmptyState } from '@/components/EmptyState'
import { HERO_BUTTON, HeroHeader } from '@/components/HeroHeader'
import { LoadError } from '@/components/LoadError'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { parseIdParam } from '@/lib/ids'
import { useDocumentTitle } from '@/lib/useDocumentTitle'
import { ROUTES } from '@/routes'
import { AddSubtopicDialog } from './AddSubtopicDialog'
import { AddTopicForm } from './AddTopicForm'
import { nextTopicOrderIndex, type TreeAction } from './courseTree'
import { CourseSummary } from './CourseSummary'
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
          <HeroHeader
            leading={<CourseAvatar title={tree.title} size="lg" className="bg-white/15 text-white" />}
            title={tree.title}
            description={tree.description}
            actions={
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className={HERO_BUTTON} onClick={() => setAction({ type: 'editCourse' })}>
                  <Pencil aria-hidden />
                  Edit course
                </Button>
                <Button variant="outline" size="sm" className={HERO_BUTTON} onClick={() => setAction({ type: 'deleteCourse' })}>
                  <Trash2 aria-hidden />
                  Delete course
                </Button>
              </div>
            }
          />
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2">
              {tree.topics.length === 0 ? (
                <EmptyState icon={ListTree} title="No topics yet" description="Add your first topic, then fill it with subtopics." />
              ) : (
                <TopicAccordion courseId={tree.id} topics={tree.topics} onAction={setAction} />
              )}
            </div>

            {/* After the topics on small screens; the right-hand column on wide ones. */}
            <aside className="space-y-4">
              <CourseSummary tree={tree} />
              <Card className="gap-4">
                <CardHeader>
                  <CardTitle>Add a topic</CardTitle>
                </CardHeader>
                <CardContent>
                  <AddTopicForm courseId={tree.id} nextOrderIndex={nextTopicOrderIndex(tree.topics)} />
                </CardContent>
              </Card>
            </aside>
          </div>

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
