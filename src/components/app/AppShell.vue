<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useCollaborationStore } from '@/stores/collaboration'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const uiStore = useUiStore()
const collabStore = useCollaborationStore()
const { user, signOut } = useAuth()
const sidebarOpen = ref(false)

const navItems = [
  { path: '/', icon: 'pi pi-objects-column', label: 'Dashboard' },
  { path: '/projections', icon: 'pi pi-calculator', label: 'Projections' },
  { path: '/scenarios', icon: 'pi pi-bookmark', label: 'Scenarios' },
  { path: '/collaboration', icon: 'pi pi-users', label: 'Collab' },
  { path: '/settings', icon: 'pi pi-cog', label: 'Settings' },
]

const toggleSidebar = (): void => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = (): void => {
  sidebarOpen.value = false
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
      <span class="mobile-topbar-title">Budget</span>
    </div>
    <div class="mobile-topbar-actions">
      <button class="mobile-topbar-btn" @click="uiStore.toggleTheme()">
        <i :class="uiStore.themeMode === 'dark' ? 'pi pi-sun' : 'pi pi-moon'" />
      </button>
      <button class="mobile-topbar-btn" @click="toggleSidebar">
        <i class="pi pi-bars" />
      </button>
    </div>
  </header>

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
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="mobile-tab"
        :class="{ 'mobile-tab-active': route.path === item.path }"
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
        {{ item.label }}
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
</style>
