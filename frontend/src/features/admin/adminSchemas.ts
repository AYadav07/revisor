import { z } from 'zod'

/** The user search box. Blank means "everyone". */
export const userSearchSchema = z.object({
  q: z.string().trim().max(100, 'Search must be at most 100 characters'),
})

export type UserSearchValues = z.infer<typeof userSearchSchema>
