class AlarmAudio {
  constructor() {
    this.audio = new Audio("bell.mp3");
    this.audio.loop = true;
  }

  play() {
    this.audio.currentTime = 0;
    this.audio.play();
  }

  stop() {
    this.audio.pause();
  }
}
