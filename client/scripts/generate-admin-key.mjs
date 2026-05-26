import { createHash, randomInt } from 'node:crypto'

const length = 15
let key = ''

for (let index = 0; index < length; index += 1) {
  key += String(randomInt(0, 10))
}

const hash = createHash('sha256').update(key).digest('hex')

console.log('Garuga admin key')
console.log('Keep this 15-digit key private. It is shown only once.')
console.log('')
console.log(`ADMIN_KEY=${key}`)
console.log('')
console.log('Save this hash in Supabase secrets:')
console.log(`ADMIN_KEY_HASH=${hash}`)
console.log('')
console.log('Command:')
console.log(`supabase secrets set ADMIN_KEY_HASH="${hash}"`)
