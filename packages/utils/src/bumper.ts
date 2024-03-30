export type BumperType = 'patch' | 'minor' | 'major' | 'alpha' | 'beta' | 'rc' | 'dev' | (string & {})

export function bump(originalVersion: string, bumper: BumperType) {
  const [version, preRelease] = originalVersion.split('-')
  const [major, minor, patch] = version.split('.').map(Number)

  let preReleaseVersion = 0
  if (preRelease) {
    const [preReleaseName, preReleaseVersionStr] = preRelease.split('.')
    if (preReleaseName === bumper && preReleaseVersionStr) {
      preReleaseVersion = parseInt(preReleaseVersionStr)
    }
  }
  switch (bumper) {
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'major':
      return `${major + 1}.0.0`
    case 'alpha':
      return `${major}.${minor}.${patch}-alpha.${preReleaseVersion + 1}`
    case 'beta':
      return `${major}.${minor}.${patch}-beta.${preReleaseVersion + 1}`
    case 'rc':
      return `${major}.${minor}.${patch}-rc.${preReleaseVersion + 1}`
    case 'dev':
      return `${major}.${minor}.${patch}-dev.${preReleaseVersion + 1}`
    default:
      return originalVersion
  }
}
