import { useEffect } from 'react'

export default function useLandingMotion(active = true) {
  useEffect(() => {
    if (!active) return undefined

    const root = document.documentElement
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tiltHandlers = new Map()
    const normalizedPath = window.location.pathname.replace(/\/+$/, '') || '/'
    let floatingCta = null
    let floatingCtaStyle = null

    if (normalizedPath === '/') {
      floatingCta = document.createElement('a')
      floatingCta.className = 'pt-floating-cta'
      floatingCta.href = '#comece'
      floatingCta.setAttribute('aria-label', 'Encontrar uma solução Peter Tecnet')
      floatingCta.innerHTML = '<span class="pt-floating-cta__pulse" aria-hidden="true"></span><span class="pt-floating-cta__label">Encontrar solução</span><span class="pt-floating-cta__arrow" aria-hidden="true">↗</span>'

      floatingCtaStyle = document.createElement('style')
      floatingCtaStyle.dataset.ptFloatingCta = 'true'
      floatingCtaStyle.textContent = `
        .pt-floating-cta {
          position: fixed;
          right: max(20px, env(safe-area-inset-right));
          bottom: max(20px, env(safe-area-inset-bottom));
          z-index: 950;
          min-height: 54px;
          padding: 0 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 11px;
          border: 1px solid rgba(111, 236, 255, .34);
          border-radius: 999px;
          color: var(--pt-text, #eefcff);
          background: linear-gradient(135deg, rgba(7, 29, 39, .96), rgba(1, 11, 17, .96));
          box-shadow: 0 18px 48px rgba(0, 0, 0, .38), 0 0 30px rgba(25, 216, 242, .12);
          backdrop-filter: blur(18px) saturate(140%);
          -webkit-backdrop-filter: blur(18px) saturate(140%);
          font: 800 11px/1 'Space Grotesk', sans-serif;
          letter-spacing: .04em;
          text-decoration: none;
          transform: translateZ(0);
          transition: transform .22s ease, border-color .22s ease, box-shadow .22s ease, background .22s ease;
        }
        .pt-floating-cta:hover,
        .pt-floating-cta:focus-visible {
          transform: translateY(-3px);
          border-color: rgba(111, 236, 255, .62);
          background: linear-gradient(135deg, rgba(9, 40, 52, .98), rgba(2, 18, 26, .98));
          box-shadow: 0 24px 60px rgba(0, 0, 0, .44), 0 0 38px rgba(25, 216, 242, .2);
          outline: none;
        }
        .pt-floating-cta__pulse {
          width: 9px;
          height: 9px;
          flex: 0 0 9px;
          border-radius: 50%;
          background: var(--pt-green, #52efaa);
          box-shadow: 0 0 0 5px rgba(82, 239, 170, .08), 0 0 16px rgba(82, 239, 170, .68);
        }
        .pt-floating-cta__arrow {
          color: var(--pt-cyan-2, #6ef0ff);
          font-size: 15px;
          transition: transform .22s ease;
        }
        .pt-floating-cta:hover .pt-floating-cta__arrow,
        .pt-floating-cta:focus-visible .pt-floating-cta__arrow {
          transform: translate(2px, -2px);
        }
        @media (max-width: 640px) {
          .pt-floating-cta {
            right: max(14px, env(safe-area-inset-right));
            bottom: max(14px, env(safe-area-inset-bottom));
            min-height: 50px;
            padding: 0 15px;
            gap: 9px;
            font-size: 10px;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .pt-floating-cta,
          .pt-floating-cta__arrow { transition: none; }
        }
      `

      document.head.appendChild(floatingCtaStyle)
      document.body.appendChild(floatingCta)
    }

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

    const observeReveal = element => {
      if (!(element instanceof Element) || !element.matches('[data-reveal]')) return
      if (reduceMotion) element.classList.add('is-visible')
      else revealObserver.observe(element)
    }

    const attachTilt = element => {
      if (reduceMotion || !(element instanceof Element) || !element.matches('[data-tilt]') || tiltHandlers.has(element)) return

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
      tiltHandlers.set(element, [onMove, onLeave])
    }

    const registerNode = node => {
      if (!(node instanceof Element)) return
      observeReveal(node)
      attachTilt(node)
      node.querySelectorAll('[data-reveal]').forEach(observeReveal)
      node.querySelectorAll('[data-tilt]').forEach(attachTilt)
    }

    document.querySelectorAll('[data-reveal]').forEach(observeReveal)
    document.querySelectorAll('[data-tilt]').forEach(attachTilt)

    const mutationObserver = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(registerNode))
      updateScroll()
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true })

    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    window.addEventListener('resize', updateScroll, { passive: true })
    if (!reduceMotion) window.addEventListener('pointermove', updatePointer, { passive: true })

    return () => {
      mutationObserver.disconnect()
      revealObserver.disconnect()
      window.removeEventListener('scroll', updateScroll)
      window.removeEventListener('resize', updateScroll)
      window.removeEventListener('pointermove', updatePointer)
      tiltHandlers.forEach(([onMove, onLeave], element) => {
        element.removeEventListener('pointermove', onMove)
        element.removeEventListener('pointerleave', onLeave)
      })
      tiltHandlers.clear()
      floatingCta?.remove()
      floatingCtaStyle?.remove()
    }
  }, [active])
}
