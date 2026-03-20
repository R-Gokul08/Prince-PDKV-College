import { initStickyHeader, initHamburger, initScrollAnimations, initCounters, initAuth, openAuthModal, logoutUser } from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()

  document.querySelectorAll('.hero-content .animate-fade-up').forEach((el, i) => {
    setTimeout(() => el.classList.add('visible'), 100 + i * 140)
  })

  initScrollAnimations()
  initCounters()
  await initAuth()

  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => { await logoutUser() })
  })
})