const fs = require('fs').promises
const Conversation = require('treealog/lib/conversation')
const Contributor = require('treealog/lib/contributor')

async function main() {
  const video = await fs.readFile(__dirname + '/test/video.webm')
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
}
main()
