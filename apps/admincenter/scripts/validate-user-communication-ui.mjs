import fs from 'node:fs'

const experience = fs.readFileSync(new URL('../src/AdminUserDetailExperience.jsx', import.meta.url), 'utf8')
const users = fs.readFileSync(new URL('../src/AdminUsersCenter.jsx', import.meta.url), 'utf8')
const impersonation = fs.readFileSync(new URL('../src/AdminImpersonation.jsx', import.meta.url), 'utf8')
const shell = fs.readFileSync(new URL('../src/AdminUserCommunicationShell.css', import.meta.url), 'utf8')

const checks = [
  ['user center mounts communication experience', users.includes("./AdminUserDetailExperience.jsx")],
  ['user list keeps direct impersonation action', users.includes('acu-simple-user__impersonate') && users.includes('setImpersonationUser(user)')],
  ['user list mounts impersonation dialog', users.includes('AdminImpersonationDialog') && users.includes('canImpersonate(user)')],
  ['impersonation accepts active applications identified by id', impersonation.includes("applications.filter(app => app?.is_active !== false && app?.id)")],
  ['impersonation posts the selected application id', impersonation.includes('application_id: Number(applicationId)')],
  ['impersonation requires API handoff before navigation', impersonation.includes("if (!payload?.handoff_url) throw new Error") && impersonation.includes('popup.location.replace(payload.handoff_url)')],
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
