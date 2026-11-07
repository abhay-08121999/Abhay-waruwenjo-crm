/**
 * Sonner-compatible toast export
 * Re-exports the toast functions for easy usage
 */

import { toast as toastFn, useToast, ToastProvider } from '../components/ui/toast';

export const toast = toastFn;
export { useToast, ToastProvider };