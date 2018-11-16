#!/usr/bin/env node
global.DatArchive = require('node-dat-archive')
const split = require('split')
const Conversation = require('treealog/lib/conversation')

const lines = process.stdin.pipe(split())
forEach(lines, line => {
  const key = matchKey(line)
  if (key) {
    seedConversation(key)
  } else {
    console.error('not a valid key:', line)
  }
})

async function seedConversation(key) {
  const conversation = new Conversation(key)
  await conversation.ready
  if (conversation.error != null) {
    status(conversation.error)
    return
  }
  status(
    `started seeding - contributors: ${
      conversation.contributors.length
    } [${conversation.contributors.map(c => c.url).join(', ')}]`
  )
  conversation.on('update', () => {
    status(
      `update - contributors: ${
        conversation.contributors.length
      } [${conversation.contributors.map(c => c.url).join(', ')}]`
    )
  })

  function status(message) {
    console.error(`${new Date().toISOString()} ${conversation.url}: ${message}`)
  }
}

function matchKey(str) {
  const match = str.match(/\s*([0-9a-fA-F]{64})\s*/)
  if (match != null) {
    return match[1]
  }
  return null
}

function forEach(readableStream, cb) {
  readableStream.on('data', cb)
}
