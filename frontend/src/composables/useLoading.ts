import { ref } from 'vue'

export function useLoading(initialValue = false) {
  const isLoading = ref(initialValue)
  const error = ref<string | null>(null)

  async function execute<T>(
    fn: () => Promise<T>,
    onError?: (err: Error) => void
  ): Promise<T | null> {
    isLoading.value = true
    error.value = null

    try {
      const result = await fn()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      error.value = errorMessage

      if (onError && err instanceof Error) {
        onError(err)
      }

      return null
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    execute,
  }
}
