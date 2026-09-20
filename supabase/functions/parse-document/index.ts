// Supabase Edge Function: parse-document
//
// Given a document already uploaded to the `documents` storage bucket and a
// row in the `documents` table, downloads the file, sends it to the Claude
// API for structured extraction, and writes the result back onto the row.
//
// The Anthropic API key never reaches the browser: it's read here from the
// `ANTHROPIC_API_KEY` Edge Function secret.
//
// Deploy with:
//   supabase functions deploy parse-document
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Invoke from the client with: supabase.functions.invoke('parse-document', { body: { documentId } })

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const ANTHROPIC_MODEL = 'claude-sonnet-5'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface ParsedTransaction {
  date: string // YYYY-MM-DD
  amount: number // negative = spend, positive = income/credit
  description: string
  merchant: string | null
  suggested_category: string | null
  line_items: { name: string; amount: number; qty?: number }[] | null
}

const EXTRACTION_TOOL = {
  name: 'record_transactions',
  description: 'Record the transactions found in the uploaded bank statement or receipt.',
  input_schema: {
    type: 'object',
    properties: {
      transactions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            date: { type: 'string', description: 'ISO date YYYY-MM-DD the transaction occurred or posted.' },
            amount: {
              type: 'number',
              description: 'Negative for money spent, positive for income/deposits/refunds.',
            },
            description: { type: 'string', description: 'The line as it appears on the statement, or the store name for a receipt.' },
            merchant: { type: ['string', 'null'], description: 'Cleaned-up merchant/payee name.' },
            suggested_category: {
              type: ['string', 'null'],
              description: 'Best matching category name from the provided list, or null if none fit.',
            },
            line_items: {
              type: ['array', 'null'],
              description: 'For a receipt only: individual items purchased.',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  amount: { type: 'number' },
                  qty: { type: 'number' },
                },
                required: ['name', 'amount'],
              },
            },
          },
          required: ['date', 'amount', 'description'],
        },
      },
    },
    required: ['transactions'],
  },
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  try {
    const { documentId } = await req.json()
    if (!documentId) return jsonResponse({ error: 'documentId is required' }, 400)

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()
    if (docError || !doc) return jsonResponse({ error: 'document not found' }, 404)

    await supabase.from('documents').update({ status: 'parsing' }).eq('id', documentId)

    const { data: categories } = await supabase
      .from('categories')
      .select('name, is_income')
      .eq('household_id', doc.household_id)
      .order('sort_order')

    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from('documents')
      .download(doc.storage_path)
    if (downloadError || !fileBlob) throw new Error(`Failed to download document: ${downloadError?.message}`)

    const mediaType = fileBlob.type || guessMediaType(doc.original_filename ?? doc.storage_path)
    const isText = mediaType === 'text/csv' || mediaType === 'text/plain'

    const documentBlock = isText
      ? { type: 'text', text: await fileBlob.text() }
      : mediaType === 'application/pdf'
        ? { type: 'document', source: { type: 'base64', media_type: mediaType, data: arrayBufferToBase64(await fileBlob.arrayBuffer()) } }
        : { type: 'image', source: { type: 'base64', media_type: mediaType, data: arrayBufferToBase64(await fileBlob.arrayBuffer()) } }

    const categoryList = (categories ?? []).map((c) => c.name).join(', ')
    const kindLabel = doc.kind === 'receipt' ? 'a purchase receipt' : 'a bank/credit card statement'

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 16000, // headroom for statements with a few hundred line items
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'record_transactions' },
        messages: [
          {
            role: 'user',
            content: [
              documentBlock,
              {
                type: 'text',
                text: [
                  `This is ${kindLabel}. Extract every transaction line.`,
                  doc.kind === 'receipt'
                    ? 'For a receipt, extract ONE transaction for the total purchase (amount negative), and populate line_items with each item bought.'
                    : 'For a statement, extract each individual posted transaction as its own entry. Do not include the running balance or the statement summary as a transaction.',
                  `Available categories: ${categoryList || 'none configured'}.`,
                  'Set suggested_category to the single best match from that list (exact name), or null if nothing fits well. Never invent a category name that is not in the list.',
                ].join(' '),
              },
            ],
          },
        ],
      }),
    })

    if (!anthropicResponse.ok) {
      const errText = await anthropicResponse.text()
      throw new Error(`Anthropic API error ${anthropicResponse.status}: ${errText}`)
    }

    const result = await anthropicResponse.json()
    const toolUse = result.content?.find((block: { type: string }) => block.type === 'tool_use')
    const transactions: ParsedTransaction[] = toolUse?.input?.transactions ?? []

    await supabase
      .from('documents')
      .update({ status: 'parsed', parse_result: { transactions }, error_message: null })
      .eq('id', documentId)

    return jsonResponse({ transactions })
  } catch (err) {
    console.error(err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    try {
      const { documentId } = await req.clone().json()
      if (documentId) {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        await supabase.from('documents').update({ status: 'error', error_message: message }).eq('id', documentId)
      }
    } catch {
      // best-effort; ignore
    }
    return jsonResponse({ error: message }, 500)
  }
})

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function guessMediaType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'csv':
      return 'text/csv'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    case 'heic':
      return 'image/heic'
    case 'jpg':
    case 'jpeg':
    default:
      return 'image/jpeg'
  }
}
