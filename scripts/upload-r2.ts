import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

import { r2Dir } from './tile-helpers.ts'

type Options = {
  dryRun: boolean
}

const defaultRcloneRemote = 'cf-r2'
const defaultR2Bucket = 'buildings'

function printHelp(): void {
  console.log(
    [
      'Usage: node scripts/upload-r2.ts [--dry-run]',
      '',
      'Uploads everything from data/r2 to Cloudflare R2 using rclone.',
      '',
      'Defaults:',
      `  rclone remote: ${defaultRcloneRemote}`,
      `  bucket: ${defaultR2Bucket}`,
      '',
      'Optional environment variables:',
      '  R2_PREFIX       Prefix/path inside the bucket',
      '',
      'Examples:',
      '  pnpm upload:r2',
      '  R2_PREFIX=prod pnpm upload:r2',
      '  pnpm upload:r2 -- --dry-run'
    ].join('\n')
  )
}

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function parseArgs(argv: string[]): Options {
  let dryRun = false

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    fail(`Unknown argument: ${arg}`)
  }

  return { dryRun }
}

function getDestination(): string {
  const remote = process.env.RCLONE_REMOTE?.trim() || defaultRcloneRemote
  const bucket = process.env.R2_BUCKET?.trim() || defaultR2Bucket
  const prefix = process.env.R2_PREFIX?.trim().replace(/^\/+|\/+$/g, '')

  return prefix ? `${remote}:${bucket}/${prefix}` : `${remote}:${bucket}`
}

const options = parseArgs(process.argv.slice(2))

if (!existsSync(r2Dir)) {
  fail(`Upload directory does not exist: ${r2Dir}`)
}

const destination = getDestination()
const args = [
  'copy',
  r2Dir,
  destination,
  '--progress',
  '--s3-upload-concurrency',
  '8',
  '--transfers',
  '8',
  '--checkers',
  '16'
]

if (options.dryRun) {
  args.push('--dry-run')
}

console.log(`Uploading ${join('data', 'r2')} -> ${destination}`)
execFileSync('rclone', args, {
  stdio: 'inherit'
})
