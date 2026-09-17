import { onUnmounted, ref } from "vue";

const TOAST_MS = 3000;

export function useToast() {
  const toastMessage = ref("");
  let timer = 0;

  function showToast(message: string): void {
    toastMessage.value = message;
    window.clearTimeout(timer);
    if (!message) {
      return;
    }
    timer = window.setTimeout(() => {
      toastMessage.value = "";
    }, TOAST_MS);
  }

  function clearToast(): void {
    window.clearTimeout(timer);
    toastMessage.value = "";
  }

  onUnmounted(() => {
    window.clearTimeout(timer);
  });

  return {
    toastMessage,
    showToast,
    clearToast,
  };
}
