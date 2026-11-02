import { getBoardQuotes } from '@/lib/crm/server/data'
import { BoardView } from '@/components/crm/board-view'

export default async function CrmBoardPage() {
  const quotes = await getBoardQuotes()
  return <BoardView quotes={quotes} />
}
