import type { CourseTree, OutlineConflictChoice, OutlineTopicRequest } from '@/api'

/**
 * The plain-text outline format for bulk import and export (ARCHITECTURE.md §9a). Pure functions,
 * no React: text → tree (with per-line errors), tree → text, and the preview/request helpers the
 * outline pages build on. The backend's `OutlineMerger` stays the authority on matching; the
 * preview here mirrors its rules so the user sees what will happen before saving.
 */

/** The API's limits (API.md §Bulk outline import), checked here so errors point at a line. */
export const OUTLINE_LIMITS = {
  title: 255,
  description: 2000,
  notes: 10000,
  topics: 100,
  subtopics: 1000,
} as const

export interface OutlineError {
  /** 1-based, as editors number lines. */
  line: number
  message: string
}

export interface OutlineSubtopic {
  title: string
  /** Empty when the outline gives none. */
  notes: string
  line: number
}

export interface OutlineTopic {
  title: string
  /** Where the topic first appears; a repeated topic is merged into its first occurrence. */
  line: number
  subtopics: OutlineSubtopic[]
}

export interface ParsedOutline {
  /** From the `# ` line, or null without one. */
  title: string | null
  titleLine: number | null
  /** From the `> ` lines; empty without any. */
  description: string
  topics: OutlineTopic[]
  errors: OutlineError[]
}

const TAB = '    '
const SUBTOPIC_INDENT = '  '
const NOTES_INDENT = '      '

/** Titles match trimmed and case-insensitively — the same rule as the backend. */
export function titleKey(title: string): string {
  return title.trim().toLowerCase()
}

function isSubtopicLine(trimmed: string): boolean {
  return trimmed === '-' || trimmed.startsWith('- ')
}

interface NotesDraft {
  lines: string[]
  /** Blank lines seen since the last note line: kept only if another note line follows. */
  pendingBlanks: number
}

/** Removes the note lines' common indentation; trailing blank lines are already excluded. */
function finishNotes(draft: NotesDraft): string {
  const indents = draft.lines.filter((line) => line.trim() !== '').map((line) => line.length - line.trimStart().length)
  const common = indents.length > 0 ? Math.min(...indents) : 0
  return draft.lines.map((line) => line.slice(common).trimEnd()).join('\n')
}

export function parseOutline(text: string): ParsedOutline {
  const result: ParsedOutline = { title: null, titleLine: null, description: '', topics: [], errors: [] }
  const descriptionLines: string[] = []
  const topicsByKey = new Map<string, OutlineTopic>()
  // Per topic: line number of each subtopic title key, to point a duplicate at the first one.
  const subtopicLines = new Map<OutlineTopic, Map<string, number>>()
  const notesBySubtopic = new Map<OutlineSubtopic, NotesDraft>()

  let topic: OutlineTopic | null = null
  // The subtopic whose notes indented lines belong to; a rejected (duplicate) subtopic still
  // collects its notes here, so they aren't misread as something else.
  let notes: NotesDraft | null = null
  let subtopicIndent: number | null = null
  let subtopicCount = 0

  const error = (line: number, message: string) => result.errors.push({ line, message })

  text.split(/\r?\n/).forEach((raw, index) => {
    const lineNumber = index + 1
    const line = raw.replaceAll('\t', TAB)
    const trimmed = line.trim()
    const indent = line.length - line.trimStart().length

    if (trimmed === '') {
      if (notes && notes.lines.length > 0) notes.pendingBlanks++
      return
    }

    if (notes && subtopicIndent !== null && indent > subtopicIndent) {
      for (; notes.pendingBlanks > 0; notes.pendingBlanks--) notes.lines.push('')
      notes.lines.push(line)
      return
    }
    notes = null

    if (isSubtopicLine(trimmed)) {
      if (!topic) {
        error(lineNumber, 'A subtopic needs a topic above it.')
        return
      }
      subtopicIndent ??= indent
      const title = trimmed.slice(1).trim()
      notes = { lines: [], pendingBlanks: 0 }
      if (title === '') {
        error(lineNumber, 'The subtopic has no title.')
        return
      }
      if (title.length > OUTLINE_LIMITS.title) {
        error(lineNumber, `The subtopic title is longer than ${OUTLINE_LIMITS.title} characters.`)
      }
      const seen = subtopicLines.get(topic)!
      const firstLine = seen.get(titleKey(title))
      if (firstLine !== undefined) {
        error(lineNumber, `“${title}” is already in this topic (line ${firstLine}).`)
        return
      }
      if (++subtopicCount > OUTLINE_LIMITS.subtopics) {
        error(lineNumber, `An outline can have at most ${OUTLINE_LIMITS.subtopics} subtopics.`)
      }
      seen.set(titleKey(title), lineNumber)
      const subtopic: OutlineSubtopic = { title, notes: '', line: lineNumber }
      topic.subtopics.push(subtopic)
      notesBySubtopic.set(subtopic, notes)
      return
    }

    if (indent > 0) {
      error(lineNumber, 'Start a subtopic with “- ”, or remove the indent to make this a topic.')
      return
    }

    if (trimmed.startsWith('#')) {
      if (result.topics.length > 0) {
        error(lineNumber, 'The course title (“# …”) must come before the first topic.')
      } else if (result.titleLine !== null) {
        error(lineNumber, `The course title is already set on line ${result.titleLine}.`)
      } else {
        result.title = trimmed.replace(/^#+/, '').trim()
        result.titleLine = lineNumber
        if (result.title === '') error(lineNumber, 'The course title is empty.')
        if (result.title.length > OUTLINE_LIMITS.title) {
          error(lineNumber, `The course title is longer than ${OUTLINE_LIMITS.title} characters.`)
        }
      }
      return
    }

    if (trimmed.startsWith('>')) {
      if (result.topics.length > 0) {
        error(lineNumber, 'The description (“> …”) must come before the first topic.')
      } else {
        descriptionLines.push(trimmed.slice(1).replace(/^ /, ''))
      }
      return
    }

    // A topic. A repeated title continues the earlier topic instead of starting a duplicate.
    subtopicIndent = null
    const existing = topicsByKey.get(titleKey(trimmed))
    if (existing) {
      topic = existing
      return
    }
    if (trimmed.length > OUTLINE_LIMITS.title) {
      error(lineNumber, `The topic title is longer than ${OUTLINE_LIMITS.title} characters.`)
    }
    if (result.topics.length === OUTLINE_LIMITS.topics) {
      error(lineNumber, `An outline can have at most ${OUTLINE_LIMITS.topics} topics.`)
    }
    topic = { title: trimmed, line: lineNumber, subtopics: [] }
    topicsByKey.set(titleKey(trimmed), topic)
    subtopicLines.set(topic, new Map())
    result.topics.push(topic)
  })

  for (const [subtopic, draft] of notesBySubtopic) {
    subtopic.notes = finishNotes(draft)
    if (subtopic.notes.length > OUTLINE_LIMITS.notes) {
      error(subtopic.line, `The notes are longer than ${OUTLINE_LIMITS.notes} characters.`)
    }
  }
  result.description = descriptionLines.join('\n').trim()
  if (result.description.length > OUTLINE_LIMITS.description) {
    error(result.titleLine ?? 1, `The description is longer than ${OUTLINE_LIMITS.description} characters.`)
  }
  result.errors.sort((a, b) => a.line - b.line)
  return result
}

/** What {@link formatOutline} needs — a `CourseTree` fits, as does a parsed outline. */
export interface OutlineSource {
  title?: string | null
  description?: string | null
  topics: { title: string; subtopics: { title: string; notes: string | null }[] }[]
}

/**
 * Writes a course as an outline. `parseOutline(formatOutline(x))` gives `x` back for any course
 * whose titles don't themselves start with `#`, `>` or `- `.
 */
export function formatOutline(course: OutlineSource): string {
  const header: string[] = []
  if (course.title) header.push(`# ${course.title}`)
  const description = (course.description ?? '').replace(/\r\n/g, '\n').trim()
  if (description !== '') {
    for (const line of description.split('\n')) header.push(line === '' ? '>' : `> ${line}`)
  }

  const blocks = course.topics.map((topic) => {
    const lines = [topic.title]
    for (const subtopic of topic.subtopics) {
      lines.push(`${SUBTOPIC_INDENT}- ${subtopic.title}`)
      const notes = (subtopic.notes ?? '').replace(/\r\n/g, '\n').replace(/^\s*\n|\s+$/g, '')
      if (notes !== '') {
        for (const line of notes.split('\n')) lines.push(line.trim() === '' ? '' : `${NOTES_INDENT}${line}`)
      }
    }
    return lines.join('\n')
  })

  return [...(header.length > 0 ? [header.join('\n')] : []), ...blocks].join('\n\n') + '\n'
}

export const OUTLINE_EXAMPLE = `# System Design
> Prep for HLD rounds

Caching
  - Cache-aside vs write-through
  - Eviction policies
      LRU, LFU, TTL trade-offs

Databases
  - Indexing
  - Sharding
`

// ---- Preview against an existing course (bulk add) ----------------------------------------------

export type PreviewStatus = 'new' | 'existing' | 'conflict'

/** Titles can't contain a line break, so it separates the two parts unambiguously. */
export function choiceKey(topicTitle: string, subtopicTitle: string): string {
  return `${titleKey(topicTitle)}\n${titleKey(subtopicTitle)}`
}

export interface PreviewSubtopic extends OutlineSubtopic {
  /** Id for conflict choices, from the topic and subtopic titles: survives edits elsewhere in the outline. */
  key: string
  status: PreviewStatus
  /** The current notes, for a subtopic that already exists. */
  existingNotes: string | null
}

export interface PreviewTopic {
  /** The existing topic's title when merged (it keeps its title), else the outline's. */
  title: string
  line: number
  status: Exclude<PreviewStatus, 'conflict'>
  subtopics: PreviewSubtopic[]
}

export interface OutlinePreview {
  topics: PreviewTopic[]
  counts: { newTopics: number; newSubtopics: number; conflicts: number; unchanged: number }
}

/**
 * How the outline lands on `course` (null for a new course): mirrors the backend's rules
 * (API.md §Bulk outline import) — topics merge by title; an existing subtopic is left alone when
 * the outline brings no new notes, and is a conflict when its notes differ.
 */
export function previewOutline(parsed: ParsedOutline, course: CourseTree | null): OutlinePreview {
  const existingTopics = new Map<string, CourseTree['topics'][number]>()
  for (const topic of course?.topics ?? []) {
    if (!existingTopics.has(titleKey(topic.title))) existingTopics.set(titleKey(topic.title), topic)
  }
  const counts = { newTopics: 0, newSubtopics: 0, conflicts: 0, unchanged: 0 }

  const topics = parsed.topics.map((topic): PreviewTopic => {
    const match = existingTopics.get(titleKey(topic.title))
    const existingSubtopics = new Map<string, { notes: string | null }>()
    for (const subtopic of match?.subtopics ?? []) {
      if (!existingSubtopics.has(titleKey(subtopic.title))) existingSubtopics.set(titleKey(subtopic.title), subtopic)
    }
    if (!match) counts.newTopics++

    return {
      title: match?.title ?? topic.title,
      line: topic.line,
      status: match ? 'existing' : 'new',
      subtopics: topic.subtopics.map((subtopic): PreviewSubtopic => {
        const existing = existingSubtopics.get(titleKey(subtopic.title))
        let status: PreviewStatus = 'new'
        if (existing) {
          const unchanged = subtopic.notes.trim() === '' || subtopic.notes.trim() === (existing.notes ?? '').trim()
          status = unchanged ? 'existing' : 'conflict'
        }
        counts[status === 'new' ? 'newSubtopics' : status === 'conflict' ? 'conflicts' : 'unchanged']++
        return {
          ...subtopic,
          key: choiceKey(topic.title, subtopic.title),
          status,
          existingNotes: existing ? existing.notes : null,
        }
      }),
    }
  })
  return { topics, counts }
}

/** The request body's topics. Conflicts not in `choices` are skipped, the safe default. */
export function toOutlineTopics(
  parsed: ParsedOutline,
  choices: Readonly<Record<string, OutlineConflictChoice>> = {},
): OutlineTopicRequest[] {
  return parsed.topics.map((topic) => ({
    title: topic.title,
    subtopics: topic.subtopics.map((subtopic) => ({
      title: subtopic.title,
      notes: subtopic.notes === '' ? null : subtopic.notes,
      onConflict: choices[choiceKey(topic.title, subtopic.title)] ?? 'SKIP',
    })),
  }))
}

/**
 * The outline line a server validation error is about: `topics[2].subtopics[0].title` → that
 * subtopic's line, `title` → the `# ` line. Null when it can't be placed.
 */
export function lineForField(parsed: ParsedOutline, field: string): number | null {
  const match = /^topics\[(\d+)\](?:\.subtopics\[(\d+)\])?/.exec(field)
  if (!match) return field === 'title' || field === 'description' ? parsed.titleLine : null
  const topic = parsed.topics[Number(match[1])]
  if (!topic) return null
  if (match[2] === undefined) return topic.line
  return topic.subtopics[Number(match[2])]?.line ?? topic.line
}
