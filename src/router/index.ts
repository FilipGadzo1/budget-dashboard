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
    path: '/invite/:token',
    name: 'invite',
    component: () => import('@/views/InviteView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: AppShell,
    children: [
      { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue') },
      { path: 'plan', name: 'plan', component: () => import('@/views/PlanView.vue') },
      { path: 'forecast', name: 'forecast', component: () => import('@/views/ForecastView.vue') },
      // Projections was split into Plan (the inputs) and Forecast (the table)
      { path: 'projections', redirect: '/plan' },
      { path: 'scenarios', name: 'scenarios', component: () => import('@/views/ScenariosView.vue') },
      { path: 'savings', name: 'savings', component: () => import('@/views/SavingsView.vue') },
      { path: 'collaboration', name: 'collaboration', component: () => import('@/views/CollaborationView.vue') },
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
