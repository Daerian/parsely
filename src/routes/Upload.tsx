import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Receipt as ReceiptIcon, RotateCcw, Trash2 } from 'lucide-react'
import { useUploadDocument } from '../lib/upload'
import { useDeleteDocument, useDocuments } from '../lib/queries'
import { supabase } from '../lib/supabase'
import Card from '../components/Card'
import type { DocumentKind } from '../lib/database.types'
import { getErrorMessage } from '../lib/errors'

export default function Upload() {
  const navigate = useNavigate()
  const upload = useUploadDocument()
  const deleteDocument = useDeleteDocument()
  const { data: documents = [] } = useDocuments()
  const [pendingKind, setPendingKind] = useState<DocumentKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const statementInput = useRef<HTMLInputElement>(null)
  const receiptInput = useRef<HTMLInputElement>(null)

  async function handleFile(kind: DocumentKind, file: File | undefined) {
    if (!file) return
    setError(null)
    setPendingKind(kind)
    try {
      const { documentId } = await upload.mutateAsync({ file, kind })
      navigate(`/review/${documentId}`)
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed'))
    } finally {
      setPendingKind(null)
    }
  }

  async function retryParse(documentId: string) {
    setError(null)
    const { error } = await supabase.functions.invoke('parse-document', { body: { documentId } })
    if (error) setError(error.message)
    else navigate(`/review/${documentId}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-bold text-stone-900">Upload</h1>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => statementInput.current?.click()}
          disabled={upload.isPending}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-6 text-stone-600 active:bg-stone-50 disabled:opacity-50"
        >
          {pendingKind === 'statement' ? <Loader2 className="animate-spin" size={28} /> : <FileText size={28} />}
          <span className="text-sm font-semibold">Statement</span>
          <span className="text-xs text-stone-400">PDF or CSV</span>
        </button>
        <button
          onClick={() => receiptInput.current?.click()}
          disabled={upload.isPending}
          className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white p-6 text-stone-600 active:bg-stone-50 disabled:opacity-50"
        >
          {pendingKind === 'receipt' ? <Loader2 className="animate-spin" size={28} /> : <ReceiptIcon size={28} />}
          <span className="text-sm font-semibold">Receipt</span>
          <span className="text-xs text-stone-400">Photo or PDF</span>
        </button>
      </div>

      <input
        ref={statementInput}
        type="file"
        accept=".pdf,.csv,application/pdf,text/csv"
        className="hidden"
        onChange={(e) => handleFile('statement', e.target.files?.[0])}
      />
      <input
        ref={receiptInput}
        type="file"
        accept="image/*,.pdf,application/pdf"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile('receipt', e.target.files?.[0])}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-700">Recent uploads</h2>
        {documents.length === 0 ? (
          <Card className="text-sm text-stone-400">Nothing uploaded yet.</Card>
        ) : (
          <Card className="divide-y divide-stone-100 p-0">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                {doc.kind === 'statement' ? (
                  <FileText size={18} className="shrink-0 text-stone-400" />
                ) : (
                  <ReceiptIcon size={18} className="shrink-0 text-stone-400" />
                )}
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => (doc.status === 'parsed' || doc.status === 'confirmed') && navigate(`/review/${doc.id}`)}
                >
                  <p className="truncate text-sm font-medium text-stone-800">{doc.original_filename ?? doc.storage_path}</p>
                  <StatusLabel status={doc.status} />
                </button>
                {doc.status === 'error' && (
                  <button onClick={() => retryParse(doc.id)} className="p-1 text-stone-400 active:text-stone-600" aria-label="Retry">
                    <RotateCcw size={16} />
                  </button>
                )}
                <button
                  onClick={() => deleteDocument.mutate({ id: doc.id, storagePath: doc.storage_path })}
                  className="p-1 text-stone-400 active:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}

function StatusLabel({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: 'text-stone-400',
    parsing: 'text-amber-600',
    parsed: 'text-brand-700',
    confirmed: 'text-stone-400',
    error: 'text-red-600',
  }
  const labels: Record<string, string> = {
    pending: 'Waiting…',
    parsing: 'Reading with AI…',
    parsed: 'Ready to review',
    confirmed: 'Confirmed',
    error: 'Failed — tap to retry',
  }
  return <p className={`text-xs ${styles[status] ?? 'text-stone-400'}`}>{labels[status] ?? status}</p>
}
