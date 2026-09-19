import { useId } from 'react'
import './PageHeader.css'

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className = '',
}) {
  const titleId = useId()
  const descriptionId = description ? `${titleId}-description` : undefined

  return (
    <header
      className={`pt-page-header ${className}`.trim()}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <div className="pt-page-header__content">
        {eyebrow ? <p className="pt-page-header__eyebrow">{eyebrow}</p> : null}
        <h1 id={titleId} className="pt-page-header__title">{title}</h1>
        {description ? (
          <p id={descriptionId} className="pt-page-header__description">
            {description}
          </p>
        ) : null}
        {meta ? <div className="pt-page-header__meta">{meta}</div> : null}
      </div>
      {actions ? <div className="pt-page-header__actions">{actions}</div> : null}
    </header>
  )
}
