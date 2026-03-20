import { initStickyHeader, initHamburger, initScrollAnimations, initCounters, initAuth, openAuthModal, logoutUser } from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initScrollAnimations()
  initCounters()
  await initAuth()
  document.getElementById('headerLoginBtn')?.addEventListener('click', () => openAuthModal('login'))
  document.querySelectorAll('.global-header-logout').forEach(btn => {
    btn.addEventListener('click', async () => { await logoutUser() })
  })
})