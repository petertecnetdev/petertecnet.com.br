import { useEffect } from 'react'
import { blogArticles } from './marketingContent.js'
import { createAdminContent, fetchAdminContent } from './discoveryApi.js'

const SESSION_KEY = 'peter_content_api_migration_checked'

function body(article) {
  const blocks = [article.intro]
  article.sections.forEach(section => {
    blocks.push(`## ${section.heading}`)
    ;(section.paragraphs || []).forEach(paragraph => blocks.push(paragraph))
    ;(section.bullets || section.points || []).forEach(point => blocks.push(`- ${typeof point === 'string' ? point : point?.text || point?.title || ''}`))
  })
  return blocks.filter(Boolean).join('\n\n')
}

export default function ContentApiMigrationBridge() {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return undefined
    sessionStorage.setItem(SESSION_KEY, '1')
    let active = true

    const migrate = async () => {
      try {
        const payload = await fetchAdminContent()
        if (!active) return
        const existing = new Set((payload?.data?.entries || []).map(entry => entry.slug))
        for (const article of blogArticles.filter(candidate => !existing.has(candidate.slug))) {
          if (!active) break
          await createAdminContent({
            type: 'article',
            status: 'published',
            title: article.title,
            slug: article.slug,
            excerpt: article.description,
            content: body(article),
            category: article.category,
            tags: [article.category, article.relatedPlatform].filter(Boolean),
            cluster: article.relatedPlatform || String(article.category).toLocaleLowerCase('pt-BR').replace(/\s+/g, '-'),
            search_intent: article.title,
            seo_title: article.seoTitle,
            seo_description: article.description,
            metadata: { related_platform: article.relatedPlatform, migrated_from: 'marketingContent.js', migration_version: 1 },
          })
        }
        if (active && blogArticles.some(candidate => !existing.has(candidate.slug))) window.dispatchEvent(new CustomEvent('peter:content-api-migrated'))
      } catch {
        sessionStorage.removeItem(SESSION_KEY)
      }
    }

    migrate()
    return () => { active = false }
  }, [])

  return null
}
