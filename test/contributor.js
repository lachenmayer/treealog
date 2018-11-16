const test = require('ava')
const fs = require('fs').promises
const Contributor = require('../lib/contributor')

test('can add a video & read it', async t => {
  const p = await Contributor.create('dat://test')
  const videoFile = await fs.readFile(__dirname + '/video.webm')
  const responseTo = 'dat://somevideo'
  const video = await p.addVideo(videoFile, responseTo)
  const videos = Object.values(p.videos)
  t.is(videos.length, 1)
  t.deepEqual(videos[0], video)
  t.is(typeof video.url, 'string')
  t.is(video.responseTo, responseTo)
})
