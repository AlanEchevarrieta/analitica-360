const params = new URLSearchParams(window.location.search)
const hash = window.location.hash
const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
const isRecovery =
  params.get('type') === 'recovery' ||
  hashParams.get('type') === 'recovery' ||
  hash.includes('type=recovery')

if (isRecovery && window.location.pathname !== '/reset-password') {
  window.history.replaceState(
    null,
    '',
    `/reset-password${window.location.search}${window.location.hash}`,
  )
}
