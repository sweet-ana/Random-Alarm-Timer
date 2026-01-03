const setup = document.getElementById("setup-screen");
const timerScreen = document.getElementById("timer-screen");

const countdown = document.getElementById("countdown");
const alarmsLeftEl = document.getElementById("alarmsLeft");
const firedList = document.getElementById("firedList");

const startBtn = document.getElementById("startBtn");
const stopTimerBtn = document.getElementById("stopTimerBtn");

const miniPlayer = document.getElementById("miniPlayer");
const miniPlayerLabel = document.getElementById("miniPlayerLabel");
const stopSoundBtn = document.getElementById("stopSoundBtn");

const alarmAudio = new AlarmAudio();
let alarmsLeft = 0;

const logic = new RandomAlarmLogic(
  (alarmNum) => handleAlarm(alarmNum),
  (ms) => updateCountdown(ms),
  () => finishTimer()
);

function format(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000)/1000);
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function updateCountdown(ms){
  countdown.textContent = format(ms);
}

function handleAlarm(num){
  alarmsLeft--;
  alarmsLeftEl.textContent = `Alarms left: ${alarmsLeft}`;

  alarmAudio.play();
  miniPlayer.classList.remove("hidden");

  const now = new Date();
  const t = now.toTimeString().slice(0,5);
  const m = countdown.textContent;

  const div = document.createElement("div");
  div.textContent = `Alarm ${num} - ${m} (${t})`;
  firedList.appendChild(div);
}

stopSoundBtn.addEventListener("click", () => {
  alarmAudio.stop();
  miniPlayer.classList.add("hidden");
});

startBtn.addEventListener("click", () => {
  const minutes = +document.getElementById("duration").value;
  const count = +document.getElementById("alarmCount").value;

  try {
    alarmsLeft = count;
    firedList.innerHTML = "";
    alarmsLeftEl.textContent = `Alarms left: ${alarmsLeft}`;
    miniPlayer.classList.add("hidden");

    setup.classList.add("hidden");
    timerScreen.classList.remove("hidden");

    logic.start(minutes, count);
  } catch(e){
    alert(e.message);
  }
});

stopTimerBtn.addEventListener("click", () => reset());

function finishTimer(){
  reset();
}

function reset(){
  logic.stop();
  alarmAudio.stop();
  miniPlayer.classList.add("hidden");
  setup.classList.remove("hidden");
  timerScreen.classList.add("hidden");
}
