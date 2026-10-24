import { ChevronDown, ChevronRight, TriangleAlert } from 'lucide-react'
import { useState, type ReactNode, type RefObject } from 'react'
import type { Control } from 'react-hook-form'
import type { OutlineConflictChoice } from '@/api'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { pluralize } from '@/lib/plural'
import type { OutlineFormValues } from './courseSchemas'
import {
  OUTLINE_EXAMPLE,
  type OutlineError,
  type OutlinePreview as Preview,
  type PreviewStatus,
  type PreviewSubtopic,
} from './outline'

/**
 * The pieces both outline pages are built from (UI_DESIGN.md §4 "Outline import, bulk add &
 * export"): the editor on one side, the live preview on the other.
 */

/** Puts the cursor at the start of `line` (1-based) and scrolls it into view. */
export function focusLine(textarea: HTMLTextAreaElement | null, line: number) {
  if (!textarea) return
  const lines = textarea.value.split('\n')
  const offset = lines.slice(0, line - 1).reduce((total, text) => total + text.length + 1, 0)
  textarea.focus()
  textarea.setSelectionRange(offset, offset + (lines[line - 1]?.length ?? 0))
}

interface OutlineEditorProps {
  control: Control<OutlineFormValues>
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /** Whether the outline is blank, which offers to insert the example. */
  empty: boolean
  onInsertExample: () => void
  /** Shown above the editor, e.g. the course title field on import. */
  children?: ReactNode
}

export function OutlineEditor({ control, textareaRef, empty, onInsertExample, children }: OutlineEditorProps) {
  const [helpOpen, setHelpOpen] = useState(false)

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Outline</CardTitle>
        <CardDescription>
          Unindented lines are topics, “- ” lines are subtopics, and lines indented under a subtopic are its notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        <FormField
          control={control}
          name="outline"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="sr-only">Outline</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  ref={(element) => {
                    field.ref(element)
                    textareaRef.current = element
                  }}
                  rows={18}
                  spellCheck={false}
                  placeholder={OUTLINE_EXAMPLE}
                  className="min-h-80 font-mono text-sm md:text-sm"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" aria-expanded={helpOpen} onClick={() => setHelpOpen(!helpOpen)}>
            {helpOpen ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
            Format help
          </Button>
          {empty && (
            <Button type="button" variant="outline" size="sm" onClick={onInsertExample}>
              Insert example
            </Button>
          )}
        </div>
        {helpOpen && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
            <pre className="overflow-x-auto font-mono text-xs text-foreground">{OUTLINE_EXAMPLE}</pre>
            <p>
              “# ” sets the course title and “&gt; ” lines its description (import only). Blank lines are ignored, except
              inside notes. A topic that already exists is added to, not duplicated.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Problems with the outline, each a link to its line. */
export function OutlineErrors({ errors, onSelectLine }: { errors: OutlineError[]; onSelectLine: (line: number) => void }) {
  if (errors.length === 0) return null
  return (
    <Alert variant="destructive">
      <TriangleAlert aria-hidden />
      <AlertTitle>Fix {errors.length === 1 ? 'this' : `these ${errors.length}`} before saving</AlertTitle>
      <AlertDescription>
        <ul className="space-y-1">
          {errors.map((error) => (
            <li key={`${error.line}:${error.message}`}>
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-left whitespace-normal text-destructive"
                onClick={() => onSelectLine(error.line)}
              >
                Line {error.line}: {error.message}
              </Button>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

const STATUS_BADGE: Record<PreviewStatus, ReactNode> = {
  new: <Badge>New</Badge>,
  existing: <Badge variant="outline">Existing</Badge>,
  conflict: <Badge variant="warning">Conflict</Badge>,
}

interface ConflictChoiceProps {
  subtopic: PreviewSubtopic
  choice: OutlineConflictChoice
  onChoose: (choice: OutlineConflictChoice) => void
}

/** Skip (the default) or overwrite one conflicting subtopic, with its current and new notes side by side. */
export function ConflictChoice({ subtopic, choice, onChoose }: ConflictChoiceProps) {
  const [comparing, setComparing] = useState(false)

  return (
    <div className="mt-1 space-y-2">
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={`Conflict for “${subtopic.title}”`}>
        {(['SKIP', 'OVERWRITE'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="xs"
            variant={choice === option ? 'default' : 'outline'}
            aria-pressed={choice === option}
            onClick={() => onChoose(option)}
          >
            {option === 'SKIP' ? 'Skip' : 'Overwrite'}
          </Button>
        ))}
        <Button type="button" size="xs" variant="ghost" aria-expanded={comparing} onClick={() => setComparing(!comparing)}>
          {comparing ? 'Hide notes' : 'Compare notes'}
        </Button>
      </div>
      {comparing && (
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['Current', subtopic.existingNotes ?? ''],
            ['From the outline', subtopic.notes],
          ].map(([label, notes]) => (
            <div key={label} className="rounded-md border p-2">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="text-xs whitespace-pre-wrap">{notes || '(none)'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface OutlinePreviewProps {
  preview: Preview
  /** Show New/Existing/Conflict per item — pointless on import, where everything is new. */
  showStatus: boolean
  choices?: Readonly<Record<string, OutlineConflictChoice>>
  onChoose?: (key: string, choice: OutlineConflictChoice) => void
  onChooseAll?: (choice: OutlineConflictChoice) => void
  /** Errors and notices, shown above the tree. */
  children?: ReactNode
}

export function OutlinePreview({ preview, showStatus, choices = {}, onChoose, onChooseAll, children }: OutlinePreviewProps) {
  const { counts } = preview
  const summary = [
    pluralize(counts.newTopics, showStatus ? 'new topic' : 'topic'),
    pluralize(counts.newSubtopics, showStatus ? 'new subtopic' : 'subtopic'),
    ...(counts.unchanged > 0 ? [`${counts.unchanged} already there`] : []),
    ...(counts.conflicts > 0 ? [pluralize(counts.conflicts, 'conflict')] : []),
  ].join(', ')

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Preview</CardTitle>
        <CardDescription aria-live="polite">{preview.topics.length > 0 ? summary : 'Nothing to add yet.'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
        {counts.conflicts > 0 && onChooseAll && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden />
            <AlertTitle>
              {counts.conflicts === 1 ? 'A subtopic already exists' : `${counts.conflicts} subtopics already exist`} with
              different notes
            </AlertTitle>
            <AlertDescription>
              <p>Skip keeps the current notes; Overwrite replaces them. Learning progress is kept either way.</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onChooseAll('OVERWRITE')}>
                  Overwrite all
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => onChooseAll('SKIP')}>
                  Skip all
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        <ul className="space-y-4" aria-label="Outline preview">
          {preview.topics.map((topic) => (
            <li key={topic.line}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{topic.title}</span>
                {showStatus && STATUS_BADGE[topic.status]}
              </div>
              {topic.subtopics.length > 0 && (
                <ul className="mt-2 space-y-2 border-l pl-4">
                  {topic.subtopics.map((subtopic) => (
                    <li key={subtopic.key}>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">{subtopic.title}</span>
                        {showStatus && STATUS_BADGE[subtopic.status]}
                      </div>
                      {subtopic.notes && subtopic.status !== 'conflict' && (
                        <p className="line-clamp-2 text-xs whitespace-pre-wrap text-muted-foreground">{subtopic.notes}</p>
                      )}
                      {subtopic.status === 'conflict' && onChoose && (
                        <ConflictChoice
                          subtopic={subtopic}
                          choice={choices[subtopic.key] ?? 'SKIP'}
                          onChoose={(choice) => onChoose(subtopic.key, choice)}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
