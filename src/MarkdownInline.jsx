import { Fragment } from 'react'
import { parseMarkdownInline } from './utils/markdownLinks.js'

export default function MarkdownInline({ text }) {
  return parseMarkdownInline(text).map((part, index) => part.type === 'link'
    ? <a key={index} href={part.href} {...(part.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{part.text}</a>
    : <Fragment key={index}>{part.text}</Fragment>)
}
