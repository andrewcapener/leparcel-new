'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ADMIN_COOKIE } from '@/lib/adminAuth'

/**
 * Sign out. Clears the session cookie the proxy checks on every /admin
 * request (src/proxy.ts) and returns to the sign-in screen.
 *
 * The admin has always been a shared password with no way out of it short
 * of clearing cookies by hand, which is the wrong answer on the laptop that
 * sits on the load-in table. Auth is still interim: Supabase Auth with a
 * real account per member of staff replaces all of this after launch.
 */
export async function signOut() {
  const jar = await cookies()
  jar.delete(ADMIN_COOKIE)
  redirect('/admin/login')
}
