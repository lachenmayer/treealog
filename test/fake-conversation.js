global.DatArchive = require('node-dat-archive')
const fs = require('fs').promises
const readline = require('readline')
const Conversation = require('treealog/lib/conversation')
const Contributor = require('treealog/lib/contributor')

async function main() {
  const video = await fs.readFile(__dirname + '/video.webm')
  const conversation = await Conversation.create()
  console.log(
    conversation.url.replace(
      'dat://',
      'dat://25144c35af792ad6f1c3c63fd6d817b70e6e7a9393a41c9e3d311ca8619b529a/#conversation/'
    )
  )
  const contributor = await Contributor.create()
  await conversation.addContributor(contributor.url)
  await contributor.addVideo(video, null)

  const input = readline.createInterface(process.stdin)
  input.on('line', async contributor => {
    const toInvite = new Contributor(contributor)
    await toInvite.ready
    console.log('Inviting', toInvite.title)
    await conversation.addContributor(contributor)
  })
}
main()
