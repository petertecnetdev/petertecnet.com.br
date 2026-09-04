import assert from 'node:assert/strict'
import { planAdminCommand } from '../src/admin/AdminCopilotPlanner.js'

const user = planAdminCommand('Cadastre usuário João Silva email joao@exemplo.com aplicativo Nexus')
assert.equal(user.status, 'ready')
assert.equal(user.actions.length, 1)
assert.equal(user.actions[0].key, 'user.invite')
assert.equal(user.actions[0].payload.name, 'João Silva')
assert.equal(user.actions[0].payload.email, 'joao@exemplo.com')
assert.equal(user.actions[0].payload.application, 'Nexus')

const compound = planAdminCommand('Cadastre usuário João Silva email joao@exemplo.com e crie empresa Oficina do João aplicativo Nexus e cadastre serviço Revisão valor 120')
assert.equal(compound.status, 'ready')
assert.equal(compound.actions.length, 3)
assert.equal(compound.actions[0].payload.application, 'Nexus')
assert.equal(compound.actions[1].payload.owner, 'joao@exemplo.com')
assert.equal(compound.actions[2].payload.establishment, 'Oficina do João')
assert.equal(compound.actions[2].payload.application, 'Nexus')
assert.equal(compound.actions[2].payload.price, 120)

const contextual = planAdminCommand('Cadastre produto Martelo valor 39,90', {
  application: 'Nexus',
  user: { name: 'João Silva', email: 'joao@exemplo.com', id: 20 },
  establishment: { name: 'Oficina do João', id: 30 },
})
assert.equal(contextual.status, 'ready')
assert.equal(contextual.actions[0].payload.application, 'Nexus')
assert.equal(contextual.actions[0].payload.establishment, 'Oficina do João')
assert.equal(contextual.actions[0].payload.price, 39.9)

const destructive = planAdminCommand('Exclua a empresa Oficina do João')
assert.equal(destructive.status, 'blocked')

console.log('Admin Copilot planner validation passed.')
