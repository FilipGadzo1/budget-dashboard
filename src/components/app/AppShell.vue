<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import AccountMenu from '@/components/app/AccountMenu.vue'
import AppLogo from '@/components/app/AppLogo.vue'
import CommandPalette from '@/components/app/CommandPalette.vue'
import { useAuth } from '@/composables/useAuth'
import { useCommandPalette } from '@/composables/useCommandPalette'
import { useTimeTravel } from '@/composables/useTimeTravel'
import { useCollaborationStore } from '@/stores/collaboration'

// The frame around every signed-in page.
//   Desktop: a top bar (navigation, then Search and the account menu, which
//            holds Sharing and Settings) and
//            the page. The frame is exactly one screen tall, so pages lay
//            themselves out without scrolling.
//   Phone:   a top bar with the page name, the page (which scrolls) and the tab bar.

const route = useRoute()
const collabStore = useCollaborationStore()
const { user } = useAuth()
const timeTravel = useTimeTravel()

const navItems = [
  { path: '/', icon: 'pi pi-objects-column', label: 'Overview' },
  { path: '/plan', icon: 'pi pi-sliders-h', label: 'Plan' },
  { path: '/forecast', icon: 'pi pi-chart-line', label: 'Forecast' },
  { path: '/savings', icon: 'pi pi-wallet', label: 'Savings' },
  { path: '/scenarios', icon: 'pi pi-bookmark', label: 'Scenarios' },
]

// Pages reached from the end of the top bar rather than the main navigation
const otherPages: Record<string, string> = { '/settings': 'Settings', '/collaboration': 'Sharing' }

const isActive = (path: string): boolean => (path === '/' ? route.path === '/' : route.path.startsWith(path))
const pageTitle = computed(() => navItems.find((item) => isActive(item.path))?.label ?? otherPages[route.path] ?? 'Budget')

const onlineOthers = computed(() => collabStore.onlineUsers.filter((u) => u.userId !== user.value?.id))
const userName = computed(() => user.value?.user_metadata?.full_name || user.value?.email || 'Account')
const userInitial = computed(() => userName.value.charAt(0).toUpperCase())
const context = computed(() => (collabStore.isViewingSharedBudget ? collabStore.activeBudgetContext : null))

// ── Command palette (Ctrl/⌘ K) ───────────────────────────────────────────────
const palette = useCommandPalette()
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const shortcutLabel = isMac ? '⌘K' : 'Ctrl K'

const onGlobalKeydown = (event: KeyboardEvent): void => {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    palette.toggle()
  }
}
onMounted(() => document.addEventListener('keydown', onGlobalKeydown))

// ── Account menu: one on desktop (top bar), one on phones (avatar) ───────────
const accountMenuOpen = ref(false)
const avatarMenuOpen = ref(false)
const accountArea = ref<HTMLElement | null>(null)

const closeMenus = (): void => {
  accountMenuOpen.value = false
  avatarMenuOpen.value = false
}

const onDocumentPointerDown = (event: PointerEvent): void => {
  if (accountArea.value && !accountArea.value.contains(event.target as Node)) accountMenuOpen.value = false
}
const onDocumentKeydown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') closeMenus()
}

// Listen only while a menu is open
watch([accountMenuOpen, avatarMenuOpen], ([desktopOpen, mobileOpen]) => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  if (desktopOpen) document.addEventListener('pointerdown', onDocumentPointerDown)
  if (desktopOpen || mobileOpen) document.addEventListener('keydown', onDocumentKeydown)
})

// Navigating anywhere closes both menus
watch(() => route.path, closeMenus)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKeydown)
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeydown)
  palette.hide()
  // Signing out: the next person starts at the end of their own saved plan
  timeTravel.resetAll()
})

const exitContext = async (): Promise<void> => {
  await collabStore.exitContext()
}
</script>

<template>
  <div class="app-frame">

    <!-- ── Phone: top bar ─────────────────────────────────────────── -->
    <header class="mobile-topbar">
      <div class="mobile-topbar-brand">
        <AppLogo :size="30" />
        <span class="mobile-topbar-title">{{ pageTitle }}</span>
      </div>
      <div class="mobile-topbar-actions">
        <button class="btn btn-ghost btn-icon" aria-label="Search pages and actions" @click="palette.show()">
          <i class="pi pi-search" aria-hidden="true" />
        </button>
        <div class="mobile-avatar-wrap">
          <button
            class="avatar-btn"
            :class="{ 'avatar-btn-open': avatarMenuOpen }"
            aria-label="Account menu"
            aria-haspopup="menu"
            :aria-expanded="avatarMenuOpen"
            @click.stop="avatarMenuOpen = !avatarMenuOpen"
          >
            <img v-if="user?.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" alt="" />
            <span v-else>{{ userInitial }}</span>
            <i v-if="onlineOthers.length > 0" class="avatar-online" aria-hidden="true" />
            <i v-if="collabStore.pendingInvitesCount > 0" class="avatar-invite" aria-hidden="true" />
          </button>
          <Transition name="menu-pop">
            <div v-if="avatarMenuOpen" class="menu-pop" @click.stop>
              <div v-if="onlineOthers.length > 0" class="menu-online">
                <p class="menu-online-label">Online now</p>
                <p v-for="u in onlineOthers" :key="u.userId" class="menu-online-row">
                  <i class="menu-online-dot" aria-hidden="true" />{{ u.userName || u.userEmail }}
                </p>
              </div>
              <AccountMenu @close="closeMenus" />
            </div>
          </Transition>
        </div>
      </div>
    </header>
    <div v-if="avatarMenuOpen" class="menu-backdrop" @click="closeMenus" />

    <!-- ── Desktop: top bar ───────────────────────────────────────── -->
    <header class="topnav">
      <RouterLink to="/" class="topnav-brand" aria-label="Budget, overview">
        <AppLogo :size="30" />
        <span>Budget</span>
      </RouterLink>

      <nav class="topnav-links" aria-label="Main">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="topnav-link"
          :class="{ 'topnav-link-on': isActive(item.path) }"
          :aria-current="isActive(item.path) ? 'page' : undefined"
        >
          <i :class="item.icon" aria-hidden="true" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="topnav-end">
        <!-- Whose budget this is, when it is not your own -->
        <span v-if="context" class="topnav-context">
          <i class="pi" :class="context.role === 'editor' ? 'pi-pencil' : 'pi-eye'" aria-hidden="true" />
          {{ context.role === 'editor' ? 'Co-editing' : 'Viewing' }}
          <strong>{{ context.ownerName || context.ownerEmail }}</strong>
          <button class="topnav-context-exit" @click="exitContext">Exit</button>
        </span>

        <span v-if="onlineOthers.length > 0" class="topnav-online" :title="`Online now: ${onlineOthers.map((u) => u.userName || u.userEmail).join(', ')}`">
          <span v-for="u in onlineOthers.slice(0, 3)" :key="u.userId" class="topnav-online-avatar">
            <img v-if="u.avatarUrl" :src="u.avatarUrl" :alt="u.userName" />
            <template v-else>{{ (u.userName || u.userEmail || '?').charAt(0).toUpperCase() }}</template>
          </span>
        </span>

        <button class="topnav-search" @click="palette.show()">
          <i class="pi pi-search" aria-hidden="true" />
          <span>Search</span>
          <kbd>{{ shortcutLabel }}</kbd>
        </button>

        <div ref="accountArea" class="topnav-account">
          <button
            class="avatar-btn"
            :class="{ 'avatar-btn-open': accountMenuOpen }"
            :aria-label="collabStore.pendingInvitesCount > 0
              ? `Account: ${userName}, ${collabStore.pendingInvitesCount} pending invites`
              : `Account: ${userName}`"
            aria-haspopup="menu"
            aria-controls="topnav-account-menu"
            :aria-expanded="accountMenuOpen"
            @click="accountMenuOpen = !accountMenuOpen"
          >
            <img v-if="user?.user_metadata?.avatar_url" :src="user.user_metadata.avatar_url" alt="" />
            <span v-else>{{ userInitial }}</span>
            <i v-if="collabStore.pendingInvitesCount > 0" class="avatar-invite" aria-hidden="true" />
          </button>
          <Transition name="menu-pop">
            <div v-if="accountMenuOpen" id="topnav-account-menu" class="menu-pop">
              <AccountMenu @close="closeMenus" />
            </div>
          </Transition>
        </div>
      </div>
    </header>

    <!-- ── Page ───────────────────────────────────────────────────── -->
    <main class="main-content">
      <!-- Phone: whose budget this is (the desktop top bar shows it itself) -->
      <div v-if="context" class="context-strip">
        <i class="pi text-sm" :class="context.role === 'editor' ? 'pi-pencil' : 'pi-eye'" aria-hidden="true" />
        <span>
          {{ context.role === 'editor' ? 'Co-editing' : 'Viewing' }}
          <strong>{{ context.ownerName || context.ownerEmail }}'s budget</strong>
        </span>
        <button class="topnav-context-exit" @click="exitContext">Exit</button>
      </div>

      <!-- Keyed so each page fades in when you navigate to it -->
      <div :key="route.path" class="page-enter">
        <slot>
          <RouterView />
        </slot>
      </div>
    </main>

    <!-- ── Phone: tab bar ─────────────────────────────────────────── -->
    <nav class="mobile-tabs" aria-label="Main">
      <div class="mobile-tabs-inner">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="mobile-tab"
          :class="{ 'mobile-tab-active': isActive(item.path) }"
        >
          <i :class="[item.icon, 'mobile-tab-icon']" aria-hidden="true" />
          <span class="mobile-tab-label">{{ item.label }}</span>
        </RouterLink>
      </div>
    </nav>

    <CommandPalette />
  </div>
</template>

<style scoped>
/* ─── Desktop top bar ─────────────────────────────────────────────────────── */
.topnav {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.75rem 2rem;
  border-bottom: 1px solid var(--card-border);
  background: var(--card-bg);
  backdrop-filter: var(--card-blur);
  -webkit-backdrop-filter: var(--card-blur);
  position: relative;
  z-index: 40;
}

.topnav-brand {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.9375rem;
  font-weight: 650;
  letter-spacing: -0.01em;
  color: var(--app-text);
  text-decoration: none;
  flex: none;
}

.topnav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.topnav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.875rem;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--app-text-secondary);
  text-decoration: none;
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.topnav-link .pi {
  font-size: 0.9375rem;
}

.topnav-link:hover {
  background: var(--app-surface-hover);
  color: var(--app-text);
}

.topnav-link-on,
.topnav-link-on:hover {
  background: var(--app-ink);
  color: var(--app-ink-text);
}

.topnav-end {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-left: auto;
  min-width: 0;
}

.topnav-search {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin-right: 0.5rem;
  padding: 0.4375rem 0.75rem;
  border: 1px solid var(--app-border);
  border-radius: 999px;
  background: transparent;
  color: var(--app-text-secondary);
  font: inherit;
  font-size: 0.8125rem;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}

.topnav-search:hover {
  border-color: var(--app-border-strong);
  color: var(--app-text);
}

.topnav-search kbd {
  font-family: inherit;
  font-size: 0.6875rem;
  color: var(--app-text-tertiary);
}


.topnav-context {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin-right: 0.5rem;
  padding: 0.3125rem 0.375rem 0.3125rem 0.75rem;
  border: 1px solid var(--app-accent-border);
  border-radius: 999px;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 0.8125rem;
  white-space: nowrap;
  min-width: 0;
}

.topnav-context strong {
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 12rem;
}

.topnav-context-exit {
  padding: 0.125rem 0.625rem;
  border: 1px solid var(--app-accent-border);
  border-radius: 999px;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.topnav-context-exit:hover {
  background: var(--app-accent);
  color: var(--app-accent-text);
}

.topnav-online {
  display: inline-flex;
  margin-right: 0.5rem;
}

.topnav-online-avatar {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  margin-left: -0.375rem;
  border: 2px solid var(--app-bg);
  border-radius: 50%;
  background: var(--app-accent-soft);
  color: var(--app-accent);
  font-size: 0.65rem;
  font-weight: 650;
  overflow: hidden;
}

.topnav-online-avatar:first-child {
  margin-left: 0;
}

.topnav-online-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.topnav-account {
  position: relative;
  margin-left: 0.5rem;
}

/* The top bar gets tight before the phone layout takes over: drop the labels
   that are also reachable elsewhere */
@media (max-width: 1320px) {
  .topnav {
    gap: 0.75rem;
    padding: 0.75rem 1.25rem;
  }

  .topnav-search span,
  .topnav-search kbd {
    display: none;
  }
}

@media (max-width: 1023px) {
  .topnav {
    display: none;
  }
}

/* ─── Avatar button + account menu (both layouts) ─────────────────────────── */
.avatar-btn {
  position: relative;
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1.5px solid var(--app-border-strong);
  border-radius: 50%;
  background: var(--app-surface-hover);
  color: var(--app-text);
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 650;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.avatar-btn img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-btn-open,
.avatar-btn:hover {
  border-color: var(--app-accent);
}

.avatar-online,
.avatar-invite {
  position: absolute;
  width: 9px;
  height: 9px;
  border: 2px solid var(--app-bg);
  border-radius: 50%;
}

.avatar-online {
  right: 0;
  bottom: 0;
  background: var(--app-positive);
}

/* A pending invite shows as a dot on the avatar; the count is in the menu */
.avatar-invite {
  top: -1px;
  right: -1px;
  background: var(--app-negative);
}

.mobile-avatar-wrap {
  position: relative;
}

.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 49;
}

.menu-pop {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  width: 15rem;
  padding: 0.375rem;
  border: 1px solid var(--app-border);
  border-radius: var(--radius-panel);
  background: var(--app-surface);
  box-shadow: var(--shadow-pop);
  z-index: 60;
}

.menu-pop-enter-active {
  transition: opacity 0.14s ease, transform 0.14s ease;
}

.menu-pop-leave-active {
  transition: opacity 0.1s ease;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

.menu-online {
  padding: 0.375rem 0.625rem 0.5rem;
  margin-bottom: 0.375rem;
  border-bottom: 1px solid var(--app-border);
}

.menu-online-label {
  margin: 0 0 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--app-text-secondary);
}

.menu-online-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--app-text);
}

.menu-online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--app-positive);
}

/* ─── Phone: whose budget this is ─────────────────────────────────────────── */
.context-strip {
  display: none;
}

@media (max-width: 1023px) {
  .context-strip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--app-accent-border);
    border-radius: var(--radius-control);
    background: var(--app-accent-soft);
    color: var(--app-accent);
    font-size: 0.8125rem;
  }

  .context-strip span {
    flex: 1;
    min-width: 0;
  }
}
</style>
