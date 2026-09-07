import fs from 'node:fs'

const experience = fs.readFileSync(new URL('../src/AdminUserDetailExperience.jsx', import.meta.url), 'utf8')
const users = fs.readFileSync(new URL('../src/AdminUsersCenter.jsx', import.meta.url), 'utf8')
const shell = fs.readFileSync(new URL('../src/AdminUserCommunicationShell.css', import.meta.url), 'utf8')

const checks = [
  ['user center mounts communication experience', users.includes("./AdminUserDetailExperience.jsx")],
  ['detail experience renders one shell', experience.includes('data-user-detail-experience="true"')],
  ['communication bar is inside detail shell', experience.includes('data-user-communication-direct="true"')],
  ['email action is visible', experience.includes('>E-mail</button>')],
  ['notification action is visible', experience.includes('>Notificação</button>')],
  ['combined action is visible', experience.includes('>Comunicar</button>')],
  ['individual email endpoint is wired', experience.includes('/communications/email')],
  ['notification endpoint is wired', experience.includes("'/admin/ecosystem/notifications'" )],
  ['direct communication is forced visible', shell.includes('visibility: visible !important')],
]

let failed = false
for (const [label, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  if (!ok) failed = true
}

if (failed) process.exit(1)
console.log('\nUser communication detail contract validated.')
