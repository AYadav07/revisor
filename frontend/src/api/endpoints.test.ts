import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { adminApi, authApi, courseApi, dashboardApi, reviewApi } from '.'

/**
 * Each API function's HTTP method, path, query and body, pinned against API.md. These wrappers
 * are one-liners, which is exactly why a typo'd path would otherwise go unnoticed until that
 * screen is built.
 */

const BASE = 'http://localhost:8080/api/v1'
const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => vi.unstubAllGlobals())

interface Case {
  name: string
  call: () => Promise<unknown>
  method: string
  path: string
  body?: unknown
}

const cases: Case[] = [
  // auth
  {
    name: 'authApi.signup',
    call: () => authApi.signup({ name: 'Ann', email: 'a@x.co', password: 'correct-horse', timezone: 'UTC' }),
    method: 'POST',
    path: '/auth/signup',
    body: { name: 'Ann', email: 'a@x.co', password: 'correct-horse', timezone: 'UTC' },
  },
  {
    name: 'authApi.login',
    call: () => authApi.login({ email: 'a@x.co', password: 'pw' }),
    method: 'POST',
    path: '/auth/login',
    body: { email: 'a@x.co', password: 'pw' },
  },
  { name: 'authApi.refresh', call: () => authApi.refresh(), method: 'POST', path: '/auth/refresh' },
  { name: 'authApi.logout', call: () => authApi.logout(), method: 'POST', path: '/auth/logout' },

  // courses
  { name: 'courseApi.listCourses', call: () => courseApi.listCourses(), method: 'GET', path: '/courses' },
  {
    name: 'courseApi.listCourses (paged)',
    call: () => courseApi.listCourses({ page: 2, size: 50 }),
    method: 'GET',
    path: '/courses?page=2&size=50',
  },
  { name: 'courseApi.getCourse', call: () => courseApi.getCourse(7), method: 'GET', path: '/courses/7' },
  {
    name: 'courseApi.createCourse',
    call: () => courseApi.createCourse({ title: 'DSA', description: 'd' }),
    method: 'POST',
    path: '/courses',
    body: { title: 'DSA', description: 'd' },
  },
  {
    name: 'courseApi.updateCourse',
    call: () => courseApi.updateCourse(7, { title: 'DSA 2' }),
    method: 'PUT',
    path: '/courses/7',
    body: { title: 'DSA 2' },
  },
  { name: 'courseApi.deleteCourse', call: () => courseApi.deleteCourse(7), method: 'DELETE', path: '/courses/7' },

  // topics
  {
    name: 'courseApi.createTopic',
    call: () => courseApi.createTopic(7, { title: 'Graphs', orderIndex: 1 }),
    method: 'POST',
    path: '/courses/7/topics',
    body: { title: 'Graphs', orderIndex: 1 },
  },
  { name: 'courseApi.getTopic', call: () => courseApi.getTopic(3), method: 'GET', path: '/topics/3' },
  {
    name: 'courseApi.updateTopic',
    call: () => courseApi.updateTopic(3, { title: 'Trees', orderIndex: 0 }),
    method: 'PUT',
    path: '/topics/3',
    body: { title: 'Trees', orderIndex: 0 },
  },
  { name: 'courseApi.deleteTopic', call: () => courseApi.deleteTopic(3), method: 'DELETE', path: '/topics/3' },

  // subtopics
  {
    name: 'courseApi.createSubtopic',
    call: () => courseApi.createSubtopic(3, { title: 'BFS', notes: 'queue' }),
    method: 'POST',
    path: '/topics/3/subtopics',
    body: { title: 'BFS', notes: 'queue' },
  },
  { name: 'courseApi.getSubtopic', call: () => courseApi.getSubtopic(9), method: 'GET', path: '/subtopics/9' },
  {
    name: 'courseApi.updateSubtopic',
    call: () => courseApi.updateSubtopic(9, { title: 'DFS' }),
    method: 'PUT',
    path: '/subtopics/9',
    body: { title: 'DFS' },
  },
  { name: 'courseApi.deleteSubtopic', call: () => courseApi.deleteSubtopic(9), method: 'DELETE', path: '/subtopics/9' },

  // review
  { name: 'reviewApi.learn', call: () => reviewApi.learn(9), method: 'POST', path: '/subtopics/9/learn' },
  {
    name: 'reviewApi.review',
    call: () => reviewApi.review(9, 4),
    method: 'POST',
    path: '/subtopics/9/review',
    body: { quality: 4 },
  },

  // dashboard
  { name: 'dashboardApi.due', call: () => dashboardApi.due(), method: 'GET', path: '/dashboard/due' },
  {
    name: 'dashboardApi.due (week, paged)',
    call: () => dashboardApi.due({ range: 'week', page: 1, size: 10 }),
    method: 'GET',
    path: '/dashboard/due?range=week&page=1&size=10',
  },
  { name: 'dashboardApi.progress', call: () => dashboardApi.progress(), method: 'GET', path: '/dashboard/progress' },
  { name: 'dashboardApi.summary', call: () => dashboardApi.summary(), method: 'GET', path: '/dashboard/summary' },

  // admin
  { name: 'adminApi.listUsers', call: () => adminApi.listUsers(), method: 'GET', path: '/admin/users' },
  {
    name: 'adminApi.listUsers (search)',
    call: () => adminApi.listUsers({ q: 'ann', page: 0, size: 20 }),
    method: 'GET',
    path: '/admin/users?q=ann&page=0&size=20',
  },
  {
    name: 'adminApi.setUserEnabled',
    call: () => adminApi.setUserEnabled(2, false),
    method: 'PATCH',
    path: '/admin/users/2',
    body: { enabled: false },
  },
  { name: 'adminApi.deleteUser', call: () => adminApi.deleteUser(2), method: 'DELETE', path: '/admin/users/2' },
  {
    name: 'adminApi.listUserCourses',
    call: () => adminApi.listUserCourses(2, { size: 5 }),
    method: 'GET',
    path: '/admin/users/2/courses?size=5',
  },
]

describe('endpoint contract (API.md)', () => {
  it.each(cases)('$name → $method $path', async ({ call, method, path, body }) => {
    await call()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${BASE}${path}`)
    expect(init?.method).toBe(method)
    expect(init?.body).toBe(body === undefined ? undefined : JSON.stringify(body))
  })
})
