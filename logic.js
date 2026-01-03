class RandomAlarmLogic {
  constructor(onAlarm, onTick, onFinish) {
    this.onAlarm = onAlarm;
    this.onTick = onTick;
    this.onFinish = onFinish;

    this.totalMs = 0;
    this.remainingMs = 0;
    this.tickTimer = null;
    this.alarmTimers = [];
  }

  generateAlarmSchedule(minutes, count) {
    const totalMs = minutes * 60000;
    const usableMs = totalMs - 60000; // last alarm not later than -1min
    const gap = 60000;

    if (minutes < 2) throw new Error("Minimum duration is 2 minutes");
    if ((count - 1) * gap > usableMs)
      throw new Error("Too many alarms for this interval");

    const times = [];

    while (times.length < count) {
      const t = Math.floor(Math.random() * usableMs);
      if (times.every(x => Math.abs(x - t) >= gap)) times.push(t);
    }

    return times.sort((a,b)=>a-b);
  }

  start(minutes, count) {
    this.stop();

    this.totalMs = minutes * 60000;
    this.remainingMs = this.totalMs;

    const schedule = this.generateAlarmSchedule(minutes, count);

    schedule.forEach((t, idx) => {
      const id = setTimeout(() => this.onAlarm(idx + 1), t);
      this.alarmTimers.push(id);
    });

    this.tickTimer = setInterval(() => {
      this.remainingMs -= 1000;
      if (this.remainingMs <= 0) {
        this.stop();
        this.onFinish();
      } else this.onTick(this.remainingMs);
    }, 1000);
  }

  stop() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.alarmTimers.forEach(id => clearTimeout(id));

    this.tickTimer = null;
    this.alarmTimers = [];
  }
}
