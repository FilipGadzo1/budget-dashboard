import { onUnmounted, watch } from 'vue'

import { useUiStore } from '@/stores/ui'

const CHARS  = ['✦', '✧', '⋆', '★', '✸']
const COLORS = ['#f87171', '#fb923c', '#fbbf24', '#4ade80', '#60a5fa', '#a78bfa', '#f472b6', '#e879f9', '#fde68a']

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function spawnSparkles(x: number, y: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    const size   = rand(7, 15)
    const angle  = count === 1 ? rand(0, 360) : (i / count) * 360 + rand(-20, 20)
    const dist   = count === 1 ? rand(15, 30) : rand(30, 60)
    const dur    = rand(450, 750)
    const color  = COLORS[Math.floor(Math.random() * COLORS.length)]
    const char   = CHARS[Math.floor(Math.random() * CHARS.length)]

    el.textContent = char
    el.style.cssText = `
      position:fixed;
      left:${x}px;top:${y}px;
      font-size:${size}px;
      color:${color};
      pointer-events:none;
      z-index:99999;
      line-height:1;
      user-select:none;
      will-change:transform,opacity;
    `
    document.body.appendChild(el)

    const rad = (angle * Math.PI) / 180
    const dx  = Math.cos(rad) * dist
    const dy  = Math.sin(rad) * dist

    el.animate(
      [
        { opacity: 1,   transform: `translate(-50%,-50%) scale(1)` },
        { opacity: 0,   transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.1)` },
      ],
      { duration: dur, easing: 'ease-out', fill: 'forwards' },
    ).onfinish = () => el.remove()
  }
}

const HOVER_SELECTOR = '.btn, .kpi-card, .savings-card, .card, .sidebar-link, .sidebar-logo, .mobile-topbar-logo'
const recentlyBurst  = new WeakSet<Element>()

export function useUnicornSparkles(): void {
  const uiStore = useUiStore()
  let active         = false
  let lastTrailTime  = 0

  const onMouseMove = (e: MouseEvent): void => {
    const now = Date.now()
    if (now - lastTrailTime < 80) return
    lastTrailTime = now
    spawnSparkles(e.clientX, e.clientY, 1)
  }

  const onMouseOver = (e: MouseEvent): void => {
    const el = (e.target as HTMLElement).closest(HOVER_SELECTOR)
    if (!el || recentlyBurst.has(el)) return
    recentlyBurst.add(el)
    setTimeout(() => recentlyBurst.delete(el), 900)
    const r = el.getBoundingClientRect()
    spawnSparkles(r.left + r.width / 2, r.top + r.height / 2, 8)
  }

  function activate(): void {
    if (active) return
    active = true
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseover', onMouseOver)
  }

  function deactivate(): void {
    if (!active) return
    active = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseover', onMouseOver)
  }

  const stopWatch = watch(
    () => uiStore.themeMode,
    (mode) => (mode === 'unicorn' ? activate() : deactivate()),
    { immediate: true },
  )

  onUnmounted(() => {
    stopWatch()
    deactivate()
  })
}
