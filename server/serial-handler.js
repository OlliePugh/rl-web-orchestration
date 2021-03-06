let lastControlDispatchTime = 0;
let lastControlDispatchState;
let retryTimeout;
const controlDispatchMinFreq = 25; // every 25 ms

const safeWrite = async (port, msg) => {
  // just surpresses any errors
  try {
    await port.write(msg);
  } catch {
    console.error(`Failed to write: ${msg} to serial - has it been connected?`);
  }
};

const serialHandler = (contents, gameController) => {
  console.log(`Serial says: ${contents}`);
  try {
    message = JSON.parse(contents);

    if (message.event === "goalScored") {
      gameController.declareWinner(message.data.player);
    }
  } catch {
    console.log("Non event log");
  }
};

const lowerLift = (port) => {
  safeWrite(port, JSON.stringify({ event: "lift", data: { liftDown: false } })); // TODO make these the correct way round
};

const raiseLift = (port) => {
  safeWrite(port, JSON.stringify({ event: "lift", data: { liftDown: true } }));
};

const dispatchControlState = async (port, controlState, force) => {
  lastControlDispatchState = controlState;
  if (!force && Date.now() < lastControlDispatchTime + controlDispatchMinFreq) {
    // has not been long enough since last send
    if (!retryTimeout) {
      retryTimeout = setTimeout(() => {
        dispatchControlState(port, lastControlDispatchState);
      }, controlDispatchMinFreq - (Date.now() - lastControlDispatchTime));
    }
    return; // exit early
  }
  try {
    clearTimeout(retryTimeout);
    retryTimeout = null;
    const toSend = JSON.stringify({
      event: "controls",
      data: controlState,
    });
    lastControlDispatchTime = Date.now();
    await safeWrite(port, toSend);
  } catch (e) {
    console.error(`Error writing to serial device ${e}`);
  }
};

const toggleGoalDetection = (port, toggled) => {
  console.log(
    JSON.stringify({ event: "goalDetection", data: { enabled: toggled } })
  );
  safeWrite(
    port,
    JSON.stringify({ event: "goalDetection", data: { enabled: toggled } })
  ); // TODO make these the correct way round
};

module.exports = {
  serialHandler,
  dispatchControlState,
  lowerLift,
  raiseLift,
  toggleGoalDetection,
};
