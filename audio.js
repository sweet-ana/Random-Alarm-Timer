class AlarmAudio {
  constructor() {
    this.audio = new Audio("bell.mp3");
    this.audio.loop = true;

    this.single = new Audio("bell.mp3"); // для окончания таймера
  }

  play() {
    this.audio.currentTime = 0;
    this.audio.play();
  }

  stop() {
    this.audio.pause();
  }

  playOnce() {
    this.single.currentTime = 0;
    this.single.play();
  }
}
