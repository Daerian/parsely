import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import { useAuth } from './auth'
import type { DocumentKind } from './database.types'

export interface UploadResult {
  documentId: string
}

/**
 * Uploads a statement/receipt file to the household's storage folder, creates
 * its `documents` row, then invokes the `parse-document` Edge Function to
 * extract transactions via the Claude API. Throws if the upload succeeds but
 * parsing fails — the document row will still exist with status 'error' so
 * the user can retry from the documents list.
 */
export function useUploadDocument() {
  const { household, user } = useAuth()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ file, kind }: { file: File; kind: DocumentKind }): Promise<UploadResult> => {
      const path = `${household!.id}/${crypto.randomUUID()}-${file.name}`

      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, {
        contentType: file.type || undefined,
      })
      if (uploadError) throw uploadError

      const { data: doc, error: insertError } = await supabase
        .from('documents')
        .insert({
          household_id: household!.id,
          uploaded_by: user!.id,
          kind,
          storage_path: path,
          original_filename: file.name,
        })
        .select('id')
        .single()
      if (insertError || !doc) throw insertError ?? new Error('Failed to create document record')

      const { error: fnError } = await supabase.functions.invoke('parse-document', {
        body: { documentId: doc.id },
      })
      if (fnError) throw fnError

      return { documentId: doc.id }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['documents', household?.id] }),
  })
}
