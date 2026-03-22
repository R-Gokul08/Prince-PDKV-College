import {
  initStickyHeader, initHamburger, initScrollAnimations,
  initCounters, initAuth, openAuthModal, logoutUser,
  initRipple, initTiltCards, initPageTransitions
} from './shared.js'

document.addEventListener('DOMContentLoaded', async () => {
  initStickyHeader()
  initHamburger()
  initPageTransitions()
  initScrollAnimations()
  initCounters()
  initRipple()
  initTiltCards('.about-stat-card, .vm-card, .contact-ab-card')

  await initAuth()

  document.getElementById('headerLoginBtn')
    ?.addEventListener('click', () => openAuthModal('login'))

  document.querySelectorAll('.global-header-logout')
    .forEach(btn => btn.addEventListener('click', () => logoutUser()))
})