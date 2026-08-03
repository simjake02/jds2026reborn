import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Wraps a form dialog: closing via X / Esc / outside-click asks for confirmation.
// Programmatic close (via onClose after Simpan) does NOT trigger the prompt.
export function FormDialog({ open, onClose, title, description, children, className = "", testid }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) setConfirm(true); }}>
        <DialogContent className={className} data-testid={testid}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent data-testid="confirm-close-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Tutup tanpa menyimpan?</AlertDialogTitle>
            <AlertDialogDescription>
              Perubahan yang Anda buat tidak akan disimpan. Data hanya tersimpan bila menekan tombol "Simpan".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="confirm-close-no">Tidak</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirm(false); onClose(); }} className="bg-emerald-600 hover:bg-emerald-700" data-testid="confirm-close-ok">Oke</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
