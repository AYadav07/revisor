/** "1 topic", "0 topics", "3 topics" — regular English plurals only. */
export function pluralize(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`
}
