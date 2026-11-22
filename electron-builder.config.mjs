/**
 * Packaging: one configuration for the three platforms CI builds.
 *
 * Linux gets an AppImage — a single file that runs anywhere, no package manager involved.
 * Windows gets an NSIS installer. macOS gets a dmg and a zip (the zip is what the updater wants).
 * Signing stays off until certificates exist: an unsigned build installs, with the system's
 * usual warning.
 */
export default {
  appId: 'ru.uvw.reins',
  productName: 'Reins',
  copyright: 'Copyright © 2026 UNera',
  directories: { output: 'dist', buildResources: 'build' },
  files: ['src/**/*', 'package.json'],
  linux: {
    target: ['AppImage'],
    publish: ['github'],
    category: 'Development',
    artifactName: 'reins-${version}-${arch}.${ext}'
  },
  win: {
    target: ['nsis'],
    publish: ['github'],
    artifactName: 'reins-${version}-setup.${ext}'
  },
  mac: {
    target: ['dmg', 'zip'],
    publish: ['github'],
    category: 'public.app-category.developer-tools',
    artifactName: 'reins-${version}-${arch}.${ext}'
  },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  publish: [{ provider: 'github', owner: 'unera', repo: 'dsh-reins' }]
}
