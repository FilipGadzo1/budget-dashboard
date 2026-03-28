import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

import AppShell from '@/components/app/AppShell.vue'
import { useAuth } from '@/composables/useAuth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'projections', name: 'projections', component: () => import('@/views/ProjectionsView.vue') },
      { path: 'scenarios', name: 'scenarios', component: () => import('@/views/ScenariosView.vue') },
      { path: 'settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    ],
  },
  {
    path: '/budgets',
    redirect: '/',
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  if (to.meta.public) return true

  const { user, initialize } = useAuth()

  await initialize()

  if (!user.value) {
    return { name: 'login' }
  }

  return true
})

export default router
