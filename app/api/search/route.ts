import { createFromSource } from 'fumadocs-core/search/server'
import { source } from '@/src/lib/source'

export const { GET } = createFromSource(source)
