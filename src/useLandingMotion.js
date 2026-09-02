import { useEffect } from 'react'

export default function useLandingMotion(active = true) {
  useEffect(() => {
    if (!active) return undefined

    const root = document.documentElement
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const updatePointer = event => {
      root.style.setProperty('--pointer-x', `${event.clientX}px`)
      root.style.setProperty('--pointer-y', `${event.clientY}px`)
    }

    const updateScroll = () => {
      const max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1)
      root.style.setProperty('--scroll-progress', `${Math.min(window.scrollY / max, 1)}`)
    }

    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible')
          revealObserver.unobserve(entry.target)
        }
      })
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 })

    document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element))

    const tiltHandlers = []
    if (!reduceMotion) {
      document.querySelectorAll('[data-tilt]').forEach(element => {
        const onMove = event => {
          const rect = element.getBoundingClientRect()
          const px = (event.clientX - rect.left) / Math.max(rect.width, 1)
          const py = (event.clientY - rect.top) / Math.max(rect.height, 1)
          element.style.setProperty('--tilt-x', `${(0.5 - py) * 7}deg`)
          element.style.setProperty('--tilt-y', `${(px - 0.5) * 8}deg`)
          element.style.setProperty('--glow-x', `${px * 100}%`)
          element.style.setProperty('--glow-y', `${py * 100}%`)
        }
        const onLeave = () => {
          element.style.setProperty('--tilt-x', '0deg')
          element.style.setProperty('--tilt-y', '0deg')
          element.style.setProperty('--glow-x', '50%')
          element.style.setProperty('--glow-y', '50%')
        }
        element.addEventListener('pointermove', onMove)
        element.addEventListener('pointerleave', onLeave)
        tiltHandlers.push([element, onMove, onLeave])
      })
      window.addEventListener('pointermove', updatePointer, { passive: true })
    }

    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })

    return () => {
      revealObserver.disconnect()
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('pointermove', updatePointer)
      tiltHandlers.forEach(([element, onMove, onLeave]) => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerleave', onLeave)
      })
    }
  }, [active])
}
