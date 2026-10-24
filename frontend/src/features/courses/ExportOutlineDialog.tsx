import { Copy, Download } from 'lucide-react'
import { toast } from 'sonner'
import type { CourseTree } from '@/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { formatOutline } from './outline'

interface ExportOutlineDialogProps {
  course: CourseTree
  open: boolean
  onClose: () => void
}

/** "system-design.md": the title in lowercase words joined by dashes. */
export function outlineFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'course'}.md`
}

/** The course as an outline, to copy or download — and re-import later (UI_DESIGN.md §4). */
export function ExportOutlineDialog({ course, open, onClose }: ExportOutlineDialogProps) {
  const text = formatOutline(course)

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Outline copied'),
      () => toast.error("Couldn't copy. Select the text and copy it instead."),
    )
  }

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = outlineFileName(course.title)
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export outline</DialogTitle>
          <DialogDescription>
            The whole course in the outline format. Import it later as a new course, or bulk-add it to another one.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          readOnly
          value={text}
          aria-label="Outline"
          spellCheck={false}
          className="max-h-[60vh] min-h-60 font-mono text-sm md:text-sm"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={copy}>
            <Copy aria-hidden />
            Copy
          </Button>
          <Button type="button" onClick={download}>
            <Download aria-hidden />
            Download (.md)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
