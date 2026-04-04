<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useCollaborationStore } from '@/stores/collaboration'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const router = useRouter()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { user, signOut } = useAuth()
const sidebarOpen = ref(false)
const avatarMenuOpen = ref(false)

const pageTitle = computed(() => {
  const match = navItems.find((item) =>
    item.path === '/' ? route.path === '/' : route.path.startsWith(item.path)
  )
  return match?.label ?? 'Budget'
})

const navItems = [
  { path: '/', icon: 'pi pi-objects-column', label: 'Dashboard' },
  { path: '/projections', icon: 'pi pi-calculator', label: 'Projections' },
  { path: '/savings', icon: 'pi pi-wallet', label: 'Savings' },
  { path: '/scenarios', icon: 'pi pi-bookmark', label: 'Scenarios' },
  { path: '/collaboration', icon: 'pi pi-users', label: 'Collab' },
  { path: '/settings', icon: 'pi pi-cog', label: 'Settings' },
]

const mobileTabItems = navItems.filter((item) => item.path !== '/settings')

const onlineOthers = computed(() =>
  collabStore.onlineUsers.filter((u) => u.userId !== user.value?.id),
)

const toggleSidebar = (): void => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = (): void => {
  sidebarOpen.value = false
}

const toggleAvatarMenu = (): void => {
  avatarMenuOpen.value = !avatarMenuOpen.value
}

const closeAvatarMenu = (): void => {
  avatarMenuOpen.value = false
}

const goToSettings = (): void => {
  avatarMenuOpen.value = false
  router.push('/settings')
}

const handleSignOut = async (): Promise<void> => {
  avatarMenuOpen.value = false
  await signOut()
}

const exitContext = async (): Promise<void> => {
  await collabStore.exitContext()
}
</script>

<template>
  <!-- Mobile top bar -->
  <header class="mobile-topbar">
    <div class="mobile-topbar-brand">
      <div class="mobile-topbar-logo">B</div>
      <span class="mobile-topbar-title">{{ pageTitle }}</span>
    </div>
    <div class="mobile-topbar-actions">
      <button class="mobile-topbar-btn" @click="uiStore.toggleTheme()">
        <i :class="uiStore.themeMode === 'dark' ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <div class="mobile-avatar-wrap">
        <button class="mobile-topbar-avatar" :class="{ 'mobile-topbar-avatar-active': avatarMenuOpen }" @click.stop="toggleAvatarMenu">
          <img
            v-if="user?.user_metadata?.avatar_url"
            :src="user.user_metadata.avatar_url"
            class="mobile-topbar-avatar-img"
            alt="Profile"
          />
          <span v-else class="mobile-topbar-avatar-initials">
            {{ (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase() }}
          </span>
          <!-- Online indicator dot -->
          <span v-if="onlineOthers.length > 0" class="mobile-avatar-online-dot" />
        </button>

        <!-- Avatar dropdown -->
        <Transition name="avatar-menu">
          <div v-if="avatarMenuOpen" class="avatar-menu" @click.stop>
            <!-- Online collaborators -->
            <div v-if="onlineOthers.length > 0" class="avatar-menu-online-section">
              <p class="avatar-menu-section-label">Online now</p>
              <div
                v-for="u in onlineOthers"
                :key="u.userId"
                class="avatar-menu-online-row"
              >
                <div class="avatar-menu-online-avatar">
                  <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.userName" />
                  <span v-else>{{ (u.userName || u.userEmail || '?').charAt(0).toUpperCase() }}</span>
                  <span class="avatar-menu-online-badge" />
                </div>
                <span class="avatar-menu-online-name">{{ u.userName || u.userEmail }}</span>
              </div>
              <div class="avatar-menu-divider" />
            </div>

            <!-- User info -->
            <div v-if="user" class="avatar-menu-user">
              <p class="avatar-menu-user-name">{{ user.user_metadata?.full_name || user.email }}</p>
              <p class="avatar-menu-user-email">{{ user.email }}</p>
            </div>
            <div class="avatar-menu-divider" />

            <!-- Actions -->
            <button class="avatar-menu-item" @click="goToSettings">
              <i class="pi pi-cog" />
              Settings
            </button>
            <button class="avatar-menu-item avatar-menu-item-danger" @click="handleSignOut">
              <i class="pi pi-sign-out" />
              Sign out
            </button>
          </div>
        </Transition>
      </div>
    </div>
  </header>

  <!-- Avatar menu backdrop -->
  <div v-if="avatarMenuOpen" class="avatar-menu-backdrop" @click="closeAvatarMenu" />

  <!-- Sidebar overlay (mobile) -->
  <div
    class="sidebar-overlay"
    :class="{ 'sidebar-overlay-visible': sidebarOpen }"
    @click="closeSidebar"
  />

  <!-- Sidebar -->
  <aside class="sidebar" :class="{ 'sidebar-open': sidebarOpen }">
    <div class="sidebar-brand">
      <div class="sidebar-logo">B</div>
      <div>
        <div class="sidebar-title">Budget Dashboard</div>
        <div class="sidebar-subtitle">Financial planning</div>
      </div>
    </div>

    <!-- Context banner in sidebar -->
    <div v-if="collabStore.isViewingSharedBudget && collabStore.activeBudgetContext" class="sidebar-context-banner">
      <div class="sidebar-context-info">
        <i
          class="pi text-xs"
          :class="collabStore.activeBudgetContext.role === 'editor' ? 'pi-pencil' : 'pi-eye'"
        />
        <span>
          {{ collabStore.activeBudgetContext.role === 'editor' ? 'Co-editing' : 'Viewing' }}
          <strong>{{ collabStore.activeBudgetContext.ownerName || collabStore.activeBudgetContext.ownerEmail }}</strong>
        </span>
      </div>
      <button class="sidebar-context-exit" @click="exitContext">Exit</button>
    </div>

    <nav class="sidebar-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="sidebar-link"
        :class="{ 'sidebar-link-active': route.path === item.path }"
        @click="closeSidebar"
      >
        <i :class="[item.icon, 'sidebar-link-icon']" />
        {{ item.label }}
        <span
          v-if="item.path === '/collaboration' && collabStore.pendingInvitesCount > 0"
          class="sidebar-badge"
        >
          {{ collabStore.pendingInvitesCount }}
        </span>
      </RouterLink>
    </nav>

    <!-- Online collaborators strip -->
    <div
      v-if="collabStore.onlineUsers.filter(u => u.userId !== user?.id).length > 0"
      class="sidebar-online"
    >
      <span class="sidebar-online-label">Online now</span>
      <div class="sidebar-online-avatars">
        <div
          v-for="onlineUser in collabStore.onlineUsers.filter(u => u.userId !== user?.id)"
          :key="onlineUser.userId"
          class="sidebar-online-avatar"
          :title="onlineUser.userName || onlineUser.userEmail"
        >
          <img v-if="onlineUser.avatarUrl" :src="onlineUser.avatarUrl" :alt="onlineUser.userName" />
          <span v-else>{{ (onlineUser.userName || onlineUser.userEmail).charAt(0).toUpperCase() }}</span>
          <span class="sidebar-online-dot" />
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <div v-if="user" class="sidebar-user">
        <img
          v-if="user.user_metadata?.avatar_url"
          :src="user.user_metadata.avatar_url"
          class="sidebar-user-avatar"
          :alt="user.user_metadata?.full_name || 'User avatar'"
        />
        <div class="sidebar-user-info">
          <p class="sidebar-user-name">{{ user.user_metadata?.full_name || user.email }}</p>
          <p class="sidebar-user-email">{{ user.email }}</p>
        </div>
      </div>
      <button class="sidebar-theme-toggle" @click="uiStore.toggleTheme()">
        <span>{{ uiStore.themeMode === 'dark' ? 'Light mode' : 'Dark mode' }}</span>
        <i :class="uiStore.themeMode === 'dark' ? 'pi pi-sun' : 'pi pi-moon'" class="sidebar-theme-icon" />
      </button>
      <button class="sidebar-theme-toggle" @click="signOut">
        <span>Sign out</span>
        <i class="pi pi-sign-out sidebar-theme-icon" />
      </button>
    </div>
  </aside>

  <!-- Mobile bottom tabs -->
  <nav class="mobile-tabs">
    <div class="mobile-tabs-inner">
      <RouterLink
        v-for="item in mobileTabItems"
        :key="item.path"
        :to="item.path"
        class="mobile-tab"
        :class="{ 'mobile-tab-active': route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path)) }"
        @click="closeSidebar"
      >
        <div class="mobile-tab-icon-wrap">
          <i :class="[item.icon, 'mobile-tab-icon']" />
          <span
            v-if="item.path === '/collaboration' && collabStore.pendingInvitesCount > 0"
            class="mobile-tab-badge"
          >
            {{ collabStore.pendingInvitesCount }}
          </span>
        </div>
      </RouterLink>
    </div>
  </nav>

  <!-- Main content -->
  <main class="main-content">
    <!-- Budget context strip -->
    <div
      v-if="collabStore.isViewingSharedBudget && collabStore.activeBudgetContext"
      class="context-strip"
    >
      <div class="context-strip-inner">
        <i
          class="pi text-sm"
          :class="collabStore.activeBudgetContext.role === 'editor' ? 'pi-pencil' : 'pi-eye'"
        />
        <span class="context-strip-text">
          {{ collabStore.activeBudgetContext.role === 'editor' ? 'Co-editing' : 'Viewing' }}
          <strong>{{ collabStore.activeBudgetContext.ownerName || collabStore.activeBudgetContext.ownerEmail }}'s budget</strong>
          <span class="context-strip-role">{{ collabStore.activeBudgetContext.role }}</span>
        </span>
        <button class="context-strip-exit" @click="exitContext">
          <i class="pi pi-times text-xs" /> Exit
        </button>
      </div>
    </div>

    <slot>
      <RouterView />
    </slot>
  </main>
</template>

<style scoped>
/* ─── Sidebar context banner ──────────────────────────────────────────────── */
.sidebar-context-banner {
  margin: 0 0.75rem 0.25rem;
  padding: 0.625rem 0.75rem;
  background: rgba(52, 211, 153, 0.1);
  border: 1px solid rgba(52, 211, 153, 0.2);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sidebar-context-info {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--sidebar-accent);
  line-height: 1.4;
}

.sidebar-context-exit {
  font-size: 0.7rem;
  color: var(--sidebar-text-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  text-align: left;
  transition: color 0.15s;
}

.sidebar-context-exit:hover {
  color: var(--sidebar-text);
}

/* ─── Online collaborators strip ─────────────────────────────────────────── */
.sidebar-online {
  margin: 0 0.75rem 0.5rem;
  padding: 0.625rem 0.75rem;
  background: rgba(52, 211, 153, 0.06);
  border: 1px solid rgba(52, 211, 153, 0.15);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.sidebar-online-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: var(--sidebar-accent);
  white-space: nowrap;
}

.sidebar-online-avatars {
  display: flex;
  gap: -0.25rem;
}

.sidebar-online-avatar {
  position: relative;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: var(--sidebar-hover);
  border: 2px solid var(--sidebar-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--sidebar-accent);
  overflow: visible;
  margin-left: -0.375rem;
}

.sidebar-online-avatar:first-child {
  margin-left: 0;
}

.sidebar-online-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar-online-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--sidebar-accent);
  border: 1.5px solid var(--sidebar-bg);
}

/* ─── Sidebar badge ───────────────────────────────────────────────────────── */
.sidebar-badge {
  margin-left: auto;
  min-width: 1.125rem;
  height: 1.125rem;
  padding: 0 0.3rem;
  background: var(--app-negative);
  color: #fff;
  border-radius: 1rem;
  font-size: 0.65rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Mobile tab badge ────────────────────────────────────────────────────── */
.mobile-tab-icon-wrap {
  position: relative;
  display: flex;
  justify-content: center;
}

.mobile-tab-badge {
  position: absolute;
  top: -0.3rem;
  right: -0.4rem;
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.2rem;
  background: var(--app-negative);
  color: #fff;
  border-radius: 1rem;
  font-size: 0.6rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ─── Context strip (top of main content) ────────────────────────────────── */
.context-strip {
  background: var(--app-accent-soft);
  border-bottom: 1px solid rgba(5, 150, 105, 0.15);
  padding: 0.5rem 1.5rem;
}

.context-strip-inner {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  max-width: 100%;
  color: var(--app-accent);
  font-size: 0.8125rem;
}

.context-strip-text {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.context-strip-role {
  padding: 0.125rem 0.5rem;
  background: var(--app-accent-soft);
  border-radius: 2rem;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: capitalize;
  border: 1px solid rgba(5, 150, 105, 0.2);
}

.context-strip-exit {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--app-accent);
  background: none;
  border: 1px solid rgba(5, 150, 105, 0.3);
  border-radius: 0.375rem;
  padding: 0.25rem 0.625rem;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.context-strip-exit:hover {
  background: var(--app-accent);
  color: var(--app-accent-text);
}

/* ─── Mobile avatar button ───────────────────────────────────────────────── */
.mobile-avatar-wrap {
  position: relative;
}

.mobile-topbar-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1.5px solid var(--app-border-strong);
  background: var(--app-surface-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  overflow: visible;
  padding: 0;
  flex-shrink: 0;
  transition: border-color 0.15s ease;
  position: relative;
}

.mobile-topbar-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
  overflow: hidden;
}

.mobile-topbar-avatar-active {
  border-color: var(--app-accent);
}

.mobile-topbar-avatar-initials {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text-secondary);
  font-family: 'DM Sans', sans-serif;
}

.mobile-avatar-online-dot {
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--app-positive);
  border: 2px solid var(--app-bg);
}

/* ─── Avatar dropdown menu ───────────────────────────────────────────────── */
.avatar-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 49;
}

.avatar-menu {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 220px;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.875rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  padding: 0.375rem;
}

.avatar-menu-user {
  padding: 0.5rem 0.625rem 0.375rem;
}

.avatar-menu-user-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--app-text);
  margin: 0 0 0.125rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-menu-user-email {
  font-size: 0.7rem;
  color: var(--app-text-secondary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-menu-divider {
  height: 1px;
  background: var(--app-border);
  margin: 0.375rem 0;
}

.avatar-menu-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border-radius: 0.5rem;
  border: none;
  background: none;
  font-size: 0.875rem;
  color: var(--app-text);
  cursor: pointer;
  text-align: left;
  transition: background 0.12s ease;
  font-family: inherit;
}

.avatar-menu-item i {
  font-size: 0.875rem;
  color: var(--app-text-secondary);
  width: 1rem;
  text-align: center;
  flex-shrink: 0;
}

.avatar-menu-item:hover {
  background: var(--app-surface-hover);
}

.avatar-menu-item-danger {
  color: var(--app-negative);
}

.avatar-menu-item-danger i {
  color: var(--app-negative);
}

.avatar-menu-item-danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

/* ─── Online collaborators in dropdown ───────────────────────────────────── */
.avatar-menu-online-section {
  padding: 0.375rem 0 0;
}

.avatar-menu-section-label {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--app-text-secondary);
  margin: 0 0 0.375rem;
  padding: 0 0.625rem;
}

.avatar-menu-online-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.625rem;
}

.avatar-menu-online-avatar {
  position: relative;
  width: 1.625rem;
  height: 1.625rem;
  border-radius: 50%;
  background: var(--app-surface-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 600;
  color: var(--app-accent);
  flex-shrink: 0;
  overflow: visible;
}

.avatar-menu-online-avatar img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-menu-online-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-positive);
  border: 1.5px solid var(--app-surface);
}

.avatar-menu-online-name {
  font-size: 0.8125rem;
  color: var(--app-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ─── Avatar menu transition ─────────────────────────────────────────────── */
.avatar-menu-enter-active {
  transition: opacity 0.15s ease, transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.avatar-menu-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.avatar-menu-enter-from,
.avatar-menu-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(-4px);
  transform-origin: top right;
}

/* ─── Sidebar transition ─────────────────────────────────────────────────── */
.sidebar {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
</style>
