console.log("A");
let {Cu} = require("chrome");
let adb = require("adb");
const events = require("sdk/event/core");
console.log("B");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
console.log("B1");
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
console.log("B2");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");
console.log("C");

Devices.helperAddonInstalled = true;
exports.shutdown = function() {
  Devices.helperAddonInstalled = false;
  adb.kill(true);
}
console.log("D");
// start automatically start tracking devices
adb.start();
console.log("E");
function onDeviceConnected(device) {
  console.log("ADBHELPER - CONNECTED: " + device);
  Devices.register(device, {
    connect: function () {
      let port = ConnectionManager.getFreeTCPPort();
      let local = "tcp:" + port;
      let remote = "localfilesystem:/data/local/debugger-socket";
      return adb.forwardPort(local, remote)
                .then(() => port);
    }
  });
}

events.on(adb, "device-connected", onDeviceConnected);

events.on(adb, "device-disconnected", function (device) {
  console.log("ADBHELPER - DISCONNECTED: " + device);
  Devices.unregister(device);
});
