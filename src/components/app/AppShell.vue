<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import AccountMenu from '@/components/app/AccountMenu.vue'
import AppLogo from '@/components/app/AppLogo.vue'
import { useAuth } from '@/composables/useAuth'
import { useCollaborationStore } from '@/stores/collaboration'

const route = useRoute()
const collabStore = useCollaborationStore()
const { user } = useAuth()
const avatarMenuOpen = ref(false)

const pageTitle = computed(() => {
  const match = navItems.find((item) =>
    item.path === '/' ? route.path === '/' : route.path.startsWith(item.path)
  )
  return match?.label ?? otherPages[route.path] ?? 'Budget'
})

const navItems = [
  { path: '/', icon: 'pi pi-objects-column', label: 'Dashboard' },
  { path: '/projections', icon: 'pi pi-calculator', label: 'Projections' },
  { path: '/savings', icon: 'pi pi-wallet', label: 'Savings' },
  { path: '/scenarios', icon: 'pi pi-bookmark', label: 'Scenarios' },
  { path: '/collaboration', icon: 'pi pi-users', label: 'Collab' },
]

// Pages reached from the account menu rather than the navigation
const otherPages: Record<string, string> = { '/settings': 'Settings' }

const onlineOthers = computed(() =>
  collabStore.onlineUsers.filter((u) => u.userId !== user.value?.id),
)

const toggleAvatarMenu = (): void => {
  avatarMenuOpen.value = !avatarMenuOpen.value
}

const closeAvatarMenu = (): void => {
  avatarMenuOpen.value = false
}

// ── Sidebar account menu (desktop) ───────────────────────────────────────────
const accountMenuOpen = ref(false)
const accountArea = ref<HTMLElement | null>(null)

const closeAccountMenu = (): void => { accountMenuOpen.value = false }

const onDocumentPointerDown = (event: PointerEvent): void => {
  if (accountArea.value && !accountArea.value.contains(event.target as Node)) closeAccountMenu()
}
const onDocumentKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    closeAccountMenu()
    closeAvatarMenu()
  }
}

// Listen only while a menu is open
watch([accountMenuOpen, avatarMenuOpen], ([sidebarOpen, mobileOpen]) => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  if (sidebarOpen) document.addEventListener('pointerdown', onDocumentPointerDown)
  if (sidebarOpen || mobileOpen) document.addEventListener('keydown', onDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
})

// Navigating anywhere closes both menus
watch(() => route.path, () => {
  closeAccountMenu()
  closeAvatarMenu()
})

const userName = computed(() => user.value?.user_metadata?.full_name || user.value?.email || 'Account')
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())

const exitContext = async (): Promise<void> => {
  await collabStore.exitContext()
}
</script>

<template>
  <!-- Mobile top bar -->
  <header class="mobile-topbar">
    <div class="mobile-topbar-brand">
      <AppLogo :size="30" />
      <span class="mobile-topbar-title">{{ pageTitle }}</span>
    </div>
    <div class="mobile-topbar-actions">
      <div class="mobile-avatar-wrap">
        <button
          class="mobile-topbar-avatar"
          :class="{ 'mobile-topbar-avatar-active': avatarMenuOpen }"
          aria-label="Account menu"
          aria-haspopup="menu"
          :aria-expanded="avatarMenuOpen"
          @click.stop="toggleAvatarMenu"
        >
          <img
            v-if="user?.user_metadata?.avatar_url"
            :src="user.user_metadata.avatar_url"
            class="mobile-topbar-avatar-img"
            alt=""
          />
          <span v-else class="mobile-topbar-avatar-initials">
            {{ userInitial }}
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

            <AccountMenu @close="closeAvatarMenu" />
          </div>
        </Transition>
      </div>
    </div>
  </header>

  <!-- Avatar menu backdrop -->
  <div v-if="avatarMenuOpen" class="avatar-menu-backdrop" @click="closeAvatarMenu" />

  <!-- Sidebar -->
  <aside class="sidebar">
    <div class="sidebar-brand">
      <AppLogo :size="36" />
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

    <nav class="sidebar-nav" aria-label="Main">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="sidebar-link"
        :class="{ 'sidebar-link-active': route.path === item.path }"
      >
        <i :class="[item.icon, 'sidebar-link-icon']" aria-hidden="true" />
        {{ item.label }}
        <span
          v-if="item.path === '/collaboration' && collabStore.pendingInvitesCount > 0"
          class="sidebar-badge"
          :aria-label="`${collabStore.pendingInvitesCount} pending invites`"
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

    <!-- Account: one row that opens a menu with theme, Settings and Sign out -->
    <div ref="accountArea" class="sidebar-footer sidebar-account-area">
      <Transition name="account-pop">
        <div v-if="accountMenuOpen" id="sidebar-account-menu" class="sidebar-account-pop">
          <AccountMenu @close="closeAccountMenu" />
        </div>
      </Transition>

      <button
        class="sidebar-account"
        :class="{ 'sidebar-account-open': accountMenuOpen }"
        aria-haspopup="menu"
        aria-controls="sidebar-account-menu"
        :aria-expanded="accountMenuOpen"
        @click="accountMenuOpen = !accountMenuOpen"
      >
        <img
          v-if="user?.user_metadata?.avatar_url"
          :src="user.user_metadata.avatar_url"
          class="sidebar-account-avatar"
          alt=""
        />
        <span v-else class="sidebar-account-avatar sidebar-account-initial" aria-hidden="true">{{ userInitial }}</span>
        <span class="sidebar-account-text">
          <span class="sidebar-account-name">{{ userName }}</span>
          <span v-if="user?.email && user.email !== userName" class="sidebar-account-email">{{ user.email }}</span>
        </span>
        <i class="pi pi-angle-up sidebar-account-chevron" aria-hidden="true" />
      </button>
    </div>
  </aside>

  <!-- Mobile bottom tabs -->
  <nav class="mobile-tabs" aria-label="Main">
    <div class="mobile-tabs-inner">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="mobile-tab"
        :class="{ 'mobile-tab-active': route.path === item.path || (item.path !== '/' && route.path.startsWith(item.path)) }"
      >
        <div class="mobile-tab-icon-wrap">
          <i :class="[item.icon, 'mobile-tab-icon']" aria-hidden="true" />
          <span
            v-if="item.path === '/collaboration' && collabStore.pendingInvitesCount > 0"
            class="mobile-tab-badge"
          >
            {{ collabStore.pendingInvitesCount }}
          </span>
        </div>
        <span class="mobile-tab-label">{{ item.label }}</span>
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
/* ─── Sidebar account row + menu ──────────────────────────────────────────── */
.sidebar-account-area {
  position: relative;
}

.sidebar-account {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.625rem;
  border: none;
  border-radius: 0.625rem;
  background: none;
  color: var(--sidebar-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease;
}

.sidebar-account:hover,
.sidebar-account-open {
  background: var(--sidebar-hover);
}

.sidebar-account-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.sidebar-account-initial {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #059669, #34d399);
  color: #fff;
  font-size: 0.8125rem;
  font-weight: 700;
}

.sidebar-account-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.sidebar-account-name {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--sidebar-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-account-email {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-account-chevron {
  flex-shrink: 0;
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  transition: transform 0.15s ease;
}

.sidebar-account-open .sidebar-account-chevron {
  transform: rotate(180deg);
}

/* Opens upward from the account row */
.sidebar-account-pop {
  position: absolute;
  left: 0.75rem;
  right: 0.75rem;
  bottom: calc(100% - 0.25rem);
  padding: 0.375rem;
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: 0.875rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
  z-index: 5;
}

.account-pop-enter-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.account-pop-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.account-pop-enter-from,
.account-pop-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

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

.avatar-menu-divider {
  height: 1px;
  background: var(--app-border);
  margin: 0.375rem 0;
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
