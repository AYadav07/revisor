import type { CourseTree, SubtopicTreeNode, TopicTreeNode } from '@/api'

export interface Progress {
  learned: number
  total: number
}

export function topicProgress(topic: TopicTreeNode): Progress {
  return {
    learned: topic.subtopics.filter((subtopic) => subtopic.learned).length,
    total: topic.subtopics.length,
  }
}

export function courseProgress(tree: CourseTree): Progress {
  return tree.topics.map(topicProgress).reduce(
    (sum, topic) => ({ learned: sum.learned + topic.learned, total: sum.total + topic.total }),
    { learned: 0, total: 0 },
  )
}

/**
 * Where a new topic goes: after every existing one. Uses the highest index rather than the count,
 * because deleting a topic leaves a gap and a count would then collide with a surviving index.
 */
export function nextTopicOrderIndex(topics: readonly TopicTreeNode[]): number {
  return topics.reduce((highest, topic) => Math.max(highest, topic.orderIndex), -1) + 1
}

/** Every dialog the course page can open, each carrying what it acts on. At most one is open at a time. */
export type TreeAction =
  | { type: 'editCourse' }
  | { type: 'deleteCourse' }
  | { type: 'addSubtopic'; topic: TopicTreeNode }
  | { type: 'renameTopic'; topic: TopicTreeNode }
  | { type: 'deleteTopic'; topic: TopicTreeNode }
  | { type: 'editSubtopic'; subtopic: SubtopicTreeNode }
  | { type: 'deleteSubtopic'; subtopic: SubtopicTreeNode }
