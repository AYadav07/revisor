import { zodResolver } from '@hookform/resolvers/zod'
import { Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { userSearchSchema, type UserSearchValues } from './adminSchemas'

interface UserSearchFormProps {
  /** The search currently applied ("" for none). */
  q: string
  onSearch: (q: string) => void
}

/**
 * Searches on submit, not as you type: each search is an audited admin action, and a request per
 * keystroke would fill the audit log with noise.
 */
export function UserSearchForm({ q, onSearch }: UserSearchFormProps) {
  const form = useForm<UserSearchValues>({ resolver: zodResolver(userSearchSchema), defaultValues: { q } })

  function clear() {
    form.reset({ q: '' })
    onSearch('')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onSearch(values.q))} noValidate className="mb-6 flex items-start gap-2">
        <FormField
          control={form.control}
          name="q"
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel className="sr-only">Search users</FormLabel>
              <FormControl>
                <Input type="search" placeholder="Search by name or email" autoComplete="off" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">
          <Search aria-hidden />
          Search
        </Button>
        {q && (
          <Button type="button" variant="outline" onClick={clear}>
            Clear
          </Button>
        )}
      </form>
    </Form>
  )
}
