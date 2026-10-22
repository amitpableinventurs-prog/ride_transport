import type { CmsBlock } from '@/hooks/useCmsPage'

/** The text of a CMS page; wrap it in `.prose-policy` for the styles. */
export function CmsBlocks({ blocks }: { blocks: CmsBlock[] }) {
  return blocks.map((block, i) =>
    block.kind === 'heading' ? (
      <h2 key={i}>{block.text}</h2>
    ) : block.kind === 'list' ? (
      <ul key={i}>
        {block.items.map((item, j) => (
          <li key={j}>{item}</li>
        ))}
      </ul>
    ) : (
      <p key={i} className="whitespace-pre-line">
        {block.text}
      </p>
    ),
  )
}
