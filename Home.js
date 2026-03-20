import { initStickyHeader, initHamburger, initScrollAnimations, initCounters, initAuth, openAuthModal, logoutUser, updateHeaderAuthUI } from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()

  // Immediately make hero elements visible
  document.querySelectorAll('.hero-content .animate-fade-up').forEach(el => {
    el.classList.add('visible')
  })

  initScrollAnimations()
  initCounters()

  // Init global auth
  await initAuth()

  // Wire up header auth buttons
  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => {
      await logoutUser()
    })
  })
})