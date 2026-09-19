import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd(), 'src')
const uiKitPath = path.join(root, 'AdminUiKit.jsx')
const uiKit = fs.readFileSync(uiKitPath, 'utf8')

const failures = []
const requireInKit = (pattern, label) => {
  if (!pattern.test(uiKit)) failures.push(`AdminUiKit: ${label}`)
}

requireInKit(/export function PageHeader\(/, 'PageHeader universal ausente (101)')
requireInKit(/eyebrow/, 'eyebrow ausente (102)')
requireInKit(/breadcrumbs/, 'breadcrumbs ausente (108)')
requireInKit(/compact = false/, 'modo compacto ausente (115)')
requireInKit(/export function KpiCard\(/, 'KpiCard universal ausente (134)')
requireInKit(/sparkline/, 'sparkline leve ausente (142)')
requireInKit(/export function FilterBar\(/, 'FilterBar universal ausente (153)')
requireInKit(/activeCount/, 'contador de filtros ausente (157)')
requireInKit(/useDebouncedValue/, 'debounce compartilhado ausente (162)')
requireInKit(/export function DataTable\(/, 'DataTable universal ausente (172)')
requireInKit(/adm-table-skeleton/, 'skeleton de tabela ausente (186)')
requireInKit(/bulkActions/, 'ações em lote ausentes (194)')
requireInKit(/export function Field\(/, 'Field padronizado ausente (197)')

const targetModules = [
  ['Itens', 'AdminItemsManager.jsx'],
  ['Aplicações', 'AdminApplicationsCenter.jsx'],
  ['Usuários', 'AdminUsersManager.jsx'],
  ['Estabelecimentos', 'AdminEstablishmentsManager.jsx'],
  ['Notificações', 'AdminNotificationsCenter.jsx'],
]

for (const [label, file] of targetModules) {
  const filePath = path.join(root, file)
  if (!fs.existsSync(filePath)) continue
  const source = fs.readFileSync(filePath, 'utf8')
  const importsKit = /from ['"]\.\/AdminUiKit\.jsx['"]/.test(source)
  const usesShared = /<(PageHeader|KpiCard|FilterBar|DataTable|Field)\b/.test(source)
  if (!importsKit || !usesShared) failures.push(`${label}: ainda não adotou primitives compartilhadas AdminUiKit (101-200)`) 
}

const forbidden = []
for (const entry of fs.readdirSync(root)) {
  if (!entry.endsWith('.jsx')) continue
  const source = fs.readFileSync(path.join(root, entry), 'utf8')
  if (/window\.(confirm|alert|prompt)\s*\(/.test(source)) forbidden.push(entry)
}
if (forbidden.length) failures.push(`APIs nativas de diálogo ainda presentes: ${forbidden.join(', ')} (196 e continuidade 201+)`)

if (failures.length) {
  console.error('\nAdmin UX 101-200: PARCIAL — contratos ainda não atendidos:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Admin UX 101-200: contratos estruturais e adoção mínima validados.')
