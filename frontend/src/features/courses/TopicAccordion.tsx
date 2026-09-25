import { useState } from 'react'
import { toast } from 'sonner'
import type { TopicTreeNode } from '@/api'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { topicProgress, type TreeAction } from './courseTree'
import { SubtopicRow } from './SubtopicRow'
import { useLearnSubtopic } from './useCourseTree'

interface TopicAccordionProps {
  courseId: number
  topics: TopicTreeNode[]
  onAction: (action: TreeAction) => void
}

/** The course's topics as expandable sections, each listing its subtopics (UI_DESIGN.md §4). */
export function TopicAccordion({ courseId, topics, onAction }: TopicAccordionProps) {
  const learn = useLearnSubtopic(courseId)
  const learningId = learn.isPending ? learn.variables : null

  // Track what the user has *collapsed*, not what is open: every topic starts expanded, and one added
  // later (which this state has never heard of) opens too, ready for its first subtopic.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set())
  const allIds = topics.map((topic) => String(topic.id))
  const open = allIds.filter((id) => !collapsed.has(id))

  function handleLearn(subtopicId: number) {
    learn.mutate(subtopicId, {
      onError: () => toast.error("Couldn't mark it as learned. Please try again."),
    })
  }

  return (
    <Accordion
      type="multiple"
      value={open}
      onValueChange={(next) => setCollapsed(new Set(allIds.filter((id) => !next.includes(id))))}
    >
      {topics.map((topic) => {
        const { learned, total } = topicProgress(topic)
        return (
          <AccordionItem key={topic.id} value={String(topic.id)}>
            <AccordionTrigger>
              <span className="flex-1 truncate text-left">{topic.title}</span>
              <span className="text-sm font-normal text-muted-foreground">
                {learned}/{total} learned
              </span>
            </AccordionTrigger>
            <AccordionContent>
              {topic.subtopics.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">No subtopics yet.</p>
              ) : (
                <ul className="divide-y">
                  {topic.subtopics.map((subtopic) => (
                    <SubtopicRow
                      key={subtopic.id}
                      subtopic={subtopic}
                      onLearn={handleLearn}
                      onEdit={(sub) => onAction({ type: 'editSubtopic', subtopic: sub })}
                      onDelete={(sub) => onAction({ type: 'deleteSubtopic', subtopic: sub })}
                      learning={learningId === subtopic.id}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => onAction({ type: 'addSubtopic', topic })}>
                  Add subtopic
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAction({ type: 'renameTopic', topic })}>
                  Rename topic
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onAction({ type: 'deleteTopic', topic })}>
                  Delete topic
                </Button>
              </div>
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
