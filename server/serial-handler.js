const serialHandler = () => {
  console.log("Serial Called");
};

const dispatchControlState = async (port, controlState) => {
  try {
    const toSend = JSON.stringify(controlState);
    console.log(`writing to arena: ${toSend}`);
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
