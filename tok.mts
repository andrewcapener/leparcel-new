import { sessionToken } from './src/lib/adminAuth'
console.log(await sessionToken('testpass')); process.exit(0)
