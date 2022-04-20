let lastControlDispatchTime = 0;
let lastControlDispatchState;
let retryTimeout;
const controlDispatchMinFreq = 25; // every 25 ms

const serialHandler = (contents) => {
  console.log(`Serial says: ${contents}`);
};

const lowerLift = (port) => {
  port.write(JSON.stringify({ event: "lift", data: "lower" }));
}

const raiseLift = (port) => {
  port.write(JSON.stringify({ event: "lift", data: "raise" }));
}

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
    const toSend = JSON.stringify({ event: "controls", data: controlState });
    lastControlDispatchTime = Date.now();
    await port.write(toSend);

  } catch (e) {
    console.error(`Error writing to serial device ${e}`);
  }
};

module.exports = {
  serialHandler,
  dispatchControlState,
  lowerLift,
  raiseLift
};
