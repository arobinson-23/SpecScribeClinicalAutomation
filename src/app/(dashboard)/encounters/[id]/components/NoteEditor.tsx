"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useState, useCallback, useEffect } from "react";
import { Loader2, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

interface NoteEditorProps {
  encounterId: string;
  noteId?: string;
  initialNote?: string;
  transcript?: string;
  noteType: string;
  noteFormat: string;
  patientContext?: {
    ageYears?: number;
    biologicalSex?: string;
    priorDiagnoses?: string[];
    currentMedications?: string[];
    chiefComplaint?: string;
  };
  onNoteFinalized: (noteId: string, noteText: string) => void;
}

export function NoteEditor({
  encounterId,
  noteId,
  initialNote,
  transcript,
  noteType,
  noteFormat,
  patientContext,
  onNoteFinalized,
}: NoteEditorProps) {
  const [generating, setGenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState(noteId);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Generate a note from the transcript above, or start typing..." }),
    ],
    content: initialNote ?? "",
    editorProps: {
      attributes: {
        class: "prose-clinical focus:outline-none min-h-[300px]",
      },
    },
  });

  useEffect(() => {
    if (editor && initialNote && editor.getHTML() !== initialNote) {
      editor.commands.setContent(initialNote);
    }
  }, [editor, initialNote]);

  const generateNote = useCallback(async () => {
    if (!transcript) {
      toast.error("Record or upload audio first to generate a transcript");
      return;
    }

    setGenerating(true);

    const res = await fetch("/api/ai/generate-note", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ encounterId, transcript, noteType, noteFormat, patientContext }),
    });

    setGenerating(false);

    if (!res.ok) {
      toast.error("Note generation failed. Please try again.");
      return;
    }

    const data = await res.json() as { data?: { noteId: string; note: string; wordCount: number; latencyMs: number } };
    if (data.data) {
      editor?.commands.setContent(data.data.note);
      setCurrentNoteId(data.data.noteId);
      toast.success(`Note generated in ${(data.data.latencyMs / 1000).toFixed(1)}s — review and edit before finalizing`);
    }
  }, [transcript, encounterId, noteType, noteFormat, patientContext, editor]);

  const finalizeNote = useCallback(async () => {
    if (!currentNoteId || !editor) return;
    const noteText = editor.getText();
    if (noteText.trim().length < 10) {
      toast.error("Note is too short to finalize");
      return;
    }

    setFinalizing(true);

    const res = await fetch(`/api/encounters/${encounterId}/notes/${currentNoteId}/finalize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ noteText: editor.getHTML() }),
    });

    setFinalizing(false);

    if (!res.ok) {
      toast.error("Failed to finalize note");
      return;
    }

    toast.success("Note finalized and signed");
    onNoteFinalized(currentNoteId, noteText);
  }, [currentNoteId, editor, encounterId, onNoteFinalized]);

  return (
    <div className="bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-white/5">
        <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest">
          Clinical Note
          <span className="ml-2 normal-case font-normal text-white/30">{noteFormat} format</span>
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={generateNote}
            disabled={generating || !transcript}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generating ? "Generating..." : "Generate with AI"}
          </button>
          <button
            onClick={finalizeNote}
            disabled={finalizing || !currentNoteId}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          >
            {finalizing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {finalizing ? "Finalizing..." : "Finalize & sign"}
          </button>
        </div>
      </div>

      <div className="p-5">
        <EditorContent editor={editor} />
      </div>

      <div className="px-5 py-3 border-t border-white/10 bg-white/5">
        <p className="text-[11px] text-white/25">
          AI generates a draft — you must review, edit, and finalize. All edits are tracked for audit purposes.
        </p>
      </div>
    </div>
  );
}
