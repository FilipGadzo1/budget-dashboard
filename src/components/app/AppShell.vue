<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'

import { useAuth } from '@/composables/useAuth'
import { useUiStore } from '@/stores/ui'

const route = useRoute()
const uiStore = useUiStore()
const { user, signOut } = useAuth()
const sidebarOpen = ref(false)

const navItems = [
  { path: '/', icon: 'pi pi-objects-column', label: 'Dashboard' },
  { path: '/projections', icon: 'pi pi-calculator', label: 'Projections' },
  { path: '/scenarios', icon: 'pi pi-bookmark', label: 'Scenarios' },
  { path: '/settings', icon: 'pi pi-cog', label: 'Settings' },
]

const toggleSidebar = (): void => {
  sidebarOpen.value = !sidebarOpen.value
}

const closeSidebar = (): void => {
  sidebarOpen.value = false
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
      </RouterLink>
    </nav>

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
        <i :class="[item.icon, 'mobile-tab-icon']" />
        {{ item.label }}
      </RouterLink>
    </div>
  </nav>

  <!-- Main content -->
  <main class="main-content">
    <slot>
      <RouterView />
    </slot>
  </main>
</template>
