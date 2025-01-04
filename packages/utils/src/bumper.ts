export type BumperType = 'patch' | 'minor' | 'major' | (string & {})

export function bump(originalVersion: string, bumper: BumperType) {
  const [version, preRelease] = originalVersion.split('-')
  const [major, minor, patch] = version.split('.').map(Number)

  let preReleaseVersion = 0
  if (preRelease) {
    const [preReleaseName, preReleaseVersionStr] = preRelease.split('.')
    if (preReleaseName === bumper && preReleaseVersionStr) {
      preReleaseVersion = Number.parseInt(preReleaseVersionStr)
    }
  }
  switch (bumper) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    default:
      return /^\d+\.\d+\.\d+/.test(bumper)
        ? bumper
        : `${major}.${minor}.${patch}-${bumper}.${preReleaseVersion + 1}`
  }
}
