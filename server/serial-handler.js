let lastControlDispatchTime = 0;
let lastControlDispatchState;
let retryTimeout;
const controlDispatchMinFreq = 25; // every 25 ms

const serialHandler = () => {
  console.log("Serial Called");
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
    const toSend = JSON.stringify(controlState);
    console.log(`writing to arena: ${toSend}`);
    lastControlDispatchTime = Date.now();
    if (port.isOpen()) {
      await port.write(toSend);
    } else {
      console.log("Trying to send data to closed serial port");
    }
  } catch (e) {
    console.error(`Error writing to serial device ${e}`);
  }
};

module.exports = {
  serialHandler,
  dispatchControlState,
};
