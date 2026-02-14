let enabled = false

export function isPrivateModeEnabled() {
  return enabled
}

export function setPrivateMode(value) {
  enabled = Boolean(value)
  return enabled
}
