const params = new URLSearchParams(window.location.search)
const hash = window.location.hash
const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
const isRecovery =
  params.get('type') === 'recovery' ||
  params.get('type') === 'invite' ||
  hashParams.get('type') === 'recovery' ||
  hashParams.get('type') === 'invite' ||
  hash.includes('type=recovery') ||
  hash.includes('type=invite')

if (isRecovery && window.location.pathname !== '/reset-password') {
  window.history.replaceState(
    null,
    '',
    `/reset-password${window.location.search}${window.location.hash}`,
  )
}
