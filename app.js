const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let alarms = JSON.parse(localStorage.getItem("wakefit_alarms") || "[]");
let zones = JSON.parse(
  localStorage.getItem("wakefit_zones") || '["Asia/Kolkata"]'
);

let editId = null;
let ringingAlarm = null;
let missionCount = 0;
let missionTarget = 10;
let cameraStream = null;
let lastTriggerKey = "";

const missions = {
  pushups: ["💪", "Push-ups"],
  squats: ["🏋️", "Squats"],
  steps: ["🏃", "Steps"],
  jumping: ["🤸", "Jumping Jacks"],
  plank: ["🧘", "Plank"],
  math: ["🧠", "Math Challenge"],
  random: ["🎲", "Daily Random"]
};

function save() {
  localStorage.setItem("wakefit_alarms", JSON.stringify(alarms));
  renderAlarms();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}

function dayText(days) {
  if (days.length === 7) return "Every day";

  if (
    days.length === 5 &&
    [1, 2, 3, 4, 5].every((x) => days.includes(x))
  ) {
    return "Mon–Fri";
  }

  if (
    days.length === 2 &&
    days.includes(0) &&
    days.includes(6)
  ) {
    return "Sat–Sun";
  }

  return days
    .map((x) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x])
    .join(" ");
}

function missionText(alarm) {
  let key = alarm.mission;

  if (key === "random") {
    key = ["pushups", "squats", "steps", "jumping", "plank"][
      new Date().getDay() % 5
    ];
  }

  const mission = missions[key] || missions.pushups;

  return `${mission[0]} ${alarm.target} ${mission[1]}`;
}

function targetFor(mission, difficulty) {
  if (mission === "plank") {
    if (difficulty === "easy") return 10;
    if (difficulty === "hard") return 30;
    return 20;
  }

  if (mission === "steps") {
    if (difficulty === "easy") return 100;
    if (difficulty === "hard") return 1000;
    return 500;
  }

  if (mission === "math") return 1;

  if (difficulty === "easy") return 5;
  if (difficulty === "hard") return 15;

  return 10;
}

function renderAlarms() {
  const list = $("#alarmList");

  if (!list) return;

  list.innerHTML = "";

  if (!alarms.length) {
    $("#emptyState")?.classList.remove("hidden");
    return;
  }

  $("#emptyState")?.classList.add("hidden");

  alarms.forEach((alarm) => {
    const card = document.createElement("div");

    card.className = "alarm-card";

    card.innerHTML = `
      <div>
        <div class="alarm-time">
          ${escapeHtml(alarm.time)}
        </div>

        <div class="alarm-sub">
          ${escapeHtml(dayText(alarm.days))}
          ·
          ${escapeHtml(alarm.label || "Wake up")}
        </div>

        <div class="mission-preview">
          ${escapeHtml(missionText(alarm))}
        </div>
      </div>

      <div class="card-actions">
        <button class="small-btn edit">✎</button>

        <button class="small-btn del">🗑</button>

        <button class="toggle ${alarm.enabled ? "on" : ""}">
          <i></i>
        </button>
      </div>
    `;

    card.querySelector(".edit").onclick = () => {
      openAlarm(alarm.id);
    };

    card.querySelector(".del").onclick = () => {
      if (confirm("Delete this alarm?")) {
        alarms = alarms.filter((x) => x.id !== alarm.id);
        save();
      }
    };

    card.querySelector(".toggle").onclick = () => {
      alarm.enabled = !alarm.enabled;
      save();
    };

    list.appendChild(card);
  });
}

const dayNames = ["S", "M", "T", "W", "T", "F", "S"];

function setupDays(selected = []) {
  const box = $("#dayPicker");

  if (!box) return;

  box.innerHTML = "";

  dayNames.forEach((name, index) => {
    const button = document.createElement("button");

    button.className =
      "day " + (selected.includes(index) ? "selected" : "");

    button.textContent = name;

    button.onclick = () => {
      button.classList.toggle("selected");
    };

    box.appendChild(button);
  });
}

function openAlarm(id = null) {
  editId = id;

  const alarm = id
    ? alarms.find((x) => x.id === id)
    : null;

  if ($("#modalTitle")) {
    $("#modalTitle").textContent =
      alarm ? "Edit Alarm" : "New Alarm";
  }

  if ($("#alarmTime")) {
    $("#alarmTime").value = alarm?.time || "06:00";
  }

  if ($("#alarmLabel")) {
    $("#alarmLabel").value =
      alarm?.label || "Wake up";
  }

  if ($("#missionType")) {
    $("#missionType").value =
      alarm?.mission || "random";
  }

  if ($("#difficulty")) {
    $("#difficulty").value =
      alarm?.difficulty || "medium";
  }

  if ($("#strictMission")) {
    $("#strictMission").checked =
      alarm?.strict !== false;
  }

  if ($("#alarmVibration")) {
    $("#alarmVibration").checked =
      alarm?.vibration !== false;
  }

  setupDays(alarm?.days || [1, 2, 3, 4, 5]);

  $("#alarmModal")?.classList.remove("hidden");
}

function closeAlarm() {
  $("#alarmModal")?.classList.add("hidden");
  editId = null;
}

$("#addAlarmBtn")?.addEventListener("click", () => {
  openAlarm();
});

$("#settingsBtn")?.addEventListener("click", () => {
  showPage("settingsPage");
});

$("#closeModal")?.addEventListener("click", closeAlarm);

$("#cancelAlarm")?.addEventListener("click", closeAlarm);

$("#saveAlarm")?.addEventListener("click", () => {
  const days = [...$("#dayPicker").children]
    .map((button, index) =>
      button.classList.contains("selected")
        ? index
        : null
    )
    .filter((x) => x !== null);

  if (!$("#alarmTime").value || !days.length) {
    alert("Select a time and at least one day.");
    return;
  }

  const mission =
    $("#missionType").value;

  const difficulty =
    $("#difficulty").value;

  const alarm = {
    id: editId || crypto.randomUUID(),

    time: $("#alarmTime").value,

    label:
      $("#alarmLabel").value ||
      "Wake up",

    days,

    mission,

    difficulty,

    strict:
      $("#strictMission").checked,

    vibration:
      $("#alarmVibration").checked,

    enabled: true,

    target:
      targetFor(mission, difficulty)
  };

  if (editId) {
    alarms = alarms.map((x) =>
      x.id === editId ? alarm : x
    );
  } else {
    alarms.push(alarm);
  }

  save();
  closeAlarm();
});

function checkAlarms(date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  const key =
    `${date.toDateString()}-${hour}:${minute}`;

  if (key === lastTriggerKey) return;

  alarms.forEach((alarm) => {
    if (
      alarm.enabled &&
      alarm.time === `${hour}:${minute}` &&
      alarm.days.includes(date.getDay())
    ) {
      lastTriggerKey = key;
      startRing(alarm);
    }
  });
}

function playBeep() {
  try {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    const context = new AudioContext();

    const oscillator =
      context.createOscillator();

    const gain =
      context.createGain();

    oscillator.frequency.value = 880;

    gain.gain.value = 0.12;

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();

    setTimeout(() => {
      oscillator.stop();
      context.close();
    }, 700);

  } catch (error) {
    console.log("Audio unavailable", error);
  }
}

function startRing(alarm) {
  ringingAlarm = alarm;

  missionCount = 0;

  missionTarget = alarm.target;

  if ($("#ringTime")) {
    $("#ringTime").textContent =
      alarm.time;
  }

  if ($("#ringLabel")) {
    $("#ringLabel").textContent =
      (alarm.label || "GOOD MORNING!").toUpperCase();
  }

  if ($("#ringMission")) {
    $("#ringMission").textContent =
      missionText(alarm);
  }

  if ($("#missionProgress")) {
    $("#missionProgress").style.width = "0%";
  }

  if ($("#missionCounter")) {
    $("#missionCounter").textContent =
      `0 / ${missionTarget}`;
  }

  if ($("#missionInstruction")) {
    $("#missionInstruction").textContent =
      "Complete the mission to dismiss the alarm.";
  }

  $("#ringModal")?.classList.remove("hidden");

  $("#missionActionBtn")?.classList.remove("hidden");

  $("#startCameraBtn")?.classList.remove("hidden");

  if ($("#missionActionBtn")) {
    $("#missionActionBtn").textContent =
      "Complete 1 Rep";

    $("#missionActionBtn").onclick =
      completeMission;
  }

  if (
    alarm.vibration &&
    navigator.vibrate
  ) {
    navigator.vibrate([
      700,
      400,
      700,
      400,
      1000
    ]);
  }

  playBeep();
}

function completeMission() {
  if (!ringingAlarm) return;

  missionCount++;

  if (
    ringingAlarm.mission === "math"
  ) {
    missionCount = missionTarget;
  }

  const percentage =
    Math.min(
      100,
      (missionCount / missionTarget) * 100
    );

  if ($("#missionProgress")) {
    $("#missionProgress").style.width =
      percentage + "%";
  }

  if ($("#missionCounter")) {
    $("#missionCounter").textContent =
      `${missionCount} / ${missionTarget}`;
  }

  if (missionCount >= missionTarget) {
    if ($("#missionInstruction")) {
      $("#missionInstruction").textContent =
        "🎉 Mission complete! You can stop the alarm now.";
    }

    if ($("#missionActionBtn")) {
      $("#missionActionBtn").textContent =
        "Stop Alarm";

      $("#missionActionBtn").onclick =
        stopRing;
    }
  }
}

$("#missionActionBtn")?.addEventListener(
  "click",
  completeMission
);

$("#startCameraBtn")?.addEventListener(
  "click",
  async () => {
    try {
      cameraStream =
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });

      $("#cameraVideo").srcObject =
        cameraStream;

      $("#cameraWrap")?.classList.remove(
        "hidden"
      );

      $("#startCameraBtn").textContent =
        "Camera Active";

      $("#startCameraBtn").disabled =
        true;

    } catch (error) {
      alert(
        "Camera permission was denied or unavailable. You can use the mission counter instead."
      );
    }
  }
);

function stopRing() {
  if (cameraStream) {
    cameraStream
      .getTracks()
      .forEach((track) => track.stop());

    cameraStream = null;
  }

  $("#ringModal")?.classList.add("hidden");

  ringingAlarm = null;

  if (navigator.vibrate) {
    navigator.vibrate(0);
  }
}

$("#emergencyStopBtn")?.addEventListener(
  "click",
  () => {
    if (
      confirm(
        "Emergency stop the alarm?"
      )
    ) {
      stopRing();
    }
  }
);

function showPage(pageId) {
  document
    .querySelectorAll(".page")
    .forEach((page) => {
      page.classList.remove("active");
    });

  $("#" + pageId)?.classList.add("active");

  document
    .querySelectorAll(".nav-btn")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.page === pageId
      );
    });
}

document
  .querySelectorAll(".nav-btn")
  .forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
    });
  });

function renderWorldClocks() {
  const list = $("#clockList");

  if (!list) return;

  list.innerHTML = "";

  zones.forEach((zone) => {
    const time =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: zone
        }
      );

    const name =
      zone
        .split("/")
        .pop()
        .replaceAll("_", " ");

    const item =
      document.createElement("div");

    item.className = "clock-item";

    item.innerHTML = `
      <div>
        <b>${escapeHtml(name)}</b>
        <div class="alarm-sub">
          ${escapeHtml(zone)}
        </div>
      </div>

      <strong>${time}</strong>
    `;

    list.appendChild(item);
  });
}

$("#addZoneBtn")?.addEventListener(
  "click",
  () => {
    const zone =
      $("#zoneSelect").value;

    if (!zones.includes(zone)) {
      zones.push(zone);
    }

    localStorage.setItem(
      "wakefit_zones",
      JSON.stringify(zones)
    );

    renderWorldClocks();
  }
);

let stopwatchStart = 0;
let stopwatchElapsed = 0;
let stopwatchRunning = false;
let stopwatchInterval = null;

function renderStopwatch() {
  const time = stopwatchRunning
    ? performance.now() -
      stopwatchStart +
      stopwatchElapsed
    : stopwatchElapsed;

  const centiseconds =
    Math.floor(time / 10) % 100;

  const seconds =
    Math.floor(time / 1000) % 60;

  const minutes =
    Math.floor(time / 60000);

  if ($("#stopwatchDisplay")) {
    $("#stopwatchDisplay").textContent =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}.` +
      `${String(centiseconds).padStart(2, "0")}`;
  }
}

$("#startStopwatchBtn")?.addEventListener(
  "click",
  () => {
    if (!stopwatchRunning) {
      stopwatchStart =
        performance.now();

      stopwatchRunning = true;

      $("#startStopwatchBtn").textContent =
        "Pause";

      stopwatchInterval =
        setInterval(
          renderStopwatch,
          40
        );

    } else {
      stopwatchElapsed +=
        performance.now() -
        stopwatchStart;

      stopwatchRunning = false;

      clearInterval(
        stopwatchInterval
      );

      $("#startStopwatchBtn").textContent =
        "Start";

      renderStopwatch();
    }
  }
);

$("#resetStopwatchBtn")?.addEventListener(
  "click",
  () => {
    stopwatchRunning = false;

    clearInterval(
      stopwatchInterval
    );

    stopwatchElapsed = 0;

    $("#startStopwatchBtn").textContent =
      "Start";

    $("#laps").innerHTML = "";

    renderStopwatch();
  }
);

$("#lapBtn")?.addEventListener(
  "click",
  () => {
    if (!stopwatchRunning) return;

    const lap =
      document.createElement("div");

    lap.textContent =
      $("#stopwatchDisplay").textContent;

    $("#laps")?.prepend(lap);
  }
);

let timerEnd = 0;
let timerRemain = 0;
let timerRunning = false;
let timerInterval = null;

function renderTimer() {
  const remaining = timerRunning
    ? Math.max(
        0,
        timerEnd - Date.now()
      )
    : timerRemain;

  timerRemain = remaining;

  let seconds =
    Math.ceil(remaining / 1000);

  let minutes =
    Math.floor(seconds / 60);

  seconds %= 60;

  if ($("#timerDisplay")) {
    $("#timerDisplay").textContent =
      `${String(minutes).padStart(2, "0")}:` +
      `${String(seconds).padStart(2, "0")}`;
  }

  if (
    remaining <= 0 &&
    timerRunning
  ) {
    timerRunning = false;

    clearInterval(timerInterval);

    playBeep();

    if ($("#startTimerBtn")) {
      $("#startTimerBtn").textContent =
        "Start";
    }
  }
}

$("#startTimerBtn")?.addEventListener(
  "click",
  () => {
    if (!timerRunning) {
      if (!timerRemain) {
        timerRemain =
          (+$("#timerMin").value || 0) *
            60000 +
          (+$("#timerSec").value || 0) *
            1000;
      }

      if (timerRemain <= 0) return;

      timerEnd =
        Date.now() + timerRemain;

      timerRunning = true;

      $("#startTimerBtn").textContent =
        "Pause";

      timerInterval =
        setInterval(
          renderTimer,
          200
        );

    } else {
      timerRemain =
        Math.max(
          0,
          timerEnd - Date.now()
        );

      timerRunning = false;

      clearInterval(timerInterval);

      $("#startTimerBtn").textContent =
        "Start";

      renderTimer();
    }
  }
);

$("#resetTimerBtn")?.addEventListener(
  "click",
  () => {
    timerRunning = false;

    clearInterval(timerInterval);

    timerRemain = 0;

    $("#startTimerBtn").textContent =
      "Start";

    renderTimer();
  }
);

$("#themeSelect")?.addEventListener(
  "change",
  (event) => {
    document.body.classList.toggle(
      "light",
      event.target.value === "light"
    );

    localStorage.setItem(
      "wakefit_theme",
      event.target.value
    );
  }
);

document
  .querySelectorAll(".accent")
  .forEach((button) => {
    button.addEventListener(
      "click",
      () => {
        const colors = {
          purple: "#8b5cf6",
          blue: "#2563eb",
          cyan: "#06b6d4",
          pink: "#ec4899"
        };

        const color =
          colors[button.dataset.accent];

        if (color) {
          document.documentElement.style.setProperty(
            "--accent",
            color
          );
        }

        localStorage.setItem(
          "wakefit_accent",
          button.dataset.accent
        );
      }
    );
  });

function updateClock() {
  const clock =
    $("#currentTime");

  if (clock) {
    clock.textContent =
      new Date().toLocaleTimeString(
        [],
        {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit"
        }
      );
  }

  checkAlarms(new Date());

  renderWorldClocks();
}

setInterval(updateClock, 1000);

(function init() {
  const theme =
    localStorage.getItem(
      "wakefit_theme"
    ) || "system";

  if ($("#themeSelect")) {
    $("#themeSelect").value = theme;
  }

  if (theme === "light") {
    document.body.classList.add("light");
  }

  const accent =
    localStorage.getItem(
      "wakefit_accent"
    );

  const colors = {
    purple: "#8b5cf6",
    blue: "#2563eb",
    cyan: "#06b6d4",
    pink: "#ec4899"
  };

  if (accent && colors[accent]) {
    document.documentElement.style.setProperty(
      "--accent",
      colors[accent]
    );
  }

  renderAlarms();
  renderWorldClocks();
  renderStopwatch();
  renderTimer();
  updateClock();
})();
