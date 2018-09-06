async function main() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  })
  const video = document.getElementById('preview')
  video.srcObject = stream
  const recorder = new MediaRecorder(stream)
  recorder.ondataavailable = data => {
    console.log(data)
    debugger
  }
  // recorder.start()
  // window.setTimeout(() => {
  //   recorder.stop()
  // }, 3000)
}
main()
