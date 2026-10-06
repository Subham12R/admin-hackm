import { toast } from "sonner"

import { errorMessage } from "@/lib/api"

/** Toasts the outcome of an admin update: success text when it resolves, the server's reason when it fails. */
export function notify(promise: Promise<unknown>, success: string, after?: () => void) {
  return promise
    .then(() => {
      after?.()
      toast.success(success)
    })
    .catch((error: unknown) => {
      toast.error(errorMessage(error))
    })
}

export { toast }
